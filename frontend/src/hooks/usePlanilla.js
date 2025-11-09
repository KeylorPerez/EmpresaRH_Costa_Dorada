import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import planillaService from "../services/planillaService";
import empleadoService from "../services/empleadoService";
import prestamosService from "../services/prestamosService";

const createEmptyForm = (defaults = {}) => ({
  id_empleado: "",
  periodo_inicio: "",
  periodo_fin: "",
  horas_extras: "0",
  bonificaciones: "0",
  deducciones: "0",
  fecha_pago: "",
  dias_trabajados: "",
  dias_descuento: "0",
  monto_descuento_dias: "",
  dias_dobles: "0",
  monto_dias_dobles: "",
  ...defaults,
});

const parseDateSafe = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const hasOverlappingPlanilla = (planillas, idEmpleado, inicio, fin) => {
  const inicioDate = parseDateSafe(inicio);
  const finDate = parseDateSafe(fin);

  if (!inicioDate || !finDate) {
    return false;
  }

  return planillas.some((planilla) => {
    if (Number(planilla.id_empleado) !== Number(idEmpleado)) {
      return false;
    }

    const planillaInicio = parseDateSafe(planilla.periodo_inicio);
    const planillaFin = parseDateSafe(planilla.periodo_fin);

    if (!planillaInicio || !planillaFin) {
      return false;
    }

    return !(finDate < planillaInicio || inicioDate > planillaFin);
  });
};

export const usePlanilla = () => {
  const [planillas, setPlanillas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlanilla, setEditingPlanilla] = useState(null);
  const [formData, setFormData] = useState(() => createEmptyForm(calculateQuincenaDefaults()));
  const [prestamoSelections, setPrestamoSelections] = useState({});
  const [attendanceState, setAttendanceState] = useState({
    loading: false,
    dias: null,
    fechas: [],
    error: "",
  });
  const [attendanceReloadKey, setAttendanceReloadKey] = useState(0);
  const [detalleDias, setDetalleDias] = useState([]);
  const detalleContextRef = useRef({ empleadoId: null, inicio: "", fin: "" });
  const autoDiasRef = useRef(null);
  const autoMontoDescuentoRef = useRef(null);

  useEffect(() => {
    fetchPlanillas();
    fetchEmpleados();
    fetchPrestamos();
  }, []);

  const fetchPlanillas = async () => {
    try {
      setLoading(true);
      const data = await planillaService.getAll();
      setPlanillas(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Error al cargar planillas");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpleados = async () => {
    try {
      const data = await empleadoService.getAll();
      setEmpleados(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchPrestamos = async () => {
    try {
      const data = await prestamosService.getAll();
      setPrestamos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;

    if (name === "id_empleado") {
      autoDiasRef.current = null;
      autoMontoDescuentoRef.current = null;
      setAttendanceState({ loading: false, dias: null, fechas: [], error: "" });
      setFormData((prev) => ({
        ...prev,
        id_empleado: value,
        dias_trabajados: "",
        dias_descuento: "0",
        monto_descuento_dias: "",
        dias_dobles: "0",
        monto_dias_dobles: "",
      }));
      return;
    }

    if (name === "periodo_inicio" || name === "periodo_fin") {
      autoDiasRef.current = null;
      setAttendanceState((prev) => ({ ...prev, dias: null, fechas: [], error: "" }));
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const resetForm = () => {
    setFormData(createEmptyForm(calculateQuincenaDefaults()));
    setEditingPlanilla(null);
    setError("");
    setPrestamoSelections({});
    setAttendanceState({ loading: false, dias: null, fechas: [], error: "" });
    setAttendanceReloadKey(0);
    autoDiasRef.current = null;
    autoMontoDescuentoRef.current = null;
    setDetalleDias([]);
    detalleContextRef.current = { empleadoId: null, inicio: "", fin: "" };
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const selectEmpleado = useCallback(
    (idEmpleado) => {
      const value = idEmpleado ? String(idEmpleado) : "";
      handleChange({ target: { name: "id_empleado", value } });
    },
    [handleChange]
  );

  const handleEdit = (planilla) => {
    setEditingPlanilla(planilla);
    setFormData({
      id_empleado: planilla.id_empleado ? String(planilla.id_empleado) : "",
      periodo_inicio: normalizeDate(planilla.periodo_inicio),
      periodo_fin: normalizeDate(planilla.periodo_fin),
      horas_extras: normalizeNumber(planilla.horas_extras),
      bonificaciones: normalizeNumber(planilla.bonificaciones),
      deducciones: normalizeNumber(planilla.deducciones),
      fecha_pago: normalizeDate(planilla.fecha_pago),
      dias_trabajados: "",
      dias_descuento: "0",
      monto_descuento_dias: "",
      dias_dobles: "0",
      monto_dias_dobles: "",
    });
    setError("");
    setModalOpen(true);
  };

  const prestamosEmpleado = useMemo(() => {
    if (!formData.id_empleado) return [];
    return prestamos.filter((prestamo) => {
      const saldo = Number(prestamo.saldo);
      return (
        String(prestamo.id_empleado) === formData.id_empleado &&
        Number.isFinite(saldo) &&
        saldo > 0 &&
        Number(prestamo.id_estado) === 2
      );
    });
  }, [prestamos, formData.id_empleado]);

  useEffect(() => {
    if (!modalOpen || editingPlanilla) return;

    if (!formData.id_empleado) {
      setPrestamoSelections({});
      return;
    }

    setPrestamoSelections((prev) => {
      const updated = {};

      prestamosEmpleado.forEach((prestamo) => {
        const saldo = Math.max(Number(prestamo.saldo) || 0, 0);
        const cuotaSugerida = calcularCuotaSugerida(prestamo);
        const anterior = prev[prestamo.id_prestamo] || {};

        updated[prestamo.id_prestamo] = {
          aplicar: anterior.aplicar !== undefined ? anterior.aplicar : true,
          monto: clampMonto(anterior.monto ?? cuotaSugerida, saldo),
        };
      });

      return updated;
    });
  }, [modalOpen, prestamosEmpleado, formData.id_empleado, editingPlanilla]);

  const buildDetalleDias = useCallback((empleado, inicio, fin) => {
    if (!empleado || !inicio || !fin) return [];

    const fechaInicio = new Date(inicio);
    const fechaFin = new Date(fin);

    if (Number.isNaN(fechaInicio.getTime()) || Number.isNaN(fechaFin.getTime()) || fechaFin < fechaInicio) {
      return [];
    }

    const salarioBase = Number(empleado.salario_monto) || 0;
    const tipoPago = empleado.tipo_pago || "Quincenal";
    const salarioDiarioReferencia =
      tipoPago === "Diario"
        ? salarioBase
        : salarioBase > 0
          ? Number((salarioBase / 15).toFixed(2))
          : 0;

    const formatter = new Intl.DateTimeFormat("es-CR", { weekday: "long" });
    const detalles = [];

    for (
      let cursor = new Date(fechaInicio.getTime());
      cursor <= fechaFin;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const current = new Date(cursor.getTime());
      const iso = current.toISOString().split("T")[0];
      const diaRaw = formatter.format(current);
      const diaSemana = diaRaw.charAt(0).toUpperCase() + diaRaw.slice(1);

      detalles.push({
        fecha: iso,
        dia_semana: diaSemana,
        salario_base: salarioDiarioReferencia,
        salario_dia: salarioDiarioReferencia.toFixed(2),
        asistio: true,
        es_dia_doble: false,
        observacion: "",
      });
    }

    return detalles;
  }, []);

  const syncDetalleWithAttendance = useCallback((fechasAsistidas) => {
    if (!Array.isArray(fechasAsistidas)) {
      return;
    }

    const fechasNormalizadas = fechasAsistidas
      .map((fecha) => (typeof fecha === "string" ? fecha.trim() : ""))
      .filter((fecha) => fecha.length > 0);

    const asistenciaSet = new Set(fechasNormalizadas);
    const salarioCero = Number(0).toFixed(2);

    setDetalleDias((prev) => {
      if (!prev || prev.length === 0) {
        return prev;
      }

      if (asistenciaSet.size === 0) {
        const updated = prev.map((detalle) => {
          if (!detalle.asistio && Number(detalle.salario_dia) === 0) {
            return detalle.salario_dia === salarioCero
              ? detalle
              : { ...detalle, salario_dia: salarioCero };
          }

          return {
            ...detalle,
            asistio: false,
            salario_dia: salarioCero,
          };
        });

        const hasChanges = updated.some((detalle, index) => detalle !== prev[index]);
        return hasChanges ? updated : prev;
      }

      const updated = prev.map((detalle) => {
        const asistio = asistenciaSet.has(detalle.fecha);

        if (!asistio) {
          if (!detalle.asistio && Number(detalle.salario_dia) === 0) {
            return detalle.salario_dia === salarioCero
              ? detalle
              : { ...detalle, salario_dia: salarioCero };
          }

          return {
            ...detalle,
            asistio: false,
            salario_dia: salarioCero,
          };
        }

        const salarioBase = Number(detalle.salario_base);
        const factor = detalle.es_dia_doble ? 2 : 1;
        const salarioCalculado = (() => {
          if (Number.isFinite(salarioBase) && salarioBase >= 0) {
            return salarioBase * factor;
          }
          const actual = Number(detalle.salario_dia);
          return Number.isFinite(actual) && actual >= 0 ? actual : 0;
        })();

        const salarioTexto = Number(salarioCalculado).toFixed(2);

        if (detalle.asistio && detalle.salario_dia === salarioTexto) {
          return detalle;
        }

        return {
          ...detalle,
          asistio: true,
          salario_dia: salarioTexto,
        };
      });

      const hasChanges = updated.some((detalle, index) => detalle !== prev[index]);
      return hasChanges ? updated : prev;
    });
  }, []);

  useEffect(() => {
    if (!modalOpen) return;

    const { id_empleado, periodo_inicio, periodo_fin } = formData;

    if (!id_empleado || !periodo_inicio || !periodo_fin) {
      if (detalleDias.length > 0) {
        setDetalleDias([]);
      }
      detalleContextRef.current = { empleadoId: null, inicio: "", fin: "" };
      return;
    }

    const contextoActual = detalleContextRef.current;
    const keyActual = `${contextoActual.empleadoId}-${contextoActual.inicio}-${contextoActual.fin}`;
    const keyNuevo = `${id_empleado}-${periodo_inicio}-${periodo_fin}`;

    if (detalleDias.length > 0 && keyActual === keyNuevo) {
      return;
    }

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === String(id_empleado)
    );

    if (!empleadoSeleccionado) {
      if (detalleDias.length > 0) {
        setDetalleDias([]);
      }
      detalleContextRef.current = { empleadoId: id_empleado, inicio: periodo_inicio, fin: periodo_fin };
      return;
    }

    const nuevosDetalles = buildDetalleDias(empleadoSeleccionado, periodo_inicio, periodo_fin);
    setDetalleDias(nuevosDetalles);
    detalleContextRef.current = { empleadoId: id_empleado, inicio: periodo_inicio, fin: periodo_fin };
  }, [
    modalOpen,
    formData.id_empleado,
    formData.periodo_inicio,
    formData.periodo_fin,
    empleados,
    detalleDias,
    buildDetalleDias,
  ]);

  const updateDetalleDia = useCallback((index, updates) => {
    setDetalleDias((prev) =>
      prev.map((detalle, idx) => {
        if (idx !== index) return detalle;

        const siguiente = { ...detalle, ...updates };

        if (Object.prototype.hasOwnProperty.call(updates, "salario_dia")) {
          const valor = updates.salario_dia;

          if (valor === "") {
            siguiente.salario_dia = "";
          } else {
            const numero = Number(valor);
            if (!Number.isNaN(numero)) {
              const factor = detalle.es_dia_doble ? 2 : 1;
              const base = factor > 0 ? numero / factor : numero;
              siguiente.salario_dia = numero.toFixed(2);

              if (detalle.asistio) {
                siguiente.salario_base = Number(base.toFixed(2));
              }
            }
          }
        }

        return siguiente;
      })
    );
  }, []);

  const toggleDetalleAsistencia = useCallback((index) => {
    setDetalleDias((prev) =>
      prev.map((detalle, idx) =>
        idx === index
          ? (() => {
              const asistio = !detalle.asistio;
              const baseReferencia = (() => {
                const base = Number(detalle.salario_base);
                if (!Number.isNaN(base)) return base;

                const salarioActual = Number(detalle.salario_dia);
                if (Number.isNaN(salarioActual)) return 0;

                return detalle.es_dia_doble && salarioActual > 0
                  ? salarioActual / 2
                  : salarioActual;
              })();

              const formatear = (valor) => Number(valor).toFixed(2);
              const baseNormalizado = Number(baseReferencia.toFixed(2));

              return {
                ...detalle,
                asistio,
                salario_base: Number.isNaN(Number(detalle.salario_base))
                  ? baseNormalizado
                  : detalle.salario_base,
                salario_dia: asistio
                  ? formatear(baseReferencia * (detalle.es_dia_doble ? 2 : 1))
                  : formatear(0),
              };
            })()
          : detalle
      )
    );
  }, []);

  const toggleDetalleDiaDoble = useCallback((index) => {
    setDetalleDias((prev) =>
      prev.map((detalle, idx) =>
        idx === index
          ? (() => {
              const es_dia_doble = !detalle.es_dia_doble;
              const baseReferencia = (() => {
                const base = Number(detalle.salario_base);
                if (!Number.isNaN(base)) return base;

                const salarioActual = Number(detalle.salario_dia);
                if (Number.isNaN(salarioActual)) return 0;

                return detalle.es_dia_doble && salarioActual > 0
                  ? salarioActual / 2
                  : salarioActual;
              })();

              const formatear = (valor) => Number(valor).toFixed(2);
              const factor = es_dia_doble ? 2 : 1;
              const baseNormalizado = Number(baseReferencia.toFixed(2));

              return {
                ...detalle,
                es_dia_doble,
                salario_base: Number.isNaN(Number(detalle.salario_base))
                  ? baseNormalizado
                  : detalle.salario_base,
                salario_dia: detalle.asistio ? formatear(baseReferencia * factor) : formatear(0),
              };
            })()
          : detalle
      )
    );
  }, []);

  const detalleDiasResumen = useMemo(() => {
    if (!detalleDias || detalleDias.length === 0) {
      return {
        diasPeriodo: 0,
        diasAsistidos: 0,
        diasFaltantes: 0,
        salarioTotal: 0,
        diasDobles: 0,
        montoDiasDobles: 0,
      };
    }

    return detalleDias.reduce(
      (acumulado, detalle) => {
        const salario = Number(detalle.salario_dia) || 0;
        const salarioBase = Number(detalle.salario_base) || 0;
        const factor = detalle.es_dia_doble ? 2 : 1;
        if (detalle.asistio) {
          acumulado.diasAsistidos += factor;
          acumulado.salarioTotal += salario;
          if (detalle.es_dia_doble) {
            acumulado.diasDobles += 1;
            const extra = salario - salarioBase;
            const extraNormalizado = Number.isFinite(extra) && extra > 0 ? extra : salarioBase;
            acumulado.montoDiasDobles += Math.max(extraNormalizado, 0);
          }
        } else {
          acumulado.diasFaltantes += 1;
        }
        acumulado.diasPeriodo += 1;
        return acumulado;
      },
      {
        diasPeriodo: 0,
        diasAsistidos: 0,
        diasFaltantes: 0,
        salarioTotal: 0,
        diasDobles: 0,
        montoDiasDobles: 0,
      }
    );
  }, [detalleDias]);

  const obtenerSaldoPrestamo = (id_prestamo) => {
    const prestamo = prestamosEmpleado.find((item) => item.id_prestamo === id_prestamo);
    return Math.max(Number(prestamo?.saldo) || 0, 0);
  };

  const togglePrestamo = (id_prestamo) => {
    setPrestamoSelections((prev) => {
      const actual = prev[id_prestamo] || { aplicar: false, monto: 0 };
      return {
        ...prev,
        [id_prestamo]: {
          ...actual,
          aplicar: !actual.aplicar,
        },
      };
    });
  };

  const updateMontoPrestamo = (id_prestamo, value) => {
    const saldo = obtenerSaldoPrestamo(id_prestamo);
    const monto = clampMonto(value, saldo);

    setPrestamoSelections((prev) => {
      const actual = prev[id_prestamo] || { aplicar: true, monto: 0 };
      return {
        ...prev,
        [id_prestamo]: {
          ...actual,
          monto,
        },
      };
    });
  };

  const prestamosSeleccionados = useMemo(() => {
    return prestamosEmpleado
      .map((prestamo) => {
        const seleccion = prestamoSelections[prestamo.id_prestamo];
        if (!seleccion || !seleccion.aplicar) return null;

        const saldo = Math.max(Number(prestamo.saldo) || 0, 0);
        const monto = clampMonto(seleccion.monto, saldo);

        if (monto <= 0) return null;

        return {
          id_prestamo: prestamo.id_prestamo,
          monto_pago: monto,
          saldo_actual: saldo,
        };
      })
      .filter(Boolean);
  }, [prestamosEmpleado, prestamoSelections]);

  const totalPrestamosSeleccionados = useMemo(() => {
    return prestamosSeleccionados.reduce((sum, prestamo) => sum + prestamo.monto_pago, 0);
  }, [prestamosSeleccionados]);

  useEffect(() => {
    if (!modalOpen || editingPlanilla) return;
    if (!formData.id_empleado) return;

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === formData.id_empleado
    );

    if (!empleadoSeleccionado) return;

    const bonificacionDefault = empleadoSeleccionado.bonificacion_fija;

    if (bonificacionDefault === undefined || bonificacionDefault === null) return;

    const valorNormalizado = normalizeNumber(bonificacionDefault);

    setFormData((prev) => {
      if (prev.bonificaciones === valorNormalizado) {
        return prev;
      }

      return {
        ...prev,
        bonificaciones: valorNormalizado,
      };
    });
  }, [modalOpen, editingPlanilla, formData.id_empleado, empleados]);

  useEffect(() => {
    if (!modalOpen || editingPlanilla) return;

    if (!formData.id_empleado || !formData.periodo_inicio || !formData.periodo_fin) {
      setAttendanceState((prev) => {
        if (!prev.loading && prev.dias === null && !prev.error) {
          return prev;
        }
        return { loading: false, dias: null, fechas: [], error: "" };
      });
      return;
    }

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === formData.id_empleado
    );

    if (!empleadoSeleccionado || empleadoSeleccionado.tipo_pago !== "Diario") {
      setAttendanceState((prev) => {
        if (!prev.loading && prev.dias === null && !prev.error) {
          return prev;
        }
        return { loading: false, dias: null, fechas: [], error: "" };
      });
      return;
    }

    const inicio = parseDateSafe(formData.periodo_inicio);
    const fin = parseDateSafe(formData.periodo_fin);

    if (!inicio || !fin || fin < inicio) {
      setAttendanceState((prev) => ({ ...prev, dias: null, fechas: [] }));
      return;
    }

    let cancelled = false;

    const fetchDias = async () => {
      setAttendanceState((prev) => ({ ...prev, loading: true, fechas: [], error: "" }));
      try {
        const data = await planillaService.getAttendanceSummary({
          id_empleado: formData.id_empleado,
          periodo_inicio: formData.periodo_inicio,
          periodo_fin: formData.periodo_fin,
        });

        if (cancelled) return;

        const dias = Number(data?.dias) || 0;
        const fechas = Array.isArray(data?.fechas)
          ? Array.from(
              new Set(
                data.fechas
                  .map((fecha) => (typeof fecha === "string" ? fecha.trim() : ""))
                  .filter((fecha) => fecha.length > 0)
              )
            )
          : [];
        const previousAuto = autoDiasRef.current;
        autoDiasRef.current = dias;

        setAttendanceState({ loading: false, dias, fechas, error: "" });

        setFormData((prev) => {
          const actualNumero = Number(prev.dias_trabajados);
          if (
            prev.dias_trabajados === "" ||
            Number.isNaN(actualNumero) ||
            actualNumero === previousAuto
          ) {
            return { ...prev, dias_trabajados: dias ? dias.toString() : "0" };
          }
          return prev;
        });

        syncDetalleWithAttendance(fechas);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setAttendanceState({
          loading: false,
          dias: null,
          fechas: [],
          error: "No fue posible obtener los días de asistencia",
        });
      }
    };

    fetchDias();

    return () => {
      cancelled = true;
    };
  }, [
    modalOpen,
    editingPlanilla,
    formData.id_empleado,
    formData.periodo_inicio,
    formData.periodo_fin,
    empleados,
    attendanceReloadKey,
  ]);

  useEffect(() => {
    if (!modalOpen || editingPlanilla) return;
    if (!formData.id_empleado) return;
    if (detalleDias.length === 0) return;

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === formData.id_empleado
    );

    if (!empleadoSeleccionado || empleadoSeleccionado.tipo_pago !== "Diario") {
      return;
    }

    if (attendanceState.dias === null) {
      return;
    }

    syncDetalleWithAttendance(attendanceState.fechas);
  }, [
    modalOpen,
    editingPlanilla,
    formData.id_empleado,
    detalleDias,
    empleados,
    attendanceState.dias,
    attendanceState.fechas,
    syncDetalleWithAttendance,
  ]);

  useEffect(() => {
    if (!modalOpen || editingPlanilla) return;

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === formData.id_empleado
    );

    if (!empleadoSeleccionado || empleadoSeleccionado.tipo_pago !== "Quincenal") {
      return;
    }

    const dias = Number(formData.dias_descuento);
    if (!Number.isFinite(dias) || dias < 0) {
      return;
    }

    const salarioBase = Number(empleadoSeleccionado.salario_monto) || 0;
    if (salarioBase <= 0) {
      return;
    }

    const montoCalculado = salarioBase / 15 * dias;
    if (!Number.isFinite(montoCalculado)) {
      return;
    }

    const montoRedondeado = Number(montoCalculado.toFixed(2));
    const montoTexto = montoRedondeado.toFixed(2);
    const previousAuto = autoMontoDescuentoRef.current;
    autoMontoDescuentoRef.current = montoRedondeado;

    setFormData((prev) => {
      const actualNumero = Number(prev.monto_descuento_dias);
      if (
        prev.monto_descuento_dias === "" ||
        Number.isNaN(actualNumero) ||
        actualNumero === previousAuto
      ) {
        return { ...prev, monto_descuento_dias: montoTexto };
      }
      return prev;
    });
  }, [
    modalOpen,
    editingPlanilla,
    formData.dias_descuento,
    formData.id_empleado,
    empleados,
  ]);

  const buildNumber = (value) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const parseNonNegative = (value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return parsed;
  };

  const parseOptionalNonNegative = (value) => {
    if (value === "" || value === null || value === undefined) return null;
    return parseNonNegative(value);
  };

  const refreshAttendance = useCallback(() => {
    if (!formData.id_empleado || !formData.periodo_inicio || !formData.periodo_fin) {
      setAttendanceState((prev) => ({
        ...prev,
        error: "Selecciona empleado y fechas para consultar asistencia",
      }));
      return;
    }

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === formData.id_empleado
    );

    if (!empleadoSeleccionado || empleadoSeleccionado.tipo_pago !== "Diario") {
      setAttendanceState((prev) => ({
        ...prev,
        error: "La asistencia automática solo aplica para colaboradores con pago diario",
      }));
      return;
    }

    setAttendanceState((prev) => ({ ...prev, error: "" }));
    setAttendanceReloadKey((key) => key + 1);
  }, [empleados, formData.id_empleado, formData.periodo_inicio, formData.periodo_fin]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setError("");

      if (!editingPlanilla) {
        if (!formData.id_empleado || !formData.periodo_inicio || !formData.periodo_fin) {
          setError("Selecciona empleado y periodo de pago");
          return;
        }

        if (new Date(formData.periodo_fin) < new Date(formData.periodo_inicio)) {
          setError("La fecha fin debe ser mayor o igual a la fecha inicio");
          return;
        }

        if (
          hasOverlappingPlanilla(
            planillas,
            formData.id_empleado,
            formData.periodo_inicio,
            formData.periodo_fin
          )
        ) {
          setError("Este colaborador ya tiene una planilla generada para el periodo seleccionado");
          return;
        }

        const prestamosPayload = prestamosSeleccionados.map((prestamo) => {
          if (prestamo.monto_pago > prestamo.saldo_actual) {
            throw new Error("El monto de pago supera el saldo disponible del préstamo");
          }

          return {
            id_prestamo: prestamo.id_prestamo,
            monto_pago: Number(prestamo.monto_pago.toFixed(2)),
          };
        });

        const deduccionesManuales = buildNumber(formData.deducciones);

        const empleadoSeleccionado = empleados.find(
          (empleado) => String(empleado.id_empleado) === String(formData.id_empleado)
        );
        const tipoPagoEmpleado = empleadoSeleccionado?.tipo_pago || "Quincenal";

        const diasDoblesDetalle = Number(detalleDiasResumen.diasDobles) || 0;
        const montoDoblesDetalle = Number(detalleDiasResumen.montoDiasDobles) || 0;

        const diasDoblesManual = parseNonNegative(formData.dias_dobles);
        const montoDoblesManual = parseOptionalNonNegative(formData.monto_dias_dobles);

        const ingresoManualDobles =
          (formData.monto_dias_dobles !== "" && formData.monto_dias_dobles !== null) || diasDoblesManual > 0;
        const usaDoblesManualPayload = tipoPagoEmpleado !== "Diario" || ingresoManualDobles;

        let diasDoblesPayload = 0;
        let montoDoblesPayload = null;

        if (usaDoblesManualPayload) {
          diasDoblesPayload = diasDoblesManual;
          if (montoDoblesManual !== null) {
            montoDoblesPayload = montoDoblesManual;
          } else if (diasDoblesManual > 0) {
            const salarioBaseEmpleado = Number(empleadoSeleccionado?.salario_monto) || 0;
            const salarioReferenciaDobles =
              tipoPagoEmpleado === "Diario"
                ? salarioBaseEmpleado
                : salarioBaseEmpleado / 15;
            montoDoblesPayload = Number((salarioReferenciaDobles * diasDoblesManual).toFixed(2));
          } else {
            montoDoblesPayload = 0;
          }
        } else if (tipoPagoEmpleado === "Diario" && diasDoblesDetalle > 0) {
          diasDoblesPayload = Number(diasDoblesDetalle.toFixed(2));
          montoDoblesPayload = Number(montoDoblesDetalle.toFixed(2));
        }

        const detallesPayload = detalleDias.map((detalle) => ({
          fecha: detalle.fecha,
          dia_semana: detalle.dia_semana,
          salario_dia: buildNumber(detalle.salario_dia),
          asistio: Boolean(detalle.asistio),
          es_dia_doble: Boolean(detalle.es_dia_doble),
          observacion:
            detalle.observacion && detalle.observacion.trim() !== ""
              ? detalle.observacion.trim()
              : null,
        }));

        const payload = {
          id_empleado: Number(formData.id_empleado),
          periodo_inicio: formData.periodo_inicio,
          periodo_fin: formData.periodo_fin,
          horas_extras: buildNumber(formData.horas_extras),
          bonificaciones: buildNumber(formData.bonificaciones),
          deducciones: deduccionesManuales,
          fecha_pago: formData.fecha_pago || null,
          prestamos: prestamosPayload,
          dias_trabajados: parseOptionalNonNegative(formData.dias_trabajados),
          dias_descuento: parseNonNegative(formData.dias_descuento),
          monto_descuento_dias: parseOptionalNonNegative(formData.monto_descuento_dias),
          dias_dobles: diasDoblesPayload,
          monto_dias_dobles: montoDoblesPayload,
          detalles: detallesPayload,
        };

        await planillaService.create(payload);
      } else {
        const payload = {
          horas_extras: buildNumber(formData.horas_extras),
          bonificaciones: buildNumber(formData.bonificaciones),
          deducciones: buildNumber(formData.deducciones),
          fecha_pago: formData.fecha_pago || null,
        };

        await planillaService.update(editingPlanilla.id_planilla, payload);
      }

      setModalOpen(false);
      resetForm();
      await fetchPlanillas();
      await fetchPrestamos();
    } catch (err) {
      console.error(err);
      const isConflict = err.response?.status === 409;
      const message = err.response?.data?.error ||
        (isConflict
          ? "Este colaborador ya tiene una planilla registrada en ese periodo"
          : err.message) ||
        "Error al guardar la planilla";
      setError(message);
    }
  };

  const totals = useMemo(() => {
    const formatter = new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      minimumFractionDigits: 2,
    });

    const totalPago = planillas.reduce((sum, planilla) => sum + (Number(planilla.pago_neto) || 0), 0);

    return {
      totalPago: formatter.format(totalPago),
      cantidad: planillas.length,
    };
  }, [planillas]);

  return {
    planillas,
    empleados,
    loading,
    error,
    modalOpen,
    setModalOpen,
    editingPlanilla,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    openCreateModal,
    selectEmpleado,
    resetForm,
    fetchPlanillas,
    setError,
    totals,
    prestamosEmpleado,
    prestamoSelections,
    togglePrestamo,
    updateMontoPrestamo,
    totalPrestamosSeleccionados,
    attendanceState,
    refreshAttendance,
    detalleDias,
    updateDetalleDia,
    toggleDetalleAsistencia,
    toggleDetalleDiaDoble,
    detalleDiasResumen,
  };
};

const normalizeDate = (value) => {
  if (!value) return "";
  return value.split("T")[0];
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined) return "0";
  return String(value);
};

const calculateQuincenaDefaults = () => {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();
  const dia = hoy.getDate();

  if (dia <= 15) {
    const inicio = new Date(anio, mes, 1);
    const fin = new Date(anio, mes, 15);
    const pago = new Date(anio, mes, 15);

    return {
      periodo_inicio: formatDateInput(inicio),
      periodo_fin: formatDateInput(fin),
      fecha_pago: formatDateInput(pago),
    };
  }

  const inicio = new Date(anio, mes, 16);
  const fin = new Date(anio, mes + 1, 0);

  return {
    periodo_inicio: formatDateInput(inicio),
    periodo_fin: formatDateInput(fin),
    fecha_pago: formatDateInput(fin),
  };
};

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const calcularCuotaSugerida = (prestamo) => {
  const saldo = Math.max(Number(prestamo?.saldo) || 0, 0);
  const cuotas = Math.max(Number(prestamo?.cuotas) || 1, 1);
  const monto = Math.max(Number(prestamo?.monto) || saldo, saldo);
  const cuota = monto / cuotas;

  if (!Number.isFinite(cuota) || cuota <= 0) {
    return saldo;
  }

  return Math.min(Number(cuota.toFixed(2)), saldo);
};

const clampMonto = (value, saldoMaximo) => {
  const numero = Number(value);
  if (Number.isNaN(numero) || numero <= 0) return 0;

  if (!Number.isFinite(saldoMaximo) || saldoMaximo <= 0) return 0;

  const maximo = Number(saldoMaximo.toFixed(2));
  return Math.min(Number(numero.toFixed(2)), maximo);
};
