import { useCallback, useEffect, useMemo, useState } from "react";
import vacacionesService from "../services/vacacionesService";
import empleadoService from "../services/empleadoService";
import { formatDateValue } from "../utils/dateUtils";

const createInitialForm = (defaultEmpleado = "") => ({
  id_empleado: defaultEmpleado,
  fecha_inicio: "",
  fecha_fin: "",
  motivo: "",
});

export const useVacaciones = ({ autoFetch = true, isAdmin = false, user = null } = {}) => {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(autoFetch);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState(() => createInitialForm());
  const [empleados, setEmpleados] = useState([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(isAdmin);

  const linkedEmpleadoId = useMemo(() => {
    const candidate =
      user?.id_empleado ?? user?.empleado_id ?? user?.idEmpleado ?? user?.empleadoId;
    const parsed = Number(candidate);
    if (Number.isFinite(parsed)) {
      return String(parsed);
    }
    return "";
  }, [user]);

  const fetchSolicitudes = useCallback(async () => {
    try {
      setLoading(true);
      const data = await vacacionesService.getAll();
      setSolicitudes(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "Error al cargar las solicitudes";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchSolicitudes();
    }
  }, [autoFetch, fetchSolicitudes]);

  useEffect(() => {
    const defaultId = linkedEmpleadoId || "";
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
    const defaultId = linkedEmpleadoId || "";
    setFormData(createInitialForm(defaultId));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!formData.fecha_inicio || !formData.fecha_fin) {
      setError("Selecciona la fecha de inicio y fin");
      return;
    }

    const start = new Date(formData.fecha_inicio);
    const end = new Date(formData.fecha_fin);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Las fechas seleccionadas no son válidas");
      return;
    }

    if (end < start) {
      setError("La fecha fin debe ser igual o posterior a la fecha inicio");
      return;
    }

    const selectedEmpleado = Number(formData.id_empleado || linkedEmpleadoId);

    if (isAdmin && (!selectedEmpleado || Number.isNaN(selectedEmpleado))) {
      setError("Selecciona el empleado para la solicitud");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        fecha_inicio: formData.fecha_inicio,
        fecha_fin: formData.fecha_fin,
      };

      if (selectedEmpleado && !Number.isNaN(selectedEmpleado)) {
        payload.id_empleado = selectedEmpleado;
      }

      if (formData.motivo.trim()) {
        payload.motivo = formData.motivo.trim();
      }

      await vacacionesService.create(payload);
      setSuccessMessage("Solicitud enviada correctamente");
      resetForm();
      await fetchSolicitudes();
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible registrar la solicitud";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const approveSolicitud = useCallback(
    async (id_vacacion, dias_aprobados) => {
      setError("");
      setSuccessMessage("");
      try {
        await vacacionesService.approve(id_vacacion, dias_aprobados);
        setSuccessMessage("Solicitud aprobada correctamente");
        await fetchSolicitudes();
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible aprobar la solicitud";
        setError(message);
        throw err;
      }
    },
    [fetchSolicitudes]
  );

  const rejectSolicitud = useCallback(
    async (id_vacacion) => {
      setError("");
      setSuccessMessage("");
      try {
        await vacacionesService.reject(id_vacacion);
        setSuccessMessage("Solicitud rechazada correctamente");
        await fetchSolicitudes();
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible rechazar la solicitud";
        setError(message);
        throw err;
      }
    },
    [fetchSolicitudes]
  );


  const deleteSolicitud = useCallback(
    async (id_vacacion) => {
      setError("");
      setSuccessMessage("");
      try {
        await vacacionesService.remove(id_vacacion);
        setSuccessMessage("Solicitud eliminada correctamente");
        await fetchSolicitudes();
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible eliminar la solicitud";
        setError(message);
        throw err;
      }
    },
    [fetchSolicitudes]
  );

  const exportSolicitud = useCallback(async (id_vacacion) => {
    setError("");
    setSuccessMessage("");
    try {
      const data = await vacacionesService.exportPdf(id_vacacion);
      setSuccessMessage("Documento de vacaciones generado correctamente");
      return data;
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible generar el documento";
      setError(message);
      throw err;
    }
  }, []);

  const sortedSolicitudes = useMemo(() => {
    return [...solicitudes].sort((a, b) => {
      const dateA = new Date(a.fecha_inicio);
      const dateB = new Date(b.fecha_inicio);
      return dateB - dateA;
    });
  }, [solicitudes]);

  return {
    solicitudes: sortedSolicitudes,
    loading,
    submitting,
    error,
    successMessage,
    formData,
    setFormData,
    handleChange,
    handleSubmit,
    resetForm,
    fetchSolicitudes,
    approveSolicitud,
    rejectSolicitud,
    deleteSolicitud,
    exportSolicitud,
    setError,
    setSuccessMessage,
    empleados,
    loadingEmpleados,
  };
};

export const estadoVacaciones = {
  1: { label: "Pendiente", badgeClass: "bg-yellow-100 text-yellow-800" },
  2: { label: "Aprobado", badgeClass: "bg-green-100 text-green-800" },
  3: { label: "Rechazado", badgeClass: "bg-red-100 text-red-800" },
};

export const formatearFecha = (value) => formatDateValue(value);

export const diasSolicitados = (inicio, fin) => {
  const start = new Date(inicio);
  const end = new Date(fin);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.abs(end - start);
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
};

export default useVacaciones;
