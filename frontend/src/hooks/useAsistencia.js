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

export const tipoJustificacionOptions = [
  { value: "Permiso con goce", label: "Permiso con goce" },
  { value: "Permiso sin goce", label: "Permiso sin goce" },
  { value: "Incapacidad", label: "Incapacidad" },
  { value: "Vacaciones", label: "Vacaciones" },
  { value: "Otro", label: "Otro" },
];

const tipoJustificacionMap = tipoJustificacionOptions.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const estadoSolicitudMap = {
  pendiente: "Pendiente de aprobación",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

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

const createManualJustificacionInitial = () => {
  const now = new Date();
  const fecha = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const hora = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return {
    fecha,
    hora,
    tipo_marca: "entrada",
    tipo: "",
    descripcion: "",
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

  const [justificacionModalOpen, setJustificacionModalOpen] = useState(false);
  const [justificacionRegistro, setJustificacionRegistro] = useState(null);
  const [justificacionForm, setJustificacionForm] = useState({ tipo: "", descripcion: "" });
  const [justificacionSubmitting, setJustificacionSubmitting] = useState(false);
  const [resolviendoJustificacionId, setResolviendoJustificacionId] = useState(null);

  const [manualJustificacionModalOpen, setManualJustificacionModalOpen] = useState(false);
  const [manualJustificacionForm, setManualJustificacionForm] = useState(
    () => createManualJustificacionInitial()
  );
  const [manualJustificacionSubmitting, setManualJustificacionSubmitting] = useState(false);

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
        ? data.map((registro) => {
            const solicitud = (() => {
              const idSolicitud = registro.justificacion_solicitud_id;
              if (idSolicitud === undefined || idSolicitud === null) {
                return null;
              }
              const estadoSolicitud = (registro.justificacion_solicitud_estado || "pendiente").toString().toLowerCase();
              return {
                id_solicitud: Number(idSolicitud),
                tipo: registro.justificacion_solicitud_tipo || "",
                descripcion: registro.justificacion_solicitud_descripcion || "",
                estado: estadoSolicitud,
                respuesta: registro.justificacion_solicitud_respuesta || "",
                created_at: registro.justificacion_solicitud_creada || null,
                updated_at: registro.justificacion_solicitud_actualizada || null,
              };
            })();

            return {
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
              justificacionSolicitud: solicitud,
            };
          })
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

  const openJustificacionModal = useCallback(
    (registro) => {
      setJustificacionRegistro(registro);
      setJustificacionForm({
        tipo: registro?.justificacionSolicitud?.tipo || "",
        descripcion: "",
      });
      setJustificacionModalOpen(true);
      setError("");
      setSuccessMessage("");
    },
    [setError, setSuccessMessage]
  );

  const closeJustificacionModal = useCallback(() => {
    setJustificacionModalOpen(false);
    setJustificacionRegistro(null);
    setJustificacionForm({ tipo: "", descripcion: "" });
  }, []);

  const openManualJustificacionModal = useCallback(() => {
    setManualJustificacionForm(createManualJustificacionInitial());
    setManualJustificacionModalOpen(true);
    setError("");
    setSuccessMessage("");
  }, [setError, setSuccessMessage]);

  const closeManualJustificacionModal = useCallback(() => {
    setManualJustificacionModalOpen(false);
    setManualJustificacionForm(createManualJustificacionInitial());
  }, []);

  const handleManualJustificacionChange = useCallback((event) => {
    const { name, value } = event.target;
    setManualJustificacionForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleJustificacionFormChange = useCallback((event) => {
    const { name, value } = event.target;
    setJustificacionForm((prev) => ({ ...prev, [name]: value }));
  }, []);

  const submitJustificacionSolicitud = useCallback(
    async (event) => {
      event.preventDefault();
      if (!justificacionRegistro) return;

      if (!justificacionForm.tipo) {
        setError("Selecciona el tipo de justificación");
        return;
      }

      try {
        setJustificacionSubmitting(true);
        await asistenciaService.createJustificacionSolicitud(justificacionRegistro.id_asistencia, {
          tipo: justificacionForm.tipo,
          descripcion: justificacionForm.descripcion || "",
        });
        setSuccessMessage("Justificación enviada para aprobación");
        closeJustificacionModal();
        await fetchRegistros({
          ...(appliedRange?.start && appliedRange?.end ? appliedRange : defaultRange),
          ...(isAdmin && selectedEmpleado ? { id_empleado: Number(selectedEmpleado) } : {}),
        });
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible enviar la justificación";
        setError(message);
      } finally {
        setJustificacionSubmitting(false);
      }
    },
    [
      justificacionRegistro,
      justificacionForm,
      setError,
      setSuccessMessage,
      closeJustificacionModal,
      fetchRegistros,
      appliedRange,
      defaultRange,
      isAdmin,
      selectedEmpleado,
    ]
  );

  const submitManualJustificacion = useCallback(
    async (event) => {
      event.preventDefault();

      if (!manualJustificacionForm.fecha) {
        setError("Selecciona la fecha del reporte de asistencia");
        return;
      }

      if (!manualJustificacionForm.tipo_marca) {
        setError("Selecciona el tipo de marca a justificar");
        return;
      }

      if (!manualJustificacionForm.tipo) {
        setError("Selecciona el tipo de justificación");
        return;
      }

      try {
        setManualJustificacionSubmitting(true);
        await asistenciaService.createJustificacionManual({
          fecha: manualJustificacionForm.fecha,
          hora: manualJustificacionForm.hora,
          tipo_marca: manualJustificacionForm.tipo_marca,
          tipo: manualJustificacionForm.tipo,
          descripcion: manualJustificacionForm.descripcion,
          ...(isAdmin && selectedEmpleado ? { id_empleado: Number(selectedEmpleado) } : {}),
        });
        setSuccessMessage("Justificación enviada para revisión del administrador");
        closeManualJustificacionModal();
        await fetchRegistros({
          ...(appliedRange?.start && appliedRange?.end ? appliedRange : defaultRange),
          ...(isAdmin && selectedEmpleado ? { id_empleado: Number(selectedEmpleado) } : {}),
        });
      } catch (err) {
        const message =
          err.response?.data?.error ||
          err.message ||
          "No fue posible enviar la solicitud de justificación";
        setError(message);
      } finally {
        setManualJustificacionSubmitting(false);
      }
    },
    [
      manualJustificacionForm,
      setError,
      setSuccessMessage,
      closeManualJustificacionModal,
      fetchRegistros,
      appliedRange,
      defaultRange,
      isAdmin,
      selectedEmpleado,
    ]
  );

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

  const resolverJustificacion = useCallback(
    async ({ id_solicitud, estado, respuesta = "" }) => {
      if (!id_solicitud) return;
      try {
        setResolviendoJustificacionId(id_solicitud);
        setError("");
        setSuccessMessage("");
        await asistenciaService.resolverJustificacionSolicitud(id_solicitud, {
          estado,
          respuesta,
        });
        setSuccessMessage(
          estado === "aprobada"
            ? "Justificación aprobada correctamente"
            : "Justificación rechazada correctamente"
        );
        await fetchRegistros({
          ...(appliedRange?.start && appliedRange?.end ? appliedRange : defaultRange),
          ...(isAdmin && selectedEmpleado ? { id_empleado: Number(selectedEmpleado) } : {}),
        });
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible actualizar la solicitud";
        setError(message);
      } finally {
        setResolviendoJustificacionId(null);
      }
    },
    [
      appliedRange,
      defaultRange,
      fetchRegistros,
      isAdmin,
      selectedEmpleado,
      setError,
      setSuccessMessage,
    ]
  );

  const aprobarJustificacion = useCallback(
    (solicitud) => {
      if (!solicitud?.id_solicitud) return;
      resolverJustificacion({ id_solicitud: solicitud.id_solicitud, estado: "aprobada" });
    },
    [resolverJustificacion]
  );

  const rechazarJustificacion = useCallback(
    (solicitud, respuesta = "") => {
      if (!solicitud?.id_solicitud) return;
      resolverJustificacion({
        id_solicitud: solicitud.id_solicitud,
        estado: "rechazada",
        respuesta,
      });
    },
    [resolverJustificacion]
  );

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
    justificacionModalOpen,
    justificacionRegistro,
    justificacionForm,
    openJustificacionModal,
    closeJustificacionModal,
    handleJustificacionFormChange,
    submitJustificacionSolicitud,
    justificacionSubmitting,
    resolviendoJustificacionId,
    aprobarJustificacion,
    rechazarJustificacion,
    manualJustificacionModalOpen,
    manualJustificacionForm,
    openManualJustificacionModal,
    closeManualJustificacionModal,
    handleManualJustificacionChange,
    submitManualJustificacion,
    manualJustificacionSubmitting,
    location,
    locationStatus,
    supportsGeolocation,
    requestLocation,
    updateLocationField,
    resetLocation,
    tipoJustificacionOptions,
  };
};

export const obtenerEtiquetaTipo = (tipo) => tipoMarcaMap[tipo] || tipo;
export const obtenerEtiquetaEstado = (estado) => estadoMap[estado] || estado || "Presente";
export const obtenerEtiquetaTipoJustificacion = (tipo) =>
  tipoJustificacionMap[tipo] || tipo || "";
export const obtenerEtiquetaEstadoSolicitud = (estado) => {
  if (typeof estado === "string") {
    const normalized = estado.toLowerCase();
    if (estadoSolicitudMap[normalized]) {
      return estadoSolicitudMap[normalized];
    }
  }
  return estadoSolicitudMap.pendiente;
};
