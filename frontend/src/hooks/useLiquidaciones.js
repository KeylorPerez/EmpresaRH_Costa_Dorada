import { useCallback, useEffect, useMemo, useState } from "react";
import liquidacionesService from "../services/liquidacionesService";
import empleadoService from "../services/empleadoService";
import { formatDateValue, getTodayInputValue } from "../utils/dateUtils";
import { useAuth } from "./useAuth";

const normalizeDateForApi = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }

    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().split("T")[0];
};

const createInitialForm = () => {
  const today = getTodayInputValue();
  return {
    id_empleado: "",
    salario_acumulado: "",
    vacaciones_no_gozadas: "",
    cesantia: "",
    preaviso: "",
    fecha_liquidacion: today,
    fecha_inicio_periodo: "",
    fecha_fin_periodo: today,
    motivo_liquidacion: "",
    id_estado: "1",
  };
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const toOptionalNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

const obtenerFechaInicioPeriodoEmpleado = (empleado) => {
  if (!empleado) return "";

  const posiblesClaves = [
    "fecha_inicio_periodo",
    "fechaInicioPeriodo",
    "inicio_periodo",
    "inicioPeriodo",
    "fecha_inicio",
    "fechaInicio",
    "fecha_ingreso",
    "fechaIngreso",
  ];

  for (const clave of posiblesClaves) {
    if (empleado[clave]) {
      const normalizada = normalizeDateForApi(empleado[clave]);
      if (normalizada) {
        return normalizada;
      }
    }
  }

  return "";
};

export const estadosLiquidacion = {
  1: { label: "Pendiente", badgeClass: "bg-yellow-100 text-yellow-800" },
  2: { label: "Aprobada", badgeClass: "bg-green-100 text-green-800" },
  3: { label: "Rechazada", badgeClass: "bg-red-100 text-red-800" },
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

export const calcularTotalLiquidacion = (registro) => {
  if (!registro) return 0;
  return (
    toNumber(registro.salario_acumulado) +
    toNumber(registro.vacaciones_no_gozadas) +
    toNumber(registro.cesantia) +
    toNumber(registro.preaviso)
  );
};

const buildUpdatePayload = (registro = {}, overrides = {}) => {
  const merged = { ...registro, ...overrides };

  const payload = {
    salario_acumulado: toNumber(merged.salario_acumulado),
    vacaciones_no_gozadas: toNumber(merged.vacaciones_no_gozadas),
    cesantia: toNumber(merged.cesantia),
    preaviso: toNumber(merged.preaviso),
    id_estado: Number(merged.id_estado) || 1,
    aprobado_por: toOptionalNumber(merged.aprobado_por),
    fecha_liquidacion: normalizeDateForApi(merged.fecha_liquidacion),
    fecha_inicio_periodo: normalizeDateForApi(merged.fecha_inicio_periodo),
    fecha_fin_periodo: normalizeDateForApi(merged.fecha_fin_periodo),
    motivo_liquidacion:
      typeof merged.motivo_liquidacion === "string"
        ? merged.motivo_liquidacion.trim() || null
        : merged.motivo_liquidacion || null,
  };

  payload.total_pagar =
    overrides.total_pagar !== undefined
      ? toNumber(overrides.total_pagar)
      : toNumber(merged.total_pagar) || calcularTotalLiquidacion(payload);

  return payload;
};

export const useLiquidaciones = ({ autoFetch = true } = {}) => {
  const { user } = useAuth();
  const isAdmin = user?.id_rol === 1;

  const [liquidaciones, setLiquidaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [empleadosLoading, setEmpleadosLoading] = useState(false);
  const [loading, setLoading] = useState(autoFetch);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState(() => createInitialForm());

  const fetchLiquidaciones = useCallback(async () => {
    try {
      setLoading(true);
      const data = await liquidacionesService.getAll();
      setLiquidaciones(Array.isArray(data) ? data : []);
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
    const { name, value } = event.target;

    if (name === "id_empleado") {
      const empleadoSeleccionado = empleados.find(
        (empleado) => String(empleado.id_empleado) === value
      );

      const fechaInicio = obtenerFechaInicioPeriodoEmpleado(empleadoSeleccionado);

      setFormData((prev) => ({
        ...prev,
        [name]: value,
        fecha_inicio_periodo: fechaInicio || prev.fecha_inicio_periodo || "",
      }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(createInitialForm());
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const empleadoId = Number(formData.id_empleado);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      setError("Selecciona el colaborador a liquidar");
      return;
    }

    const salarioAcumulado = Number(formData.salario_acumulado);
    if (Number.isNaN(salarioAcumulado) || salarioAcumulado <= 0) {
      setError("Ingresa el salario acumulado a liquidar");
      return;
    }

    const payload = {
      id_empleado: empleadoId,
      salario_acumulado: salarioAcumulado,
      vacaciones_no_gozadas: toNumber(formData.vacaciones_no_gozadas),
      cesantia: toNumber(formData.cesantia),
      preaviso: toNumber(formData.preaviso),
      id_estado: Number(formData.id_estado) || 1,
      fecha_liquidacion: normalizeDateForApi(formData.fecha_liquidacion),
      fecha_inicio_periodo: normalizeDateForApi(formData.fecha_inicio_periodo),
      fecha_fin_periodo: normalizeDateForApi(formData.fecha_fin_periodo),
      motivo_liquidacion:
        typeof formData.motivo_liquidacion === "string"
          ? formData.motivo_liquidacion.trim() || null
          : null,
    };

    if (payload.id_estado === 2 && user?.id_usuario) {
      payload.aprobado_por = user.id_usuario;
      if (!payload.fecha_liquidacion) {
        payload.fecha_liquidacion = normalizeDateForApi(new Date().toISOString());
      }
    }

    try {
      setSubmitting(true);
      await liquidacionesService.create(payload);
      setSuccessMessage("Liquidación registrada correctamente");
      resetForm();
      await fetchLiquidaciones();
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible registrar la liquidación";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateLiquidacion = useCallback(
    async (registro, overrides = {}) => {
      if (!registro?.id_liquidacion) return false;
      setActionLoading((prev) => ({ ...prev, [registro.id_liquidacion]: true }));
      setError("");
      setSuccessMessage("");
      try {
        const payload = buildUpdatePayload(registro, overrides);
        await liquidacionesService.update(registro.id_liquidacion, payload);
        await fetchLiquidaciones();
        return true;
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible actualizar la liquidación";
        setError(message);
        throw err;
      } finally {
        setActionLoading((prev) => ({ ...prev, [registro.id_liquidacion]: false }));
      }
    },
    [fetchLiquidaciones]
  );

  const approveLiquidacion = useCallback(
    async (registro) => {
      if (!registro) return;
      const fecha = normalizeDateForApi(
        registro.fecha_liquidacion || new Date().toISOString()
      );
      try {
        await updateLiquidacion(registro, {
          id_estado: 2,
          aprobado_por: user?.id_usuario ?? registro.aprobado_por ?? null,
          fecha_liquidacion: fecha,
        });
        setSuccessMessage("Liquidación aprobada correctamente");
      } catch {
        // El error ya se gestiona en updateLiquidacion
      }
    },
    [updateLiquidacion, user]
  );

  const rejectLiquidacion = useCallback(
    async (registro) => {
      if (!registro) return;
      try {
        await updateLiquidacion(registro, {
          id_estado: 3,
          aprobado_por: null,
        });
        setSuccessMessage("Liquidación rechazada correctamente");
      } catch {
        // El error ya se gestiona en updateLiquidacion
      }
    },
    [updateLiquidacion]
  );

  const sortedLiquidaciones = useMemo(() => {
    return [...liquidaciones].sort((a, b) => {
      const fechaA = new Date(a.fecha_liquidacion || a.created_at || 0);
      const fechaB = new Date(b.fecha_liquidacion || b.created_at || 0);
      return fechaB - fechaA;
    });
  }, [liquidaciones]);

  return {
    liquidaciones: sortedLiquidaciones,
    empleados,
    empleadosLoading,
    loading,
    submitting,
    actionLoading,
    error,
    successMessage,
    formData,
    setFormData,
    handleChange,
    handleSubmit,
    resetForm,
    approveLiquidacion,
    rejectLiquidacion,
    setError,
    setSuccessMessage,
    fetchLiquidaciones,
  };
};

