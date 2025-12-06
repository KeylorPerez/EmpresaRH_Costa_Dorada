import { useCallback, useEffect, useMemo, useState } from "react";
import prestamosService from "../services/prestamosService";
import empleadoService from "../services/empleadoService";
import { formatDateValue, getTodayInputValue } from "../utils/dateUtils";

const createInitialForm = (idEmpleadoDefault = "") => ({
  id_empleado: idEmpleadoDefault,
  monto: "",
  cuotas: "",
  interes: "",
  fecha_solicitud: getTodayInputValue(),
});

export const estadosPrestamo = {
  1: { label: "Pendiente", badgeClass: "bg-yellow-100 text-yellow-800" },
  2: { label: "Aprobado", badgeClass: "bg-green-100 text-green-800" },
  3: { label: "Rechazado", badgeClass: "bg-red-100 text-red-800" },
};

export const formatearFecha = (value) => formatDateValue(value);

export const formatearMonto = (value) => {
  if (value === undefined || value === null || value === "") return "₡0.00";
  const numero = Number(value);
  if (Number.isNaN(numero)) return value;
  return numero.toLocaleString("es-CR", {
    style: "currency",
    currency: "CRC",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  });
};

export const formatearPorcentaje = (value) => {
  if (value === undefined || value === null || value === "") return "0%";
  const numero = Number(value);
  if (Number.isNaN(numero)) return value;
  return `${numero.toFixed(2)}%`;
};

export const usePrestamos = ({ autoFetch = true, user = null, isAdmin = false } = {}) => {
  const [prestamos, setPrestamos] = useState([]);
  const [loading, setLoading] = useState(autoFetch);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState(() => createInitialForm());
  const [actionLoading, setActionLoading] = useState({});
  const [empleados, setEmpleados] = useState([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(isAdmin);

  const linkedEmpleadoId = useMemo(
    () =>
      user?.id_empleado ??
      user?.empleado_id ??
      user?.idEmpleado ??
      user?.empleadoId ??
      "",
    [user]
  );

  const fetchPrestamos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await prestamosService.getAll();
      setPrestamos(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible cargar los préstamos";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchPrestamos();
    }
  }, [autoFetch, fetchPrestamos]);

  useEffect(() => {
    const defaultId = linkedEmpleadoId ? String(linkedEmpleadoId) : "";
    setFormData((prev) => {
      if (prev.id_empleado && prev.id_empleado !== "") return prev;
      return createInitialForm(defaultId);
    });
  }, [linkedEmpleadoId]);

  const fetchEmpleados = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setLoadingEmpleados(true);
      const data = await empleadoService.getAll();
      setEmpleados(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setError((prev) => prev || "No fue posible cargar los empleados");
    } finally {
      setLoadingEmpleados(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchEmpleados();
  }, [fetchEmpleados]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    const defaultId = linkedEmpleadoId ? String(linkedEmpleadoId) : "";
    setFormData(createInitialForm(defaultId));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const montoNumber = Number(formData.monto);
    const cuotasNumber = Number(formData.cuotas);
    const interesNumber = Number(formData.interes);

    if (
      Number.isNaN(montoNumber) ||
      Number.isNaN(cuotasNumber) ||
      Number.isNaN(interesNumber)
    ) {
      setError("Verifica los valores de monto, cuotas e interés");
      return;
    }

    if (!formData.fecha_solicitud) {
      setError("Selecciona la fecha de solicitud");
      return;
    }

    if (montoNumber <= 0 || cuotasNumber <= 0) {
      setError("El monto y las cuotas deben ser mayores a cero");
      return;
    }

    if (interesNumber < 0) {
      setError("El interés no puede ser negativo");
      return;
    }

    const idEmpleadoNumber = Number(formData.id_empleado || linkedEmpleadoId);

    if (!idEmpleadoNumber || Number.isNaN(idEmpleadoNumber)) {
      setError("Selecciona el colaborador para el préstamo");
      return;
    }

    try {
      setSubmitting(true);
      await prestamosService.create({
        id_empleado: idEmpleadoNumber,
        monto: montoNumber,
        cuotas: cuotasNumber,
        interes: interesNumber,
        fecha_solicitud: formData.fecha_solicitud,
      });
      setSuccessMessage("Solicitud de préstamo enviada correctamente");
      resetForm();
      await fetchPrestamos();
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible registrar el préstamo";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const updateEstado = useCallback(
    async (id, estadoPayload) => {
      setError("");
      setSuccessMessage("");
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      try {
        await prestamosService.updateEstado(id, estadoPayload);
        await fetchPrestamos();
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible actualizar el estado";
        setError(message);
        throw err;
      } finally {
        setActionLoading((prev) => ({ ...prev, [id]: false }));
      }
    },
    [fetchPrestamos]
  );

  const approvePrestamo = useCallback(
    async (id) => {
      await updateEstado(id, { estado: "aprobado" });
      setSuccessMessage("Préstamo aprobado correctamente");
    },
    [updateEstado]
  );

  const rejectPrestamo = useCallback(
    async (id) => {
      await updateEstado(id, { estado: "rechazado" });
      setSuccessMessage("Préstamo rechazado correctamente");
    },
    [updateEstado]
  );

  const exportPrestamo = useCallback(async (id_prestamo) => {
    setError("");
    setSuccessMessage("");
    try {
      const data = await prestamosService.exportPdf(id_prestamo);
      setSuccessMessage("Documento del préstamo generado correctamente");
      return data;
    } catch (err) {
      console.error(err);
      const message =
        err.response?.data?.error || "No fue posible generar el documento";
      setError(message);
      throw err;
    }
  }, []);

  const sortedPrestamos = useMemo(() => {
    return [...prestamos].sort((a, b) => {
      const fechaA = new Date(a.fecha_solicitud || 0);
      const fechaB = new Date(b.fecha_solicitud || 0);
      return fechaB - fechaA;
    });
  }, [prestamos]);

  return {
    prestamos: sortedPrestamos,
    loading,
    submitting,
    error,
    successMessage,
    formData,
    handleChange,
    handleSubmit,
    resetForm,
    approvePrestamo,
    rejectPrestamo,
    exportPrestamo,
    actionLoading,
    setError,
    setSuccessMessage,
    fetchPrestamos,
    empleados,
    loadingEmpleados,
    linkedEmpleadoId,
    fetchEmpleados,
  };
};

export default usePrestamos;
