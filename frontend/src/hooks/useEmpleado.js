import { useState, useEffect } from "react";
import api from "../api/axiosConfig";
import descansoSemanalService from "../services/descansoSemanalService";
import empleadoService from "../services/empleadoService";
import puestoService from "../services/puestoService";

const normalizeTipoPago = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized.startsWith("quin")) return "Quincenal";
  if (normalized.startsWith("men")) return "Mensual";
  return "Diario";
};

const createEmptyDescanso = (fechaIngreso = "") => ({
  semana_tipo: "A",
  dia_semana: "0",
  fecha_inicio_vigencia: fechaIngreso,
  fecha_fin_vigencia: "",
});

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
  porcentaje_ccss: "9.34",
  usa_deduccion_fija: "1",
  deduccion_fija: "0",
  permitir_marcacion_fuera: "0",
  planilla_automatica: "1",
  descanso_semanal_habilitado: false,
  descansos: [createEmptyDescanso()],
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
      if (
        name === "fecha_ingreso" &&
        !editingEmpleado &&
        prev.descansos?.some((descanso) => !descanso.fecha_inicio_vigencia)
      ) {
        const descansosActualizados = (prev.descansos || []).map((descanso) =>
          descanso.fecha_inicio_vigencia
            ? descanso
            : { ...descanso, fecha_inicio_vigencia: value }
        );
        return { ...prev, [name]: value, descansos: descansosActualizados };
      }
      return { ...prev, [name]: value };
    });
  };

  const handleDescansoChange = (index, field, value) => {
    setFormData((prev) => {
      const descansosActualizados = (prev.descansos || []).map((descanso, idx) =>
        idx === index ? { ...descanso, [field]: value } : descanso
      );
      return { ...prev, descansos: descansosActualizados };
    });
  };

  const handleToggleDescanso = (enabled) => {
    setFormData((prev) => {
      if (enabled && (!prev.descansos || prev.descansos.length === 0)) {
        return {
          ...prev,
          descanso_semanal_habilitado: true,
          descansos: [createEmptyDescanso(prev.fecha_ingreso || "")],
        };
      }
      return { ...prev, descanso_semanal_habilitado: enabled };
    });
  };

  const addDescanso = () => {
    setFormData((prev) => ({
      ...prev,
      descansos: [
        ...(prev.descansos || []),
        createEmptyDescanso(prev.fecha_ingreso || ""),
      ],
    }));
  };

  const removeDescanso = (index) => {
    setFormData((prev) => {
      const descansosActualizados = (prev.descansos || []).filter(
        (_, idx) => idx !== index
      );
      return {
        ...prev,
        descansos:
          descansosActualizados.length > 0
            ? descansosActualizados
            : [createEmptyDescanso(prev.fecha_ingreso || "")],
      };
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
      ];

      const missingFields = requiredFields
        .filter(({ value }) => String(value ?? "").trim() === "")
        .map(({ label }) => label);

      if (missingFields.length > 0) {
        const fieldsList = missingFields.join(", ");
        setError(`Completa los campos obligatorios: ${fieldsList}.`);
        return;
      }

      if (formData.descanso_semanal_habilitado) {
        const descansos = Array.isArray(formData.descansos) ? formData.descansos : [];
        if (descansos.length === 0) {
          setError("Configura al menos un descanso semanal del empleado.");
          return;
        }

        for (let index = 0; index < descansos.length; index += 1) {
          const descanso = descansos[index];
          const descansoLabel = `Descanso ${index + 1}`;

          if (!descanso?.semana_tipo || descanso.dia_semana === "") {
            setError(`${descansoLabel}: selecciona semana tipo y día de descanso.`);
            return;
          }

          const semanaTipo = String(descanso.semana_tipo).toUpperCase();
          if (!["A", "B"].includes(semanaTipo)) {
            setError(`${descansoLabel}: selecciona una semana tipo válida.`);
            return;
          }

          const diaSemanaValue = Number(descanso.dia_semana);
          if (
            !Number.isInteger(diaSemanaValue) ||
            diaSemanaValue < 0 ||
            diaSemanaValue > 6
          ) {
            setError(`${descansoLabel}: selecciona un día de descanso válido.`);
            return;
          }

          if (!descanso.fecha_inicio_vigencia) {
            setError(`${descansoLabel}: indica la fecha de inicio de vigencia.`);
            return;
          }

          if (descanso.fecha_fin_vigencia) {
            const inicio = new Date(descanso.fecha_inicio_vigencia);
            const fin = new Date(descanso.fecha_fin_vigencia);
            if (
              Number.isNaN(inicio.getTime()) ||
              Number.isNaN(fin.getTime()) ||
              fin < inicio
            ) {
              setError(`${descansoLabel}: la fecha fin debe ser posterior al inicio.`);
              return;
            }
          }
        }
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
      };

      if (formData.fecha_nacimiento) payload.fecha_nacimiento = formData.fecha_nacimiento;
      if (editingEmpleado) payload.estado = Number(formData.estado);
      payload.descansos = formData.descanso_semanal_habilitado
        ? (formData.descansos || []).map((descanso) => ({
            semana_tipo: String(descanso.semana_tipo).toUpperCase(),
            dia_semana: Number(descanso.dia_semana),
            fecha_inicio_vigencia: descanso.fecha_inicio_vigencia,
            fecha_fin_vigencia: descanso.fecha_fin_vigencia || null,
          }))
        : [];

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
      tipo_pago: normalizeTipoPago(empleado.tipo_pago || "Diario"),
      bonificacion_fija:
        empleado.bonificacion_fija !== undefined && empleado.bonificacion_fija !== null
          ? String(empleado.bonificacion_fija)
          : "0",
      porcentaje_ccss:
        empleado.porcentaje_ccss !== undefined && empleado.porcentaje_ccss !== null
          ? String(empleado.porcentaje_ccss)
          : "9.34",
      usa_deduccion_fija: normalizeFlag(empleado.usa_deduccion_fija),
      deduccion_fija:
        empleado.deduccion_fija !== undefined && empleado.deduccion_fija !== null
          ? String(empleado.deduccion_fija)
          : "0",
      permitir_marcacion_fuera: normalizeFlag(empleado.permitir_marcacion_fuera),
      planilla_automatica:
        normalizeFlag(
          empleado.es_automatica,
          normalizeFlag(empleado.planilla_automatica)
        ) || "0",
      estado: normalizeFlag(empleado.estado),
      descanso_semanal_habilitado: false,
      descansos: [createEmptyDescanso(normalizeDate(empleado.fecha_ingreso))],
    });
    setModalOpen(true);

    try {
      const descansos = await descansoSemanalService.getByEmpleado(
        empleado.id_empleado
      );
      const descansosNormalizados = normalizeDescansos(descansos, empleado);
      setFormData((prev) => ({
        ...prev,
        descansos: descansosNormalizados,
        descanso_semanal_habilitado: descansosNormalizados.length > 0,
      }));
    } catch (err) {
      console.error(err);
      setError("No fue posible cargar los descansos semanales.");
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
    handleDescansoChange,
    handleToggleDescanso,
    addDescanso,
    removeDescanso,
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

const normalizeDescansos = (descansos, empleado) => {
  const fechaIngreso = normalizeDate(empleado?.fecha_ingreso);
  if (!Array.isArray(descansos) || descansos.length === 0) {
    return [];
  }

  const normalized = descansos
    .map((descanso) => ({
      semana_tipo: descanso?.semana_tipo ? String(descanso.semana_tipo).toUpperCase() : "A",
      dia_semana:
        descanso?.dia_semana !== undefined && descanso?.dia_semana !== null
          ? String(descanso.dia_semana)
          : "0",
      fecha_inicio_vigencia: normalizeDate(descanso?.fecha_inicio_vigencia) || fechaIngreso,
      fecha_fin_vigencia: normalizeDate(descanso?.fecha_fin_vigencia),
    }))
    .filter((descanso) => descanso.semana_tipo && descanso.dia_semana !== "");

  return normalized;
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
