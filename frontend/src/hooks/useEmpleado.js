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

const createEmptyDescansoDias = () => ({
  A: [],
  B: [],
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
  porcentaje_ccss: "10.67",
  usa_deduccion_fija: "1",
  deduccion_fija: "0",
  permitir_marcacion_fuera: "0",
  planilla_automatica: "1",
  descanso_config_habilitado: false,
  descanso_tipo_patron: "FIJO",
  descanso_ciclo: "SEMANAL",
  descanso_fecha_inicio_vigencia: "",
  descanso_fecha_fin_vigencia: "",
  descanso_fecha_base: "",
  descanso_dias: createEmptyDescansoDias(),
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
      if (name === "tipo_pago") {
        const normalizedTipoPago = normalizeTipoPago(value);
        if (normalizedTipoPago === "Diario") {
          return {
            ...prev,
            [name]: value,
            descanso_config_habilitado: false,
          };
        }
        if (normalizedTipoPago !== "Diario" && !prev.descanso_config_habilitado) {
          return {
            ...prev,
            [name]: value,
            descanso_fecha_inicio_vigencia: prev.descanso_fecha_inicio_vigencia || prev.fecha_ingreso,
            descanso_fecha_base: prev.descanso_fecha_base || prev.fecha_ingreso,
          };
        }
      }
      if (name === "fecha_ingreso" && !editingEmpleado) {
        return {
          ...prev,
          [name]: value,
          descanso_fecha_inicio_vigencia: prev.descanso_fecha_inicio_vigencia || value,
          descanso_fecha_base: prev.descanso_fecha_base || value,
        };
      }
      if (name === "descanso_tipo_patron") {
        const normalized = String(value || "").toUpperCase();
        if (normalized === "FIJO") {
          return {
            ...prev,
            [name]: value,
            descanso_dias: {
              ...prev.descanso_dias,
              B: [...(prev.descanso_dias?.A || [])],
            },
          };
        }
      }
      return { ...prev, [name]: value };
    });
  };

  const handleToggleDescanso = (enabled) => {
    setFormData((prev) => {
      if (!enabled) {
        return { ...prev, descanso_config_habilitado: false };
      }
      return {
        ...prev,
        descanso_config_habilitado: true,
        descanso_fecha_inicio_vigencia:
          prev.descanso_fecha_inicio_vigencia || prev.fecha_ingreso || "",
        descanso_fecha_base: prev.descanso_fecha_base || prev.fecha_ingreso || "",
      };
    });
  };

  const handleToggleDescansoDia = (periodo, dia) => {
    setFormData((prev) => {
      const normalizedPeriodo = String(periodo || "").toUpperCase();
      const diaValue = String(dia);
      const diasActuales = new Set(prev.descanso_dias?.[normalizedPeriodo] || []);
      if (diasActuales.has(diaValue)) {
        diasActuales.delete(diaValue);
      } else {
        diasActuales.add(diaValue);
      }

      const diasNormalizados = Array.from(diasActuales)
        .filter((item) => item !== "")
        .map((item) => String(item))
        .sort();

      let diasActualizados = {
        ...(prev.descanso_dias || createEmptyDescansoDias()),
        [normalizedPeriodo]: diasNormalizados,
      };

      if (
        normalizedPeriodo === "A" &&
        String(prev.descanso_tipo_patron || "").toUpperCase() === "FIJO"
      ) {
        diasActualizados = {
          ...diasActualizados,
          B: [...diasNormalizados],
        };
      }

      return {
        ...prev,
        descanso_dias: diasActualizados,
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

      const tipoPagoNormalizado = normalizeTipoPago(formData.tipo_pago);
      if (formData.descanso_config_habilitado && tipoPagoNormalizado !== "Diario") {
        const tipoPatron = String(formData.descanso_tipo_patron || "").toUpperCase();
        const ciclo = String(formData.descanso_ciclo || "").toUpperCase();
        const fechaInicio = formData.descanso_fecha_inicio_vigencia;
        const fechaBase = formData.descanso_fecha_base;

        if (!fechaInicio) {
          setError("Selecciona la fecha de inicio de vigencia del descanso.");
          return;
        }
        if (!fechaBase) {
          setError("Selecciona la fecha base para el patrón de descanso.");
          return;
        }

        if (formData.descanso_fecha_fin_vigencia) {
          const inicio = new Date(fechaInicio);
          const fin = new Date(formData.descanso_fecha_fin_vigencia);
          if (
            Number.isNaN(inicio.getTime()) ||
            Number.isNaN(fin.getTime()) ||
            fin < inicio
          ) {
            setError("La fecha fin de vigencia debe ser posterior al inicio.");
            return;
          }
        }

        const baseDate = new Date(fechaBase);
        const inicioDate = new Date(fechaInicio);
        const finDate = formData.descanso_fecha_fin_vigencia
          ? new Date(formData.descanso_fecha_fin_vigencia)
          : null;
        if (
          Number.isNaN(baseDate.getTime()) ||
          Number.isNaN(inicioDate.getTime()) ||
          baseDate < inicioDate ||
          (finDate && baseDate > finDate)
        ) {
          setError("La fecha base debe estar dentro del rango de vigencia del descanso.");
          return;
        }

        if (!["FIJO", "ALTERNADO"].includes(tipoPatron)) {
          setError("Selecciona un tipo de patrón de descanso válido.");
          return;
        }

        if (!["SEMANAL", "QUINCENAL"].includes(ciclo)) {
          setError("Selecciona un ciclo de descanso válido.");
          return;
        }

        const diasPeriodoA = normalizeDescansoDias(formData.descanso_dias?.A);
        const diasPeriodoB =
          tipoPatron === "FIJO"
            ? diasPeriodoA
            : normalizeDescansoDias(formData.descanso_dias?.B);

        if (diasPeriodoA.length === 0) {
          setError("Selecciona al menos un día de descanso para el periodo A.");
          return;
        }

        if (tipoPatron === "ALTERNADO" && diasPeriodoB.length === 0) {
          setError("Selecciona al menos un día de descanso para el periodo B.");
          return;
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
      if (formData.descanso_config_habilitado && normalizeTipoPago(formData.tipo_pago) !== "Diario") {
        const tipoPatron = String(formData.descanso_tipo_patron || "").toUpperCase();
        const ciclo = String(formData.descanso_ciclo || "").toUpperCase();
        const diasPeriodoA = normalizeDescansoDias(formData.descanso_dias?.A);
        const diasPeriodoB =
          tipoPatron === "FIJO" ? diasPeriodoA : normalizeDescansoDias(formData.descanso_dias?.B);

        const descansoDias = [
          ...diasPeriodoA.map((dia) => ({
            periodo_tipo: "A",
            dia_semana: Number(dia),
            es_descanso: 1,
          })),
          ...diasPeriodoB.map((dia) => ({
            periodo_tipo: "B",
            dia_semana: Number(dia),
            es_descanso: 1,
          })),
        ];

        payload.descanso_config = {
          tipo_patron: tipoPatron,
          ciclo,
          fecha_inicio_vigencia: formData.descanso_fecha_inicio_vigencia,
          fecha_fin_vigencia: formData.descanso_fecha_fin_vigencia || null,
          fecha_base: formData.descanso_fecha_base,
        };
        payload.descanso_dias = descansoDias;
      } else {
        payload.descanso_config = null;
        payload.descanso_dias = [];
      }

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
      descanso_config_habilitado: false,
      descanso_tipo_patron: "FIJO",
      descanso_ciclo: "SEMANAL",
      descanso_fecha_inicio_vigencia: normalizeDate(empleado.fecha_ingreso),
      descanso_fecha_fin_vigencia: "",
      descanso_fecha_base: normalizeDate(empleado.fecha_ingreso),
      descanso_dias: createEmptyDescansoDias(),
    });
    setModalOpen(true);

    try {
      const descansoPayload = await descansoSemanalService.getByEmpleado(
        empleado.id_empleado
      );
      const tipoPagoNormalizado = normalizeTipoPago(empleado.tipo_pago || "Diario");
      const descansoConfig = normalizeDescansoConfigFromPayload(
        descansoPayload?.descanso_config,
        descansoPayload?.descanso_dias,
        empleado
      );
      setFormData((prev) => ({
        ...prev,
        descanso_config_habilitado:
          tipoPagoNormalizado !== "Diario" && descansoConfig.descanso_dias.A.length > 0,
        descanso_tipo_patron: descansoConfig.descanso_tipo_patron,
        descanso_ciclo: descansoConfig.descanso_ciclo,
        descanso_fecha_inicio_vigencia: descansoConfig.descanso_fecha_inicio_vigencia,
        descanso_fecha_fin_vigencia: descansoConfig.descanso_fecha_fin_vigencia,
        descanso_fecha_base: descansoConfig.descanso_fecha_base,
        descanso_dias: descansoConfig.descanso_dias,
      }));
    } catch (err) {
      console.error(err);
      setError("No fue posible cargar la configuración de descansos.");
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
    handleToggleDescanso,
    handleToggleDescansoDia,
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

const normalizeDescansoDias = (dias) => {
  if (!Array.isArray(dias)) return [];
  const normalized = dias
    .map((dia) => String(dia))
    .filter((dia) => {
      const number = Number(dia);
      return Number.isInteger(number) && number >= 0 && number <= 6;
    });

  return Array.from(new Set(normalized)).sort();
};

const isTruthyFlag = (value) => Number(value) === 1 || value === true;

const normalizeDescansoDiasFromConfig = (descansoDias) => {
  if (!Array.isArray(descansoDias)) {
    return createEmptyDescansoDias();
  }

  const diasPorPeriodo = { A: [], B: [] };

  descansoDias.forEach((dia) => {
    if (!isTruthyFlag(dia?.es_descanso)) return;
    const periodo = String(dia?.periodo_tipo || "").trim().toUpperCase();
    if (!["A", "B"].includes(periodo)) return;
    const diaValue = Number(dia?.dia_semana);
    if (!Number.isInteger(diaValue) || diaValue < 0 || diaValue > 6) return;
    diasPorPeriodo[periodo].push(String(diaValue));
  });

  return {
    A: normalizeDescansoDias(diasPorPeriodo.A),
    B: normalizeDescansoDias(diasPorPeriodo.B),
  };
};

const normalizeDescansoConfigFromPayload = (
  descansoConfig,
  descansoDias,
  empleado
) => {
  const fechaIngreso = normalizeDate(empleado?.fecha_ingreso);
  if (!descansoConfig) {
    return {
      descanso_tipo_patron: "FIJO",
      descanso_ciclo: "SEMANAL",
      descanso_fecha_inicio_vigencia: fechaIngreso,
      descanso_fecha_fin_vigencia: "",
      descanso_fecha_base: fechaIngreso,
      descanso_dias: createEmptyDescansoDias(),
    };
  }

  const tipoPatron = String(descansoConfig.tipo_patron || "FIJO")
    .trim()
    .toUpperCase();
  const ciclo = String(descansoConfig.ciclo || "SEMANAL").trim().toUpperCase();
  const fechaInicio =
    normalizeDate(descansoConfig.fecha_inicio_vigencia) || fechaIngreso;
  const fechaFin = normalizeDate(descansoConfig.fecha_fin_vigencia);
  const fechaBase =
    normalizeDate(descansoConfig.fecha_base) || fechaInicio || fechaIngreso;
  const diasConfig = normalizeDescansoDiasFromConfig(descansoDias);
  const diasA = diasConfig.A;
  const diasB = tipoPatron === "FIJO" ? diasA : diasConfig.B;

  return {
    descanso_tipo_patron: tipoPatron,
    descanso_ciclo: ciclo,
    descanso_fecha_inicio_vigencia: fechaInicio,
    descanso_fecha_fin_vigencia: fechaFin,
    descanso_fecha_base: fechaBase,
    descanso_dias: {
      A: diasA,
      B: tipoPatron === "FIJO" ? diasA : diasB,
    },
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
