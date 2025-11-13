import { useCallback, useEffect, useMemo, useState } from "react";
import liquidacionesService from "../services/liquidacionesService";
import empleadoService from "../services/empleadoService";
import { formatDateValue, getTodayInputValue } from "../utils/dateUtils";
import { useAuth } from "./useAuth";

const sanitizeOptionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return null;
  return parsed;
};

const normalizeDateForApi = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().split("T")[0];
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split("T")[0];
};

const calculateTotalsFromDetails = (detalles = []) => {
  return detalles.reduce(
    (acc, detalle) => {
      const montoBase =
        detalle.monto_final !== null && detalle.monto_final !== undefined
          ? Number(detalle.monto_final)
          : Number(detalle.monto_calculado);

      if (Number.isNaN(montoBase)) {
        return acc;
      }

      if (detalle.tipo === "DESCUENTO") {
        acc.totalDescuentos += montoBase;
      } else {
        acc.totalIngresos += montoBase;
      }

      acc.total_pagar = acc.totalIngresos - acc.totalDescuentos;
      return acc;
    },
    { totalIngresos: 0, totalDescuentos: 0, total_pagar: 0 }
  );
};

export const estadosLiquidacion = {
  1: { label: "Borrador", badgeClass: "bg-slate-200 text-slate-800" },
  2: { label: "Confirmada", badgeClass: "bg-green-200 text-green-800" },
  3: { label: "Rechazada", badgeClass: "bg-red-200 text-red-800" },
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

const createInitialDraft = () => ({
  id_empleado: "",
  fecha_inicio_periodo: "",
  fecha_fin_periodo: "",
  fecha_liquidacion: getTodayInputValue(),
  motivo_liquidacion: "",
  observaciones: "",
});

export const useLiquidaciones = ({ autoFetch = true } = {}) => {
  const { user } = useAuth();
  const isAdmin = user?.id_rol === 1;

  const [liquidaciones, setLiquidaciones] = useState([]);
  const [loading, setLoading] = useState(autoFetch);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [empleados, setEmpleados] = useState([]);
  const [empleadosLoading, setEmpleadosLoading] = useState(false);

  const [draftForm, setDraftForm] = useState(() => createInitialDraft());
  const [draftDetalles, setDraftDetalles] = useState([]);
  const [draftTotales, setDraftTotales] = useState({
    totalIngresos: 0,
    totalDescuentos: 0,
    total_pagar: 0,
  });
  const [previewData, setPreviewData] = useState(null);
  const [detalleSeleccionado, setDetalleSeleccionado] = useState(null);
  const [detalleLoading, setDetalleLoading] = useState(false);

  const fetchLiquidaciones = useCallback(async () => {
    try {
      setLoading(true);
      const data = await liquidacionesService.getAll();
      const registros = Array.isArray(data) ? data : [];
      const ordenados = registros.sort((a, b) => {
        const fechaA = new Date(a.fecha_liquidacion || a.created_at || 0);
        const fechaB = new Date(b.fecha_liquidacion || b.created_at || 0);
        return fechaB - fechaA;
      });
      setLiquidaciones(ordenados);
      setError("");
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible cargar las liquidaciones";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchLiquidaciones();
    }
  }, [autoFetch, fetchLiquidaciones]);

  useEffect(() => {
    if (!draftForm.id_empleado) return;

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === String(draftForm.id_empleado)
    );

    if (!empleadoSeleccionado) return;

    setDraftForm((prev) => {
      const updates = {};
      let changed = false;

      if (empleadoSeleccionado.fecha_ingreso) {
        const inicioNormalizado = normalizeDateForApi(empleadoSeleccionado.fecha_ingreso);
        if (inicioNormalizado && prev.fecha_inicio_periodo !== inicioNormalizado) {
          updates.fecha_inicio_periodo = inicioNormalizado;
          changed = true;
        }
      }

      if (!prev.fecha_fin_periodo || !String(prev.fecha_fin_periodo).trim()) {
        updates.fecha_fin_periodo = getTodayInputValue();
        changed = true;
      }

      return changed ? { ...prev, ...updates } : prev;
    });
  }, [draftForm.id_empleado, empleados]);

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

  const handleDraftChange = (event) => {
    const { name, value } = event.target;
    setDraftForm((prev) => ({ ...prev, [name]: value }));
  };

  const resetDraft = useCallback(() => {
    setDraftForm(createInitialDraft());
    setDraftDetalles([]);
    setDraftTotales({ totalIngresos: 0, totalDescuentos: 0, total_pagar: 0 });
    setPreviewData(null);
  }, []);

  const actualizarTotales = useCallback((detallesActualizados) => {
    const totalesCalculados = calculateTotalsFromDetails(detallesActualizados);
    setDraftTotales({
      totalIngresos: Number(totalesCalculados.totalIngresos.toFixed(2)),
      totalDescuentos: Number(totalesCalculados.totalDescuentos.toFixed(2)),
      total_pagar: Number(totalesCalculados.total_pagar.toFixed(2)),
    });
  }, []);

  const generarPreview = useCallback(async () => {
    try {
      setSubmitting(true);
      setSuccessMessage("");
      setError("");

      const payload = {
        id_empleado: draftForm.id_empleado,
        fecha_inicio_periodo: normalizeDateForApi(draftForm.fecha_inicio_periodo),
        fecha_fin_periodo: normalizeDateForApi(draftForm.fecha_fin_periodo),
        fecha_liquidacion: normalizeDateForApi(draftForm.fecha_liquidacion),
        motivo_liquidacion: draftForm.motivo_liquidacion,
        observaciones: draftForm.observaciones,
        detalles: draftDetalles,
      };

      const data = await liquidacionesService.preview(payload);
      const encabezado = data?.encabezado || {};

      setDraftForm((prev) => ({
        ...prev,
        fecha_inicio_periodo: encabezado.fecha_inicio_periodo || prev.fecha_inicio_periodo,
        fecha_fin_periodo: encabezado.fecha_fin_periodo || prev.fecha_fin_periodo,
        fecha_liquidacion: encabezado.fecha_liquidacion || prev.fecha_liquidacion || getTodayInputValue(),
      }));
      setPreviewData(data);
      setDraftDetalles(data.detalles || []);
      actualizarTotales(data.detalles || []);
      setSuccessMessage("Borrador generado correctamente");
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible generar la previsualización";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }, [draftForm, draftDetalles, actualizarTotales]);

  const actualizarDetalle = useCallback((index, campo, valor) => {
    setDraftDetalles((prev) => {
      const copia = [...prev];
      if (!copia[index]) return prev;

      const detalleActual = copia[index];
      if (campo === "monto_final") {
        const monto = sanitizeOptionalNumber(valor);
        copia[index] = { ...detalleActual, monto_final: monto };
      } else if (campo === "comentario") {
        copia[index] = { ...detalleActual, comentario: valor };
      } else if (campo === "tipo") {
        copia[index] = { ...detalleActual, tipo: valor === "DESCUENTO" ? "DESCUENTO" : "INGRESO" };
      } else if (campo === "concepto") {
        copia[index] = { ...detalleActual, concepto: valor };
      }

      return copia;
    });
  }, []);

  useEffect(() => {
    actualizarTotales(draftDetalles);
  }, [draftDetalles, actualizarTotales]);

  const agregarDetalleManual = useCallback(() => {
    setDraftDetalles((prev) => [
      ...prev,
      {
        concepto: "Nuevo concepto",
        tipo: "INGRESO",
        monto_calculado: 0,
        monto_final: 0,
        editable: 1,
        formula_usada: null,
        comentario: "",
      },
    ]);
  }, []);

  const eliminarDetalle = useCallback((index) => {
    setDraftDetalles((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const guardarLiquidacion = useCallback(
    async ({ confirmar = false } = {}) => {
      try {
        setSubmitting(true);
        setSuccessMessage("");
        setError("");

        const payload = {
          id_empleado: draftForm.id_empleado,
          fecha_inicio_periodo: normalizeDateForApi(draftForm.fecha_inicio_periodo),
          fecha_fin_periodo: normalizeDateForApi(draftForm.fecha_fin_periodo),
          fecha_liquidacion: normalizeDateForApi(draftForm.fecha_liquidacion),
          motivo_liquidacion: draftForm.motivo_liquidacion,
          observaciones: draftForm.observaciones,
          detalles: draftDetalles,
          confirmar,
        };

        await liquidacionesService.create(payload);
        setSuccessMessage(confirmar ? "Liquidación confirmada" : "Borrador guardado");
        resetDraft();
        fetchLiquidaciones();
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible guardar la liquidación";
        setError(message);
      } finally {
        setSubmitting(false);
      }
    },
    [draftForm, draftDetalles, fetchLiquidaciones, resetDraft]
  );

  const setEstadoEnServidor = useCallback(
    async (registro, nuevoEstado) => {
      if (!registro?.id_liquidacion) return;
      setActionLoading((prev) => ({ ...prev, [registro.id_liquidacion]: true }));
      try {
        const payload = { id_estado: nuevoEstado };
        if (nuevoEstado === 2 && user?.id_usuario) {
          payload.aprobado_por = user.id_usuario;
        }
        if (nuevoEstado !== 2) {
          payload.aprobado_por = null;
        }

        await liquidacionesService.update(registro.id_liquidacion, payload);
        await fetchLiquidaciones();
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible actualizar la liquidación";
        setError(message);
      } finally {
        setActionLoading((prev) => ({ ...prev, [registro.id_liquidacion]: false }));
      }
    },
    [fetchLiquidaciones, user]
  );

  const approveLiquidacion = useCallback(
    async (registro) => {
      await setEstadoEnServidor(registro, 2);
    },
    [setEstadoEnServidor]
  );

  const rejectLiquidacion = useCallback(
    async (registro) => {
      await setEstadoEnServidor(registro, 3);
    },
    [setEstadoEnServidor]
  );

  const openLiquidacion = useCallback(async (id_liquidacion) => {
    if (!id_liquidacion) {
      setDetalleSeleccionado(null);
      return;
    }
    try {
      setDetalleLoading(true);
      const data = await liquidacionesService.getById(id_liquidacion);
      setDetalleSeleccionado(data);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible cargar el detalle de la liquidación";
      setError((prev) => prev || message);
    } finally {
      setDetalleLoading(false);
    }
  }, []);

  const sortedLiquidaciones = useMemo(() => liquidaciones, [liquidaciones]);

  return {
    liquidaciones: sortedLiquidaciones,
    loading,
    error,
    successMessage,
    setError,
    setSuccessMessage,
    empleados,
    empleadosLoading,
    draftForm,
    draftDetalles,
    draftTotales,
    previewData,
    detalleSeleccionado,
    detalleLoading,
    handleDraftChange,
    generarPreview,
    actualizarDetalle,
    agregarDetalleManual,
    eliminarDetalle,
    guardarLiquidacion,
    resetDraft,
    submitting,
    actionLoading,
    approveLiquidacion,
    rejectLiquidacion,
    openLiquidacion,
  };
};
