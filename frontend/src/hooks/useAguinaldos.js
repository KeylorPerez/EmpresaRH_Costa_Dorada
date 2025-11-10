import { useCallback, useEffect, useMemo, useState } from "react";
import aguinaldoService from "../services/aguinaldoService";
import empleadoService from "../services/empleadoService";
import { formatDateValue } from "../utils/dateUtils";
import { useAuth } from "./useAuth";

const currentYear = () => new Date().getFullYear().toString();

const createInitialForm = () => ({
  id_empleado: "",
  anio: currentYear(),
  metodo: "manual",
  salario_quincenal: "",
  fecha_ingreso_manual: "",
  incluir_bonificaciones: true,
  incluir_horas_extra: false,
  tipo_pago_empleado: "",
});

const formatDateInput = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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
        return {
          ...prev,
          id_empleado: value,
          fecha_ingreso_manual: formatDateInput(selected?.fecha_ingreso),
          salario_quincenal:
            selected?.salario_monto !== undefined && selected?.salario_monto !== null
              ? String(Number(selected.salario_monto) || "")
              : "",
          tipo_pago_empleado: selected?.tipo_pago || "",
        };
      });
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const resetForm = (anioValue, overrides = {}) => {
    setFormData({
      ...createInitialForm(),
      anio: anioValue ?? currentYear(),
      ...overrides,
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

      const payload = {
        id_empleado: empleadoId,
        anio: anioNumero,
        metodo,
      };

      if (metodo === "manual") {
        const salarioQuincenalNumero = Number(formData.salario_quincenal);
        if (!Number.isFinite(salarioQuincenalNumero) || salarioQuincenalNumero <= 0) {
          setError("Ingresa el salario quincenal fijo del colaborador");
          setSubmitting(false);
          return;
        }

        if (!formData.fecha_ingreso_manual) {
          setError("Ingresa o confirma la fecha de ingreso del colaborador");
          setSubmitting(false);
          return;
        }

        const fechaIngreso = new Date(formData.fecha_ingreso_manual);
        if (Number.isNaN(fechaIngreso.getTime())) {
          setError("La fecha de ingreso no es válida");
          setSubmitting(false);
          return;
        }

        payload.salario_quincenal = salarioQuincenalNumero;
        payload.fecha_ingreso = formatDateInput(fechaIngreso);
        payload.tipo_pago = formData.tipo_pago_empleado || null;
      } else {
        payload.incluir_bonificaciones = Boolean(formData.incluir_bonificaciones);
        payload.incluir_horas_extra = Boolean(formData.incluir_horas_extra);
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
    isAdmin,
    setError,
    setSuccessMessage,
  };
};
