import { useState, useEffect } from "react";
import api from "../api/axiosConfig";
import empleadoService from "../services/empleadoService";
import puestoService from "../services/puestoService";

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
  tipo_pago: "Diario",
  bonificacion_fija: "0",
  porcentaje_ccss: "9.34",
  usa_deduccion_fija: "0",
  deduccion_fija: "0",
  permitir_marcacion_fuera: "0",
  estado: "1", // 👈 por defecto activo
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
      return { ...prev, [name]: value };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setError("");
      setSuccessMessage("");
      if (
        !formData.nombre ||
        !formData.apellido ||
        !formData.id_puesto ||
        !formData.cedula ||
        !formData.fecha_ingreso ||
        !formData.salario_monto ||
        !formData.tipo_pago
      ) {
        setError("Por favor completa los campos obligatorios");
        return;
      }

      const salarioValue = Number(formData.salario_monto);
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

      const payload = {
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        id_puesto: Number(formData.id_puesto),
        cedula: formData.cedula.trim(),
        fecha_ingreso: formData.fecha_ingreso,
        salario_monto: salarioValue,
        tipo_pago: formData.tipo_pago,
        bonificacion_fija: bonificacionValue,
        porcentaje_ccss: porcentajeValue,
        usa_deduccion_fija: usaDeduccionFija ? 1 : 0,
        deduccion_fija: usaDeduccionFija ? deduccionFijaValue : 0,
        permitir_marcacion_fuera: formData.permitir_marcacion_fuera === "1" ? 1 : 0,
      };

      if (formData.fecha_nacimiento) payload.fecha_nacimiento = formData.fecha_nacimiento;
      if (formData.telefono) payload.telefono = formData.telefono.trim();
      if (formData.email) payload.email = formData.email.trim();
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

  const handleEdit = (empleado) => {
    setEditingEmpleado(empleado);
    setFormData({
      nombre: empleado.nombre || "",
      apellido: empleado.apellido || "",
      id_puesto: empleado.id_puesto ? String(empleado.id_puesto) : "",
      cedula: empleado.cedula || "",
      fecha_nacimiento: normalizeDate(empleado.fecha_nacimiento),
      telefono: empleado.telefono || "",
      email: empleado.email || "",
      fecha_ingreso: normalizeDate(empleado.fecha_ingreso),
      salario_monto:
        empleado.salario_monto !== undefined && empleado.salario_monto !== null
          ? String(empleado.salario_monto)
          : "",
      tipo_pago: empleado.tipo_pago || "Diario",
      bonificacion_fija:
        empleado.bonificacion_fija !== undefined && empleado.bonificacion_fija !== null
          ? String(empleado.bonificacion_fija)
          : "0",
      porcentaje_ccss:
        empleado.porcentaje_ccss !== undefined && empleado.porcentaje_ccss !== null
          ? String(empleado.porcentaje_ccss)
          : "9.34",
      usa_deduccion_fija:
        empleado.usa_deduccion_fija !== undefined && empleado.usa_deduccion_fija !== null
          ? String(Number(Boolean(empleado.usa_deduccion_fija)))
          : "0",
      deduccion_fija:
        empleado.deduccion_fija !== undefined && empleado.deduccion_fija !== null
          ? String(empleado.deduccion_fija)
          : "0",
      permitir_marcacion_fuera:
        empleado.permitir_marcacion_fuera !== undefined && empleado.permitir_marcacion_fuera !== null
          ? String(Number(Boolean(empleado.permitir_marcacion_fuera)))
          : "0",
      estado:
        empleado.estado !== undefined && empleado.estado !== null
          ? String(Number(empleado.estado))
          : "0",
    });
    setModalOpen(true);
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

