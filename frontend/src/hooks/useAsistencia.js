import { useCallback, useEffect, useMemo, useState } from "react";
import asistenciaService from "../services/asistenciaService";
import empleadoService from "../services/empleadoService";
import { formatDateValue } from "../utils/dateUtils";

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

export const formatearFecha = (value) => formatDateValue(value);

export const formatearHora = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    return value.split(".")[0];
  }
  return value;
};

const pad = (value) => value.toString().padStart(2, "0");

const parseCoordinateInput = (value) => {
  if (value === undefined || value === null) return null;
  const asString = value.toString().trim();
  if (!asString) return null;
  const parsed = Number(asString);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeDefaultCoordinate = (value) => {
  if (value === undefined || value === null || value === "") return "";
  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric.toFixed(6);
  }
  return value.toString();
};

const resolveDefaultAdminLocation = () => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    const lat = import.meta.env.VITE_EMPRESA_LATITUD;
    const lon = import.meta.env.VITE_EMPRESA_LONGITUD;
    return {
      latitud: normalizeDefaultCoordinate(lat),
      longitud: normalizeDefaultCoordinate(lon),
    };
  }
  return { latitud: "", longitud: "" };
};

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

  const defaultAdminLocation = useMemo(() => resolveDefaultAdminLocation(), []);
  const createInitialLocation = useCallback(
    () => (isAdmin ? { ...defaultAdminLocation } : { latitud: "", longitud: "" }),
    [isAdmin, defaultAdminLocation]
  );

  const [location, setLocation] = useState(() => createInitialLocation());
  const [locationStatus, setLocationStatus] = useState({ loading: false, error: "" });
  const [supportsGeolocation] = useState(
    () => typeof window !== "undefined" && typeof navigator !== "undefined" && "geolocation" in navigator
  );

  useEffect(() => {
    if (!supportsGeolocation && !isAdmin) {
      setLocationStatus({
        loading: false,
        error:
          "Tu navegador no soporta geolocalización automática. Comunícate con tu administrador para registrar la asistencia.",
      });
    }
  }, [supportsGeolocation, isAdmin]);

  const resetLocation = useCallback(() => {
    setLocation(createInitialLocation());
    setLocationStatus({
      loading: false,
      error:
        !supportsGeolocation && !isAdmin
          ? "Tu navegador no soporta geolocalización automática. Comunícate con tu administrador para registrar la asistencia."
          : "",
    });
  }, [createInitialLocation, supportsGeolocation, isAdmin]);

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
    resetLocation();
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

    let latitudValue = parseCoordinateInput(location.latitud);
    let longitudValue = parseCoordinateInput(location.longitud);

    if (!isAdmin) {
      if (supportsGeolocation && (latitudValue === null || longitudValue === null)) {
        try {
          const coords = await requestLocation();
          if (coords) {
            latitudValue = parseCoordinateInput(coords.latitud);
            longitudValue = parseCoordinateInput(coords.longitud);
          }
        } catch (geoError) {
          setError(geoError.message || "No fue posible obtener la ubicación actual.");
          return;
        }
      }

      if (latitudValue === null || longitudValue === null) {
        const message = supportsGeolocation
          ? "Debes permitir el acceso a tu ubicación para registrar la asistencia."
          : "No fue posible obtener la ubicación del dispositivo.";
        setError(message);
        return;
      }
    }

    if ((latitudValue === null) !== (longitudValue === null)) {
      setError("Completa la latitud y la longitud para registrar la ubicación");
      return;
    }

    if (latitudValue !== null && longitudValue !== null) {
      payload.latitud = latitudValue;
      payload.longitud = longitudValue;
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

  const requestLocation = useCallback(() => {
    if (!supportsGeolocation) {
      const message = "Tu navegador no soporta geolocalización.";
      setLocationStatus({ loading: false, error: message });
      return Promise.resolve(null);
    }

    setLocationStatus({ loading: true, error: "" });

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            latitud: position.coords.latitude.toFixed(6),
            longitud: position.coords.longitude.toFixed(6),
          };
          setLocation(coords);
          setLocationStatus({ loading: false, error: "" });
          resolve(coords);
        },
        (geoError) => {
          let message = "No fue posible obtener la ubicación";
          if (geoError.code === geoError.PERMISSION_DENIED) {
            message = "Debes permitir el acceso a tu ubicación para registrar la asistencia.";
          } else if (geoError.code === geoError.POSITION_UNAVAILABLE) {
            message = "La ubicación actual no está disponible.";
          } else if (geoError.code === geoError.TIMEOUT) {
            message = "La solicitud de ubicación excedió el tiempo de espera.";
          }
          setLocationStatus({ loading: false, error: message });
          const error = new Error(message);
          error.code = geoError.code;
          reject(error);
        }
      );
    });
  }, [supportsGeolocation]);

  const updateLocationField = useCallback((field, value) => {
    setLocation((prev) => ({ ...prev, [field]: value }));
  }, []);

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
    location,
    locationStatus,
    supportsGeolocation,
    requestLocation,
    updateLocationField,
    resetLocation,
  };
};

export const obtenerEtiquetaTipo = (tipo) => tipoMarcaMap[tipo] || tipo;
