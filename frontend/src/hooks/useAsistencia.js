import { useCallback, useEffect, useMemo, useState } from "react";
import asistenciaService from "../services/asistenciaService";
import empleadoService from "../services/empleadoService";

export const tipoMarcaOptions = [
  { value: "entrada", label: "Entrada" },
  { value: "salida", label: "Salida" },
  { value: "almuerzo_inicio", label: "Inicio almuerzo" },
  { value: "almuerzo_fin", label: "Fin almuerzo" },
];

const tipoMarcaMap = tipoMarcaOptions.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

export const formatearFecha = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-CR", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const formatearHora = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    return value.split(".")[0];
  }
  return value;
};

const pad = (value) => value.toString().padStart(2, "0");

const createInitialForm = (isAdmin) => {
  const now = new Date();
  const fecha = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(
    now.getDate()
  )}`;
  const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return {
    id_empleado: isAdmin ? "" : undefined,
    fecha,
    hora,
    tipo_marca: "entrada",
    observaciones: "",
  };
};

export const useAsistencia = ({ mode } = {}) => {
  const isAdmin = mode === "admin";
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState(() => createInitialForm(isAdmin));
  const [submitting, setSubmitting] = useState(false);
  const [rangeFilters, setRangeFilters] = useState({ start: "", end: "" });
  const [appliedRange, setAppliedRange] = useState(null);
  const [employees, setEmployees] = useState([]);

  const [editingRegistro, setEditingRegistro] = useState(null);
  const [editForm, setEditForm] = useState({ tipo_marca: "", observaciones: "" });
  const [editLoading, setEditLoading] = useState(false);

  const fetchRegistros = useCallback(async (range) => {
    try {
      setLoading(true);
      setError("");
      let data;
      if (range?.start && range?.end) {
        data = await asistenciaService.getByRange(range.start, range.end);
      } else {
        data = await asistenciaService.getAll();
      }
      setRegistros(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible cargar la asistencia";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  useEffect(() => {
    if (!isAdmin) return;

    const loadEmployees = async () => {
      try {
        const data = await empleadoService.getAll();
        setEmployees(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error(err);
      }
    };

    loadEmployees();
  }, [isAdmin]);

  const handleRangeChange = (event) => {
    const { name, value } = event.target;
    setRangeFilters((prev) => ({ ...prev, [name]: value }));
  };

  const handleRangeSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const { start, end } = rangeFilters;
    if (!start || !end) {
      setError("Selecciona una fecha de inicio y fin");
      return;
    }

    const rangePayload = { start, end };
    await fetchRegistros(rangePayload);
    setAppliedRange(rangePayload);
  };

  const clearRangeFilters = async () => {
    setRangeFilters({ start: "", end: "" });
    setAppliedRange(null);
    await fetchRegistros();
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    if (!isAdmin && (name === "fecha" || name === "hora")) {
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(createInitialForm(isAdmin));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!formData.tipo_marca) {
      setError("Selecciona el tipo de marca");
      return;
    }

    const payload = {
      tipo_marca: formData.tipo_marca,
    };

    if (formData.observaciones) {
      payload.observaciones = formData.observaciones;
    }

    if (formData.fecha) {
      payload.fecha = formData.fecha;
    }

    if (formData.hora) {
      payload.hora = formData.hora;
    }

    if (isAdmin) {
      if (!formData.id_empleado) {
        setError("Selecciona un empleado");
        return;
      }
      payload.id_empleado = Number(formData.id_empleado);
    }

    try {
      setSubmitting(true);
      await asistenciaService.createMarca(payload);
      setSuccessMessage("Marca registrada correctamente");
      resetForm();
      await fetchRegistros(appliedRange);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible registrar la marca";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (registro) => {
    if (!isAdmin) return;
    setEditingRegistro(registro);
    setEditForm({
      tipo_marca: registro.tipo_marca || "",
      observaciones: registro.observaciones || "",
    });
    setError("");
    setSuccessMessage("");
  };

  const cancelEdit = () => {
    setEditingRegistro(null);
    setEditForm({ tipo_marca: "", observaciones: "" });
  };

  const handleEditChange = (event) => {
    const { name, value } = event.target;
    setEditForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!editingRegistro) return;

    if (!editForm.tipo_marca) {
      setError("Selecciona el tipo de marca");
      return;
    }

    try {
      setEditLoading(true);
      await asistenciaService.updateMarca(editingRegistro.id_asistencia, {
        tipo_marca: editForm.tipo_marca,
        observaciones: editForm.observaciones,
      });
      setSuccessMessage("Marca actualizada correctamente");
      cancelEdit();
      await fetchRegistros(appliedRange);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible actualizar la marca";
      setError(message);
    } finally {
      setEditLoading(false);
    }
  };

  const empleadosOptions = useMemo(() => {
    if (!isAdmin) return [];
    return employees.map((empleado) => ({
      value: empleado.id_empleado,
      label: `${empleado.nombre} ${empleado.apellido}`.trim(),
    }));
  }, [employees, isAdmin]);

  const registrosOrdenados = useMemo(() => {
    return [...registros].sort((a, b) => {
      const fechaA = new Date(a.fecha || 0);
      const fechaB = new Date(b.fecha || 0);
      if (fechaA.getTime() !== fechaB.getTime()) {
        return fechaB - fechaA;
      }
      const horaA = (a.hora || "").toString();
      const horaB = (b.hora || "").toString();
      return horaB.localeCompare(horaA);
    });
  }, [registros]);

  return {
    registros: registrosOrdenados,
    loading,
    error,
    successMessage,
    formData,
    handleChange,
    handleSubmit,
    submitting,
    resetForm,
    tipoMarcaOptions,
    rangeFilters,
    handleRangeChange,
    handleRangeSubmit,
    clearRangeFilters,
    empleadosOptions,
    editingRegistro,
    startEdit,
    cancelEdit,
    editForm,
    handleEditChange,
    handleEditSubmit,
    editLoading,
    setError,
    setSuccessMessage,
  };
};

export const obtenerEtiquetaTipo = (tipo) => tipoMarcaMap[tipo] || tipo;
