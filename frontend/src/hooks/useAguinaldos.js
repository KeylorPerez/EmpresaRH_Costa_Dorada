import { useCallback, useEffect, useMemo, useState } from "react";
import aguinaldoService from "../services/aguinaldoService";
import empleadoService from "../services/empleadoService";
import { formatDateValue } from "../utils/dateUtils";
import { useAuth } from "./useAuth";

const currentYear = () => new Date().getFullYear().toString();

const normalizarTipoPago = (valor) =>
  String(valor || "")
    .trim()
    .toLowerCase();

const esPagoDiario = (valor) => normalizarTipoPago(valor) === "diario";

const createInitialForm = (anioValor = currentYear()) => {
  const periodo = getPeriodoPorAnio(anioValor);
  return {
    id_empleado: "",
    anio: String(anioValor),
    metodo: "manual",
    salario_quincenal: "",
    fecha_ingreso_manual: "",
    incluir_bonificaciones: true,
    incluir_horas_extra: false,
    tipo_pago_empleado: "",
    puesto_nombre: "",
    fecha_inicio_periodo: formatDateInput(periodo.inicio),
    fecha_fin_periodo: formatDateInput(periodo.fin),
    observacion: "",
    periodo_promedio_diario: "quincena",
    monto_promedio_diario: "",
    dias_promedio_diario: "",
  };
};

const formatDateInput = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return "";

    const match = trimmed.match(/^\s*(\d{4}-\d{2}-\d{2})/);
    if (match) {
      return match[1];
    }
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const looksLikeUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0 &&
    (date.getHours() !== 0 ||
      date.getMinutes() !== 0 ||
      date.getSeconds() !== 0 ||
      date.getMilliseconds() !== 0);

  const year = looksLikeUtcMidnight ? date.getUTCFullYear() : date.getFullYear();
  const monthIndex = looksLikeUtcMidnight ? date.getUTCMonth() : date.getMonth();
  const dayValue = looksLikeUtcMidnight ? date.getUTCDate() : date.getDate();

  const month = String(monthIndex + 1).padStart(2, "0");
  const day = String(dayValue).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const getPeriodoPorAnio = (anio) => {
  const parsedYear = Number(anio);
  const baseYear = Number.isInteger(parsedYear) ? parsedYear : new Date().getFullYear();
  const inicio = new Date(baseYear - 1, 11, 1);
  inicio.setHours(0, 0, 0, 0);
  const fin = new Date(baseYear, 10, 30);
  fin.setHours(23, 59, 59, 999);
  return { inicio, fin };
};

const parseDateOnly = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [_, year, month, day] = match;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      }
    }
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
};

const clampDateToPeriodo = (value, periodo) => {
  if (!value) return "";
  const date = parseDateOnly(value);
  if (!date) return "";

  const inicio = periodo?.inicio ? parseDateOnly(periodo.inicio) : null;
  const fin = periodo?.fin ? parseDateOnly(periodo.fin) : null;

  if (inicio && date < inicio) {
    return formatDateInput(inicio);
  }

  if (fin && date > fin) {
    return formatDateInput(fin);
  }

  return formatDateInput(date);
};

const determinarFechaInicioPeriodo = (periodo, fechaIngreso) => {
  const inicio = periodo?.inicio ? parseDateOnly(periodo.inicio) : null;
  const fin = periodo?.fin ? parseDateOnly(periodo.fin) : null;

  if (!inicio) {
    return fin || null;
  }

  const ingreso = parseDateOnly(fechaIngreso);
  if (!ingreso) {
    return inicio;
  }

  if (fin && ingreso > fin) {
    return fin;
  }

  return ingreso > inicio ? ingreso : inicio;
};

const determinarFechaIngresoParaCalculo = (periodo, fechaIngreso) => {
  const fechaBase = determinarFechaInicioPeriodo(periodo, fechaIngreso);
  if (!fechaBase) return null;

  const fin = periodo?.fin ? parseDateOnly(periodo.fin) : null;
  if (fin && fechaBase > fin) {
    return fin;
  }

  return fechaBase;
};

const calcularSalarioDiarioDesdePromedio = (montoPromedio, diasPromedio) => {
  const monto = Number(montoPromedio);
  const dias = Number(diasPromedio);
  if (!Number.isFinite(monto) || monto <= 0) return null;
  if (!Number.isFinite(dias) || dias <= 0) return null;
  const salario = monto / dias;
  if (!Number.isFinite(salario) || salario <= 0) return null;
  return salario;
};

const aplicarPromedioDiarioAEstado = (state) => {
  if (normalizarTipoPago(state.tipo_pago_empleado) !== "diario") {
    return state;
  }

  const salarioCalculado = calcularSalarioDiarioDesdePromedio(
    state.monto_promedio_diario,
    state.dias_promedio_diario
  );

  if (!salarioCalculado) {
    return {
      ...state,
      salario_quincenal: state.salario_quincenal || "",
    };
  }

  const salarioFormateado = salarioCalculado.toFixed(2);

  return {
    ...state,
    salario_quincenal: salarioFormateado,
  };
};

export const formatearMontoCRC = (value) => {
  if (value === undefined || value === null || value === "") {
    return "₡0.00";
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return numeric.toLocaleString("es-CR", {
    style: "currency",
    currency: "CRC",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  });
};

export const formatearFechaCorta = (value) => formatDateValue(value);

export const useAguinaldos = ({ autoFetch = true } = {}) => {
  const { user } = useAuth();
  const isAdmin = user?.id_rol === 1;

  const [aguinaldos, setAguinaldos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [empleadosLoading, setEmpleadosLoading] = useState(false);
  const [loading, setLoading] = useState(autoFetch);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState(() => createInitialForm());

  const obtenerPeriodo = useCallback((state, overrides = {}) => {
    const anioReferencia = overrides.anio ?? state.anio;
    const base = getPeriodoPorAnio(anioReferencia);
    const inicio =
      parseDateOnly(overrides.fecha_inicio_periodo ?? state.fecha_inicio_periodo) || base.inicio;
    const fin = parseDateOnly(overrides.fecha_fin_periodo ?? state.fecha_fin_periodo) || base.fin;
    return { inicio, fin };
  }, []);

  const fetchAguinaldos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await aguinaldoService.getAll();
      setAguinaldos(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible cargar los aguinaldos";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchAguinaldos();
    }
  }, [autoFetch, fetchAguinaldos]);

  const fetchEmpleados = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setEmpleadosLoading(true);
      const data = await empleadoService.getAll();
      setEmpleados(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible cargar los empleados";
      setError((prev) => prev || message);
    } finally {
      setEmpleadosLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchEmpleados();
    }
  }, [isAdmin, fetchEmpleados]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    if (name === "id_empleado") {
      setFormData((prev) => {
        const selected = empleados.find(
          (empleado) => String(empleado.id_empleado) === String(value)
        );
        const periodoBase = getPeriodoPorAnio(prev.anio);
        const inicioCalculado = determinarFechaInicioPeriodo(
          periodoBase,
          selected?.fecha_ingreso
        );
        const fechaInicioNormalizada = formatDateInput(inicioCalculado);
        const fechaFinNormalizada = formatDateInput(periodoBase.fin);
        const periodoAjustado = {
          inicio: inicioCalculado,
          fin: periodoBase.fin,
        };
        const fechaIngresoNormalizada =
          clampDateToPeriodo(
            determinarFechaIngresoParaCalculo(periodoAjustado, selected?.fecha_ingreso) ||
              fechaInicioNormalizada,
            periodoAjustado
          ) || fechaInicioNormalizada;
        const salarioInicial = (() => {
          const monto = Number(selected?.salario_monto);
          if (esPagoDiario(selected?.tipo_pago)) {
            return "0";
          }
          if (Number.isFinite(monto) && monto > 0) {
            return String(monto);
          }
          return "";
        })();

        const nextState = {
          ...prev,
          id_empleado: value,
          fecha_inicio_periodo: fechaInicioNormalizada,
          fecha_fin_periodo: fechaFinNormalizada,
          fecha_ingreso_manual: fechaIngresoNormalizada,
          salario_quincenal: salarioInicial,
          tipo_pago_empleado: selected?.tipo_pago || "",
          puesto_nombre: selected?.puesto_nombre || "",
          periodo_promedio_diario: "quincena",
          monto_promedio_diario: "",
          dias_promedio_diario: "",
        };

        return aplicarPromedioDiarioAEstado(nextState);
      });
      return;
    }

    if (name === "anio") {
      setFormData((prev) => {
        const nuevoAnio = value;
        const periodo = getPeriodoPorAnio(nuevoAnio);
        const selected = empleados.find(
          (empleado) => String(empleado.id_empleado) === String(prev.id_empleado)
        );
        const inicioCalculado = determinarFechaInicioPeriodo(
          periodo,
          selected?.fecha_ingreso
        );
        const fechaInicioNormalizada = formatDateInput(inicioCalculado);
        const fechaFinNormalizada = formatDateInput(periodo.fin);
        const periodoAjustado = {
          inicio: inicioCalculado,
          fin: periodo.fin,
        };
        const fechaClampeada =
          clampDateToPeriodo(
            prev.fecha_ingreso_manual || fechaInicioNormalizada,
            periodoAjustado
          ) || fechaInicioNormalizada;

        return {
          ...prev,
          anio: nuevoAnio,
          fecha_ingreso_manual: fechaClampeada,
          fecha_inicio_periodo: fechaInicioNormalizada,
          fecha_fin_periodo: fechaFinNormalizada,
        };
      });
      return;
    }

    if (name === "periodo_promedio_diario") {
      setFormData((prev) =>
        aplicarPromedioDiarioAEstado({
          ...prev,
          periodo_promedio_diario: value,
        })
      );
      return;
    }

    if (name === "monto_promedio_diario" || name === "dias_promedio_diario") {
      setFormData((prev) =>
        aplicarPromedioDiarioAEstado({
          ...prev,
          [name]: value,
        })
      );
      return;
    }

    if (name === "fecha_ingreso_manual") {
      setFormData((prev) => {
        const periodo = obtenerPeriodo(prev);
        const fechaClampeada = clampDateToPeriodo(value, periodo);
        return {
          ...prev,
          fecha_ingreso_manual: fechaClampeada,
        };
      });
      return;
    }

    if (name === "fecha_inicio_periodo") {
      setFormData((prev) => {
        const basePeriodo = obtenerPeriodo(prev, { fecha_inicio_periodo: value });
        const nuevoInicio = parseDateOnly(value) || basePeriodo.inicio;
        const inicioNormalizado = formatDateInput(nuevoInicio);
        const finActual = parseDateOnly(prev.fecha_fin_periodo) || basePeriodo.fin;
        const finNormalizado =
          finActual < nuevoInicio ? formatDateInput(nuevoInicio) : formatDateInput(finActual);
        const periodoAjustado = {
          inicio: nuevoInicio,
          fin: finActual < nuevoInicio ? nuevoInicio : finActual,
        };
        const fechaIngresoNormalizada = prev.fecha_ingreso_manual
          ? clampDateToPeriodo(prev.fecha_ingreso_manual, periodoAjustado) || inicioNormalizado
          : inicioNormalizado;

        return {
          ...prev,
          fecha_inicio_periodo: inicioNormalizado,
          fecha_fin_periodo: finNormalizado,
          fecha_ingreso_manual: fechaIngresoNormalizada,
        };
      });
      return;
    }

    if (name === "fecha_fin_periodo") {
      setFormData((prev) => {
        const basePeriodo = obtenerPeriodo(prev, { fecha_fin_periodo: value });
        const inicioActual = parseDateOnly(prev.fecha_inicio_periodo) || basePeriodo.inicio;
        const nuevoFin = parseDateOnly(value) || basePeriodo.fin;
        const finNormalizado =
          nuevoFin < inicioActual ? formatDateInput(inicioActual) : formatDateInput(nuevoFin);
        const periodoAjustado = {
          inicio: inicioActual,
          fin: nuevoFin < inicioActual ? inicioActual : nuevoFin,
        };
        const fechaIngresoNormalizada = prev.fecha_ingreso_manual
          ? clampDateToPeriodo(prev.fecha_ingreso_manual, periodoAjustado) ||
            formatDateInput(periodoAjustado.inicio)
          : formatDateInput(periodoAjustado.inicio);

        return {
          ...prev,
          fecha_fin_periodo: finNormalizado,
          fecha_ingreso_manual: fechaIngresoNormalizada,
        };
      });
      return;
    }

    if (name === "observacion") {
      const texto = typeof value === "string" ? value.slice(0, 200) : "";
      setFormData((prev) => ({
        ...prev,
        observacion: texto,
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetForm = (anioValue, overrides = {}) => {
    const baseAnio = anioValue ?? currentYear();
    setFormData(() => {
      const nextState = {
        ...createInitialForm(baseAnio),
        ...overrides,
      };
      return aplicarPromedioDiarioAEstado(nextState);
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const empleadoId = Number(formData.id_empleado);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      setError("Selecciona el colaborador");
      return;
    }

    const anioNumero = Number(formData.anio);
    if (!Number.isInteger(anioNumero) || anioNumero < 2000) {
      setError("Ingresa un año válido");
      return;
    }

    try {
      setSubmitting(true);
      const metodo = formData.metodo === "manual" ? "manual" : "automatico";

      const periodoSeleccionado = obtenerPeriodo(formData);
      const inicioPeriodoSeleccionado =
        parseDateOnly(formData.fecha_inicio_periodo) || periodoSeleccionado.inicio;
      const finPeriodoSeleccionado =
        parseDateOnly(formData.fecha_fin_periodo) || periodoSeleccionado.fin;

      if (!inicioPeriodoSeleccionado || !finPeriodoSeleccionado) {
        setError("Selecciona un periodo de cálculo válido");
        setSubmitting(false);
        return;
      }

      if (finPeriodoSeleccionado < inicioPeriodoSeleccionado) {
        setError("La fecha fin del periodo no puede ser anterior a la fecha de inicio");
        setSubmitting(false);
        return;
      }

      const payload = {
        id_empleado: empleadoId,
        anio: anioNumero,
        metodo,
        fecha_inicio_periodo: formatDateInput(inicioPeriodoSeleccionado),
        fecha_fin_periodo: formatDateInput(finPeriodoSeleccionado),
      };

      if (metodo === "manual") {
        const tipoPagoNormalizado = normalizarTipoPago(formData.tipo_pago_empleado);
        const salarioQuincenalNumero = Number(formData.salario_quincenal);
        let salarioParaEnviar = salarioQuincenalNumero;

        if (tipoPagoNormalizado === "diario") {
          const montoPromedioNumero = Number(formData.monto_promedio_diario);
          if (!Number.isFinite(montoPromedioNumero) || montoPromedioNumero <= 0) {
            setError("Ingresa el monto promedio del periodo para el colaborador");
            setSubmitting(false);
            return;
          }

          const diasPromedioNumero = Number(formData.dias_promedio_diario);
          if (!Number.isFinite(diasPromedioNumero) || diasPromedioNumero <= 0) {
            setError("Ingresa los días laborados en el periodo de referencia");
            setSubmitting(false);
            return;
          }

          const salarioCalculado = calcularSalarioDiarioDesdePromedio(
            montoPromedioNumero,
            diasPromedioNumero
          );

          if (!salarioCalculado) {
            setError(
              "Verifica el monto promedio y los días laborados para calcular el salario diario"
            );
            setSubmitting(false);
            return;
          }

          if (!Number.isFinite(salarioParaEnviar) || salarioParaEnviar <= 0) {
            salarioParaEnviar = salarioCalculado;
          }
          const periodoPromedioNormalizado = (() => {
            const texto = String(formData.periodo_promedio_diario || "").trim().toLowerCase();
            return texto === "mes" ? "mes" : "quincena";
          })();

          payload.monto_promedio_diario = Number(montoPromedioNumero.toFixed(2));
          payload.dias_promedio_diario = Number(diasPromedioNumero.toFixed(2));
          payload.periodo_promedio_diario = periodoPromedioNormalizado;
        } else {
          if (!Number.isFinite(salarioQuincenalNumero) || salarioQuincenalNumero <= 0) {
            setError("Ingresa el monto base para calcular el aguinaldo del colaborador");
            setSubmitting(false);
            return;
          }
        }

        if (!formData.fecha_ingreso_manual) {
          setError("No se pudo determinar la fecha de ingreso del colaborador");
          setSubmitting(false);
          return;
        }

        const fechaIngreso = new Date(formData.fecha_ingreso_manual);
        if (Number.isNaN(fechaIngreso.getTime())) {
          setError("La fecha de ingreso no es válida");
          setSubmitting(false);
          return;
        }

        const salarioValido =
          Number.isFinite(salarioParaEnviar) && salarioParaEnviar > 0
            ? Number(salarioParaEnviar.toFixed(2))
            : null;

        if (!salarioValido) {
          setError("No se pudo calcular un salario diario válido para el colaborador");
          setSubmitting(false);
          return;
        }

        payload.salario_quincenal = salarioValido;
        payload.fecha_ingreso = formatDateInput(fechaIngreso);
        payload.tipo_pago = formData.tipo_pago_empleado || null;
      } else {
        payload.incluir_bonificaciones = Boolean(formData.incluir_bonificaciones);
        payload.incluir_horas_extra = Boolean(formData.incluir_horas_extra);
      }

      if (formData.observacion && typeof formData.observacion === "string") {
        const texto = formData.observacion.trim();
        if (texto) {
          payload.observacion = texto.slice(0, 200);
        }
      }

      const response = await aguinaldoService.calcular(payload);
      const message = response?.message || "Aguinaldo calculado correctamente";
      setSuccessMessage(message);
      const anioPersistir = formData.anio;
      const metodoPersistir = formData.metodo;
      const overrides =
        metodoPersistir === "automatico"
          ? {
              metodo: metodoPersistir,
              incluir_bonificaciones: Boolean(formData.incluir_bonificaciones),
              incluir_horas_extra: Boolean(formData.incluir_horas_extra),
            }
          : { metodo: metodoPersistir };
      resetForm(anioPersistir, overrides);
      await fetchAguinaldos();
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible calcular el aguinaldo";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const markAsPaid = useCallback(
    async (id, pagado) => {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      setError("");
      setSuccessMessage("");
      try {
        const response = await aguinaldoService.actualizarPago(id, pagado);
        const message = response?.message || "Estado de pago actualizado";
        setSuccessMessage(message);
        await fetchAguinaldos();
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible actualizar el estado de pago";
        setError(message);
        throw err;
      } finally {
        setActionLoading((prev) => ({ ...prev, [id]: false }));
      }
    },
    [fetchAguinaldos]
  );

  const updateAguinaldo = useCallback(
    async (id, payload) => {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      setError("");
      setSuccessMessage("");
      try {
        const response = await aguinaldoService.actualizar(id, payload);
        const message = response?.message || "Aguinaldo actualizado correctamente";
        setSuccessMessage(message);
        await fetchAguinaldos();
        return response?.aguinaldo;
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible actualizar el aguinaldo";
        setError(message);
        throw err;
      } finally {
        setActionLoading((prev) => ({ ...prev, [id]: false }));
      }
    },
    [fetchAguinaldos]
  );

  const sortedAguinaldos = useMemo(() => {
    return [...aguinaldos].sort((a, b) => {
      const anioA = Number(a.anio) || 0;
      const anioB = Number(b.anio) || 0;
      if (anioA !== anioB) {
        return anioB - anioA;
      }
      const nombreA = `${a.nombre || ""} ${a.apellido || ""}`.trim().toLowerCase();
      const nombreB = `${b.nombre || ""} ${b.apellido || ""}`.trim().toLowerCase();
      if (nombreA < nombreB) return -1;
      if (nombreA > nombreB) return 1;
      return 0;
    });
  }, [aguinaldos]);

  return {
    aguinaldos: sortedAguinaldos,
    empleados,
    empleadosLoading,
    loading,
    submitting,
    actionLoading,
    error,
    successMessage,
    formData,
    handleChange,
    handleSubmit,
    resetForm,
    markAsPaid,
    updateAguinaldo,
    isAdmin,
    setError,
    setSuccessMessage,
  };
};
