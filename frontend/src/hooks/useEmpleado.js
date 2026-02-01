import { useState, useEffect } from "react";
import api from "../api/axiosConfig";
import empleadoService from "../services/empleadoService";
import puestoService from "../services/puestoService";

const normalizeTipoPago = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.startsWith("quin")) return "Quincenal";
  if (normalized.startsWith("men")) return "Mensual";
  return "Diario";
};

const normalizeFlag = (value, fallback = "0") => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return fallback;
  }
  return numericValue === 1 ? "1" : "0";
};

const normalizeDescansoDays = (value) => {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    )
  ).sort((a, b) => a - b);
};

const createEmptyFormData = () => ({
  nombre: "",
  apellido: "",
  id_puesto: "",
  cedula: "",
  fecha_nacimiento: "",
  telefono: "",
  email: "",
  fecha_ingreso: "",
  salario_monto: "",
  tipo_pago: normalizeTipoPago("Diario"),
  bonificacion_fija: "0",
  porcentaje_ccss: "10.67",
  usa_deduccion_fija: "1",
  deduccion_fija: "0",
  permitir_marcacion_fuera: "0",
  planilla_automatica: "1",
  estado: "1", // 👈 por defecto activo
  descanso_tipo_patron: "FIJO",
  descanso_ciclo: "SEMANAL",
  descanso_fecha_inicio_vigencia: "",
  descanso_fecha_fin_vigencia: "",
  descanso_fecha_base: "",
  descanso_dias_A: [],
  descanso_dias_B: [],
});

export const useEmpleado = () => {
  const [empleados, setEmpleados] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState(null);
  const [formData, setFormData] = useState(() => createEmptyFormData());
  const [successMessage, setSuccessMessage] = useState("");
  const [exportingFormat, setExportingFormat] = useState(null);

  useEffect(() => {
    fetchEmpleados();
    fetchPuestos();
  }, []);

  const fetchEmpleados = async () => {
    try {
      setLoading(true);
      const data = await empleadoService.getAll();
      setEmpleados(data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Error al cargar empleados");
    } finally {
      setLoading(false);
    }
  };

  const fetchPuestos = async () => {
    try {
      const data = await puestoService.getAll();
      setPuestos(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => {
      if (name === "usa_deduccion_fija" && value !== "1") {
        return { ...prev, [name]: value, deduccion_fija: "0" };
      }
      if (name === "descanso_tipo_patron" && value !== "ALTERNADO") {
        return { ...prev, [name]: value, descanso_dias_B: [] };
      }
      return { ...prev, [name]: value };
    });
  };

  const toggleDescansoDia = (periodo, dia) => {
    setFormData((prev) => {
      const key = periodo === "B" ? "descanso_dias_B" : "descanso_dias_A";
      const current = new Set(prev[key] || []);
      if (current.has(dia)) {
        current.delete(dia);
      } else {
        current.add(dia);
      }
      return { ...prev, [key]: Array.from(current).sort((a, b) => a - b) };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setSuccessMessage("");
      const requiredFields = [
        { value: formData.nombre, label: "Nombre" },
        { value: formData.apellido, label: "Apellido" },
        { value: formData.id_puesto, label: "Puesto" },
        { value: formData.cedula, label: "Cédula" },
        { value: formData.fecha_ingreso, label: "Fecha de ingreso" },
        { value: formData.salario_monto, label: "Salario base" },
        { value: formData.tipo_pago, label: "Tipo de pago" },
        { value: formData.descanso_fecha_inicio_vigencia, label: "Inicio vigencia descanso" },
        { value: formData.descanso_fecha_base, label: "Fecha base descanso" },
      ];

      const missingFields = requiredFields
        .filter(({ value }) => String(value ?? "").trim() === "")
        .map(({ label }) => label);

      if (missingFields.length > 0) {
        const fieldsList = missingFields.join(", ");
        setError(`Completa los campos obligatorios: ${fieldsList}.`);
        return;
      }

      const salarioValue = Number(String(formData.salario_monto).trim());
      if (Number.isNaN(salarioValue) || salarioValue <= 0) {
        setError("El salario base debe ser un número mayor a cero");
        return;
      }

      const bonificacionValue = Number(formData.bonificacion_fija || 0);
      if (Number.isNaN(bonificacionValue)) {
        setError("La bonificación fija debe ser un número válido");
        return;
      }

      const porcentajeValue = Number(
        formData.porcentaje_ccss === ""
          ? 9.34
          : formData.porcentaje_ccss
      );
      if (Number.isNaN(porcentajeValue) || porcentajeValue < 0) {
        setError("El porcentaje de CCSS debe ser un número válido");
        return;
      }

      const usaDeduccionFija = formData.usa_deduccion_fija === "1";
      if (usaDeduccionFija && formData.deduccion_fija === "") {
        setError("Ingresa la deducción fija cuando está habilitada");
        return;
      }

      const deduccionFijaValue = Number(formData.deduccion_fija || 0);
      if (Number.isNaN(deduccionFijaValue) || deduccionFijaValue < 0) {
        setError("La deducción fija debe ser un número válido");
        return;
      }

      const descansoDiasA = normalizeDescansoDays(formData.descanso_dias_A);
      const descansoDiasB = normalizeDescansoDays(formData.descanso_dias_B);
      if (descansoDiasA.length === 0) {
        setError("Selecciona al menos un día de descanso en el periodo A");
        return;
      }
      if (formData.descanso_tipo_patron === "ALTERNADO" && descansoDiasB.length === 0) {
        setError("Selecciona al menos un día de descanso en el periodo B");
        return;
      }

      const normalizedTelefono = (formData.telefono || "").trim();
      const normalizedEmail = (formData.email || "").trim();

      const payload = {
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        id_puesto: Number(formData.id_puesto),
        cedula: formData.cedula.trim(),
        fecha_ingreso: formData.fecha_ingreso,
        salario_monto: salarioValue,
        tipo_pago: normalizeTipoPago(formData.tipo_pago),
        bonificacion_fija: bonificacionValue,
        porcentaje_ccss: porcentajeValue,
        usa_deduccion_fija: usaDeduccionFija ? 1 : 0,
        deduccion_fija: usaDeduccionFija ? deduccionFijaValue : 0,
        permitir_marcacion_fuera: formData.permitir_marcacion_fuera === "1" ? 1 : 0,
        planilla_automatica: formData.planilla_automatica === "1" ? 1 : 0,
        telefono: normalizedTelefono === "" ? null : normalizedTelefono,
        email: normalizedEmail === "" ? null : normalizedEmail,
        descanso_config: {
          tipo_patron: formData.descanso_tipo_patron,
          ciclo: formData.descanso_ciclo,
          fecha_inicio_vigencia: formData.descanso_fecha_inicio_vigencia,
          fecha_fin_vigencia: formData.descanso_fecha_fin_vigencia || null,
          fecha_base: formData.descanso_fecha_base,
          dias: {
            A: descansoDiasA,
            B: descansoDiasB,
          },
        },
      };

      if (formData.fecha_nacimiento) payload.fecha_nacimiento = formData.fecha_nacimiento;
      if (editingEmpleado) payload.estado = Number(formData.estado);

      if (editingEmpleado) {
        await empleadoService.update(editingEmpleado.id_empleado, payload);
        setSuccessMessage("Empleado actualizado correctamente");
      } else {
        await empleadoService.create(payload);
        setSuccessMessage("Empleado creado correctamente");
      }

      setModalOpen(false);
      resetForm();
      fetchEmpleados();
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "Error al guardar empleado";
      setError(message);
    }
  };

  const handleEdit = async (empleado) => {
    try {
      const detalle = await empleadoService.getById(empleado.id_empleado);
      const descansoConfig = detalle?.descanso_config;
      setEditingEmpleado(empleado);
      setFormData({
        nombre: detalle.nombre || "",
        apellido: detalle.apellido || "",
        id_puesto: detalle.id_puesto ? String(detalle.id_puesto) : "",
        cedula: detalle.cedula || "",
        fecha_nacimiento: normalizeDate(detalle.fecha_nacimiento),
        telefono: detalle.telefono || "",
        email: detalle.email || "",
        fecha_ingreso: normalizeDate(detalle.fecha_ingreso),
        salario_monto:
          detalle.salario_monto !== undefined && detalle.salario_monto !== null
            ? String(detalle.salario_monto)
            : "",
        tipo_pago: normalizeTipoPago(detalle.tipo_pago || "Diario"),
        bonificacion_fija:
          detalle.bonificacion_fija !== undefined && detalle.bonificacion_fija !== null
            ? String(detalle.bonificacion_fija)
            : "0",
        porcentaje_ccss:
          detalle.porcentaje_ccss !== undefined && detalle.porcentaje_ccss !== null
            ? String(detalle.porcentaje_ccss)
            : "9.34",
        usa_deduccion_fija: normalizeFlag(detalle.usa_deduccion_fija),
        deduccion_fija:
          detalle.deduccion_fija !== undefined && detalle.deduccion_fija !== null
            ? String(detalle.deduccion_fija)
            : "0",
        permitir_marcacion_fuera: normalizeFlag(detalle.permitir_marcacion_fuera),
        planilla_automatica:
          normalizeFlag(
            detalle.es_automatica,
            normalizeFlag(detalle.planilla_automatica)
          ) || "0",
        estado: normalizeFlag(detalle.estado),
        descanso_tipo_patron: descansoConfig?.tipo_patron || "FIJO",
        descanso_ciclo: descansoConfig?.ciclo || "SEMANAL",
        descanso_fecha_inicio_vigencia: normalizeDate(
          descansoConfig?.fecha_inicio_vigencia
        ),
        descanso_fecha_fin_vigencia: normalizeDate(descansoConfig?.fecha_fin_vigencia),
        descanso_fecha_base: normalizeDate(descansoConfig?.fecha_base),
        descanso_dias_A: normalizeDescansoDays(descansoConfig?.dias?.A || []),
        descanso_dias_B: normalizeDescansoDays(descansoConfig?.dias?.B || []),
      });
      setModalOpen(true);
    } catch (err) {
      console.error(err);
      setError("No fue posible cargar la información del empleado.");
    }
  };

  const resetForm = () => {
    setFormData(createEmptyFormData());
    setEditingEmpleado(null);
    setError("");
  };

  const handleDeactivate = async (id) => {
    try {
      setError("");
      setSuccessMessage("");
      await empleadoService.deactivate(id);
      setSuccessMessage("Empleado desactivado correctamente");
      fetchEmpleados();
    } catch (err) {
      console.error(err);
      setError("Error al desactivar empleado");
    }
  };

  const handleActivate = async (id) => {
    try {
      setError("");
      setSuccessMessage("");
      await empleadoService.activate(id);
      setSuccessMessage("Empleado activado correctamente");
      fetchEmpleados();
    } catch (err) {
      console.error(err);
      setError("Error al activar empleado");
    }
  };

  const exportEmpleados = async (
    format,
    { status = "all", openInNewTab = true, silent = false } = {}
  ) => {
    setError("");
    if (!silent) {
      setSuccessMessage("");
    }

    try {
      setExportingFormat(format);
      const response = await empleadoService.export({ format, status });
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
            ? "Reporte de empleados en Excel generado correctamente."
            : "Reporte de empleados en PDF generado correctamente."
        );
      }

      return { url: fileUrl, filename, format: responseFormat };
    } catch (err) {
      console.error(err);
      const message =
        err.response?.data?.error ||
        err.message ||
        "No fue posible exportar los empleados.";
      setError(message);
      return null;
    } finally {
      setExportingFormat(null);
    }
  };

  const shareEmpleados = async ({ status = "all" } = {}) => {
    if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
      setError("La función de compartir no está disponible en este dispositivo.");
      return;
    }

    setError("");
    setSuccessMessage("");

    const exportData = await exportEmpleados("pdf", {
      status,
      openInNewTab: false,
      silent: true,
    });

    if (!exportData?.url) {
      return;
    }

    const { url, filename } = exportData;
    const fallbackName = filename || `empleados-${status}.pdf`;

    try {
      const response = await api.get(url, {
        responseType: "blob",
        headers: { Accept: "application/pdf" },
      });

      const blob = response.data;
      const fileType = blob.type || "application/pdf";
      const fileName = fallbackName.endsWith(".pdf") ? fallbackName : `${fallbackName}.pdf`;
      const file = new File([blob], fileName, { type: fileType });

      if (typeof navigator.canShare === "function" && !navigator.canShare({ files: [file] })) {
        throw new Error("Este dispositivo no permite compartir archivos PDF.");
      }

      await navigator.share({
        files: [file],
        title: "Reporte de empleados",
        text: "Te comparto el reporte de empleados generado desde EmpresaRH.",
      });

      setSuccessMessage("Reporte de empleados compartido correctamente.");
    } catch (err) {
      console.error(err);
      const message =
        err.response?.data?.error ||
        err.message ||
        "No fue posible compartir el reporte de empleados.";
      setError(message);
    }
  };

  return {
    empleados,
    puestos,
    loading,
    error,
    successMessage,
    modalOpen,
    setModalOpen,
    editingEmpleado,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    handleDeactivate,
    handleActivate,
    resetForm,
    fetchEmpleados,
    setError,
    setSuccessMessage,
    exportingFormat,
    exportEmpleados,
    shareEmpleados,
    toggleDescansoDia,
  };
};

const normalizeDate = (value) => {
  if (!value) return "";

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  if (typeof value === "string") {
    const [datePart] = value.split("T");
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      return datePart;
    }
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }
  return parsed.toISOString().slice(0, 10);
};
