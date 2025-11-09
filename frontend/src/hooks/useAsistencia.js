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

export const estadoOptions = [
  { value: "Presente", label: "Presente" },
  { value: "Ausente", label: "Ausente" },
  { value: "Permiso", label: "Permiso" },
  { value: "Vacaciones", label: "Vacaciones" },
  { value: "Incapacidad", label: "Incapacidad" },
];

const estadoMap = estadoOptions.reduce((acc, option) => {
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

const createDefaultRange = () => {
  const now = new Date();
  const startDay = now.getDate() <= 15 ? 1 : 16;
  const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const endDay = now.getDate() <= 15 ? 15 : lastDayOfMonth;
  const month = pad(now.getMonth() + 1);
  const year = now.getFullYear();

  return {
    start: `${year}-${month}-${pad(startDay)}`,
    end: `${year}-${month}-${pad(endDay)}`,
  };
};

const DEFAULT_LATITUDE =
  import.meta.env.VITE_BUSINESS_LATITUDE ??
  import.meta.env.VITE_OFFICE_LATITUDE ??
  "10.372951";
const DEFAULT_LONGITUDE =
  import.meta.env.VITE_BUSINESS_LONGITUDE ??
  import.meta.env.VITE_OFFICE_LONGITUDE ??
  "-83.728955";

const parseCoordinateInput = (value) => {
  if (value === undefined || value === null) return null;
  const asString = value.toString().trim();
  if (!asString) return null;
  const parsed = Number(asString);
  return Number.isFinite(parsed) ? parsed : null;
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
    estado: "Presente",
    justificado: false,
    justificacion: "",
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
  const defaultRange = useMemo(() => createDefaultRange(), []);
  const [rangeFilters, setRangeFilters] = useState(defaultRange);
  const [appliedRange, setAppliedRange] = useState(defaultRange);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpleado, setSelectedEmpleado] = useState("");
  const [exportingFormat, setExportingFormat] = useState(null);

  const [editingRegistro, setEditingRegistro] = useState(null);
  const [editForm, setEditForm] = useState({
    tipo_marca: "",
    observaciones: "",
    estado: "Presente",
    justificado: false,
    justificacion: "",
  });
  const [editLoading, setEditLoading] = useState(false);

  const defaultLocation = useMemo(
    () => ({
      latitud: isAdmin ? DEFAULT_LATITUDE || "" : "",
      longitud: isAdmin ? DEFAULT_LONGITUDE || "" : "",
    }),
    [isAdmin]
  );

  const [location, setLocation] = useState(defaultLocation);
  const [locationStatus, setLocationStatus] = useState({ loading: false, error: "" });
  const [supportsGeolocation] = useState(
    () => typeof window !== "undefined" && typeof navigator !== "undefined" && "geolocation" in navigator
  );

  useEffect(() => {
    setLocation(defaultLocation);
  }, [defaultLocation]);

  const resetLocation = useCallback(() => {
    setLocation(defaultLocation);
    setLocationStatus({ loading: false, error: "" });
  }, [defaultLocation]);

  const fetchRegistros = useCallback(async (range) => {
    try {
      setLoading(true);
      setError("");
      let data;
      if (range?.start && range?.end) {
        data = await asistenciaService.getByRange(
          range.start,
          range.end,
          isAdmin ? range?.id_empleado : undefined
        );
      } else {
        data = await asistenciaService.getAll();
      }
      const registrosNormalizados = Array.isArray(data)
        ? data.map((registro) => ({
            ...registro,
            estado: registro.estado || "Presente",
            justificado:
              registro.justificado === true ||
              registro.justificado === 1 ||
              registro.justificado === "1",
            justificacion:
              registro.justificacion === undefined || registro.justificacion === null
                ? ""
                : registro.justificacion,
          }))
        : [];
      setRegistros(registrosNormalizados);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible cargar la asistencia";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchRegistros({ ...defaultRange });
  }, [fetchRegistros, defaultRange]);

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

    const rangePayload = {
      start,
      end,
      ...(isAdmin && selectedEmpleado
        ? { id_empleado: Number(selectedEmpleado) }
        : {}),
    };
    await fetchRegistros(rangePayload);
    setAppliedRange({ start, end });
  };

  const clearRangeFilters = async () => {
    const fallbackRange = { ...defaultRange };
    setRangeFilters(fallbackRange);
    setAppliedRange(fallbackRange);
    setError("");
    setSuccessMessage("");
    await fetchRegistros({
      ...fallbackRange,
      ...(isAdmin && selectedEmpleado
        ? { id_empleado: Number(selectedEmpleado) }
        : {}),
    });
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    if (
      !isAdmin &&
      (name === "fecha" || name === "hora" || name === "estado" || name === "justificado" || name === "justificacion")
    ) {
      return;
    }
    const nextValue = type === "checkbox" ? checked : value;
    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  };

  const resetForm = () => {
    setFormData(createInitialForm(isAdmin));
    resetLocation();
  };

  const handleEmpleadoSelect = (event) => {
    const value = event.target.value || "";
    setSelectedEmpleado(value);

    if (!isAdmin) return;
    if (!appliedRange?.start || !appliedRange?.end) return;

    fetchRegistros({
      start: appliedRange.start,
      end: appliedRange.end,
      ...(value ? { id_empleado: Number(value) } : {}),
    });
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
      payload.estado = formData.estado || "Presente";
      payload.justificado = Boolean(formData.justificado);
      const justificacionTexto =
        typeof formData.justificacion === "string" ? formData.justificacion.trim() : "";
      payload.justificacion = payload.justificado ? justificacionTexto : "";
    }

    let latitudValue = parseCoordinateInput(location.latitud);
    let longitudValue = parseCoordinateInput(location.longitud);

    if (!isAdmin && (latitudValue === null || longitudValue === null)) {
      try {
        const coords = await requestLocation();
        latitudValue = parseCoordinateInput(coords?.latitud);
        longitudValue = parseCoordinateInput(coords?.longitud);
      } catch (locationError) {
        const message =
          locationError?.message ||
          locationStatus.error ||
          "Debes capturar tu ubicación antes de registrar la marca";
        setError(message);
        return;
      }
    }

    if (!isAdmin && (latitudValue === null || longitudValue === null)) {
      setError("Debes capturar tu ubicación antes de registrar la marca");
      return;
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
      await fetchRegistros({
        ...(appliedRange?.start && appliedRange?.end
          ? appliedRange
          : defaultRange),
        ...(isAdmin && selectedEmpleado
          ? { id_empleado: Number(selectedEmpleado) }
          : {}),
      });
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
      estado: registro.estado || "Presente",
      justificado:
        registro.justificado === true || registro.justificado === 1 || registro.justificado === "1",
      justificacion:
        registro.justificacion === undefined || registro.justificacion === null
          ? ""
          : registro.justificacion,
    });
    setError("");
    setSuccessMessage("");
  };

  const cancelEdit = () => {
    setEditingRegistro(null);
    setEditForm({
      tipo_marca: "",
      observaciones: "",
      estado: "Presente",
      justificado: false,
      justificacion: "",
    });
  };

  const handleEditChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === "checkbox" ? checked : value;
    setEditForm((prev) => ({ ...prev, [name]: nextValue }));
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
      const payload = {
        tipo_marca: editForm.tipo_marca,
        observaciones: editForm.observaciones,
        estado: editForm.estado || "Presente",
        justificado: Boolean(editForm.justificado),
      };

      const justificacionTexto =
        typeof editForm.justificacion === "string" ? editForm.justificacion.trim() : "";
      payload.justificacion = payload.justificado ? justificacionTexto : "";

      await asistenciaService.updateMarca(editingRegistro.id_asistencia, payload);
      setSuccessMessage("Marca actualizada correctamente");
      cancelEdit();
      await fetchRegistros({
        ...(appliedRange?.start && appliedRange?.end
          ? appliedRange
          : defaultRange),
        ...(isAdmin && selectedEmpleado
          ? { id_empleado: Number(selectedEmpleado) }
          : {}),
      });
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible actualizar la marca";
      setError(message);
    } finally {
      setEditLoading(false);
    }
  };

  const exportAsistencia = async (format, { openInNewTab = true, silent = false } = {}) => {
    if (!appliedRange?.start || !appliedRange?.end) {
      setError("Selecciona un rango de fechas antes de exportar.");
      return null;
    }

    if (isAdmin && !selectedEmpleado) {
      setError("Selecciona un empleado para exportar su asistencia.");
      return null;
    }

    setError("");
    if (!silent) {
      setSuccessMessage("");
    }

    try {
      setExportingFormat(format);
      const response = await asistenciaService.exportByRange({
        start: appliedRange.start,
        end: appliedRange.end,
        format,
        id_empleado:
          isAdmin && selectedEmpleado ? Number(selectedEmpleado) : undefined,
      });

      const fileUrl = response?.url;
      const responseFormat = response?.format || format;
      const filename = response?.filename || "";

      if (!fileUrl) {
        throw new Error("No se recibió la URL del archivo exportado.");
      }

      if (openInNewTab && typeof window !== "undefined") {
        window.open(fileUrl, "_blank", "noopener");
      }

      if (!silent) {
        setSuccessMessage(
          responseFormat === "excel"
            ? "Reporte de asistencia en Excel generado correctamente."
            : "Reporte de asistencia en PDF generado correctamente."
        );
      }

      return { url: fileUrl, filename, format: responseFormat };
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || err.message || "No fue posible exportar la asistencia.";
      setError(message);
      return null;
    } finally {
      setExportingFormat(null);
    }
  };

  const shareAsistencia = async () => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      setError("La función de compartir no está disponible en este dispositivo.");
      return;
    }

    setError("");
    setSuccessMessage("");

    const exportData = await exportAsistencia("pdf", { openInNewTab: false, silent: true });
    if (!exportData?.url) {
      return;
    }

    const { url, filename } = exportData;
    const fallbackName =
      filename ||
      `asistencia-${appliedRange?.start ?? "inicio"}-${appliedRange?.end ?? "fin"}.pdf`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("No se pudo descargar el PDF generado.");
      }

      const blob = await response.blob();
      const fileType = blob.type || "application/pdf";
      const fileName = fallbackName.endsWith(".pdf") ? fallbackName : `${fallbackName}.pdf`;
      const file = new File([blob], fileName, { type: fileType });

      if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
        throw new Error("Este dispositivo no permite compartir archivos PDF.");
      }

      await navigator.share({
        files: [file],
        title: "Reporte de asistencia",
        text: "Te comparto el reporte de asistencia generado desde EmpresaRH.",
      });

      setSuccessMessage("Reporte de asistencia compartido correctamente.");
    } catch (shareError) {
      console.error(shareError);
      const message =
        shareError.response?.data?.error ||
        shareError.message ||
        "No fue posible compartir el reporte de asistencia.";
      setError(message);
    }
  };

  const requestLocation = useCallback(() => {
    if (!supportsGeolocation) {
      const message = "Tu navegador no soporta geolocalización.";
      setLocationStatus({ loading: false, error: message });
      return Promise.reject(new Error(message));
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
          reject(new Error(message));
        }
      );
    });
  }, [supportsGeolocation]);

  useEffect(() => {
    if (isAdmin || !supportsGeolocation) return;
    if (location.latitud && location.longitud) return;

    requestLocation().catch(() => {
      /* El error ya se gestiona en locationStatus */
    });
  }, [isAdmin, supportsGeolocation, requestLocation, location.latitud, location.longitud]);

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
    selectedEmpleado,
    handleEmpleadoSelect,
    exportingFormat,
    exportAsistencia,
    shareAsistencia,
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
export const obtenerEtiquetaEstado = (estado) => estadoMap[estado] || estado || "Presente";
