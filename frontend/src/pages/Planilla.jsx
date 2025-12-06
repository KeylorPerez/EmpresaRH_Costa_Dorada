import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { usePlanilla } from "../hooks/usePlanilla";
import planillaService from "../services/planillaService";
import { adminLinks as adminNavigationLinks } from "../utils/navigationLinks";
import {
  buildPlanillaDisplayName,
  clonePlanillaWithCanonicalFields,
  getPlanillaDateField,
  getPlanillaNumericField,
  getPlanillaTipoPagoValue,
  resolveEmpleadoId,
  resolvePlanillaId,
} from "../utils/planillaUtils";

const currencyFormatter = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  currencyDisplay: "narrowSymbol",
  minimumFractionDigits: 2,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "-";
  if (typeof value === "string") {
    const [datePart] = value.split("T");
    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [year, month, day] = datePart.split("-");
      return `${day}/${month}/${year}`;
    }
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatPeriodo = (inicio, fin) => {
  if (!inicio || !fin) return "-";
  return `${formatDate(inicio)} - ${formatDate(fin)}`;
};

const normalizeFileUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  if (url.startsWith("//")) return `${window.location.protocol}${url}`;
  if (url.startsWith("/")) return `${window.location.origin}${url}`;
  return url;
};

const normalizarTipoPago = (valor) => (valor ?? "").toString().trim().toLowerCase();

const formatearTipoPago = (valor, { etiquetaPorDefecto = "Sin tipo" } = {}) => {
  const tipoNormalizado = normalizarTipoPago(valor);

  if (tipoNormalizado === "diario") {
    return "Pago diario";
  }

  if (tipoNormalizado.startsWith("quin")) {
    return "Pago quincenal";
  }

  const textoOriginal = (valor ?? "").toString().trim();
  return textoOriginal || etiquetaPorDefecto;
};

const WIZARD_TIPO_PAGO_VALUES = ["todos", "diario", "quincenal"];

const WIZARD_TIPO_PAGO_LABELS = {
  todos: "Todos",
  diario: "Pago diario",
  quincenal: "Pago quincenal",
};

const normalizarTexto = (valor) => (valor ?? "").toString().trim().toLowerCase();

const formatDateInputValue = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const obtenerRangoFechaPorDefecto = () => {
  const hoy = new Date();
  const year = hoy.getFullYear();
  const monthIndex = hoy.getMonth();
  const day = hoy.getDate();

  if (day <= 15) {
    const inicio = new Date(year, monthIndex, 1);
    const fin = new Date(year, monthIndex, 15);
    return { inicio: formatDateInputValue(inicio), fin: formatDateInputValue(fin) };
  }

  const inicio = new Date(year, monthIndex, 16);
  const fin = new Date(year, monthIndex + 1, 0);
  return { inicio: formatDateInputValue(inicio), fin: formatDateInputValue(fin) };
};

const parseDateSafe = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
};

const Planilla = () => {
  const { user, logoutUser } = useAuth();
  const {
    planillas,
    empleados,
    loading,
    error,
    modalOpen,
    setModalOpen,
    editingPlanilla,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    openCreateModal,
    selectEmpleado,
    resetForm,
    setError,
    prestamosEmpleado,
    prestamoSelections,
    togglePrestamo,
    updateMontoPrestamo,
    totalPrestamosSeleccionados,
    attendanceState,
    refreshAttendance,
    detalleDias,
    updateDetalleDia,
    normalizeDetalleSalario,
    toggleDetalleAsistencia,
    toggleDetalleDiaDoble,
    detalleDiasResumen,
    detalleEstadoOptions,
  } = usePlanilla();

  const navigate = useNavigate();
  const isEditing = Boolean(editingPlanilla);
  const [activeEmpleadoIndex, setActiveEmpleadoIndex] = useState(0);
  const [wizardSearch, setWizardSearch] = useState("");
  const [tipoPagoFiltro, setTipoPagoFiltro] = useState("todos");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [wizardTipoPagoFiltro, setWizardTipoPagoFiltro] = useState("todos");
  const [mobileModalSection, setMobileModalSection] = useState("selector");
  const defaultDateRangeRef = useRef(obtenerRangoFechaPorDefecto());
  const [empleadoFiltro, setEmpleadoFiltro] = useState("todos");
  const [busquedaEmpleado, setBusquedaEmpleado] = useState("");
  const [fechaInicioFiltro, setFechaInicioFiltro] = useState(
    defaultDateRangeRef.current.inicio,
  );
  const [fechaFinFiltro, setFechaFinFiltro] = useState(defaultDateRangeRef.current.fin);
  const [exportResumenMessage, setExportResumenMessage] = useState("");
  const [exportResumenError, setExportResumenError] = useState("");
  const [exportingResumen, setExportingResumen] = useState(null);

  useEffect(() => {
    if (!fechaInicioFiltro || !fechaFinFiltro) return;

    const fechaInicio = parseDateSafe(`${fechaInicioFiltro}T00:00:00`);
    const fechaFin = parseDateSafe(`${fechaFinFiltro}T00:00:00`);

    if (fechaInicio && fechaFin && fechaInicio > fechaFin) {
      setFechaFinFiltro(fechaInicioFiltro);
    }
  }, [fechaInicioFiltro, fechaFinFiltro]);

  const planillasFiltradas = useMemo(() => {
    if (!Array.isArray(planillas)) {
      return [];
    }

    const filtroTipoPago = normalizarTipoPago(tipoPagoFiltro);
    const filtroEmpleadoId = empleadoFiltro === "todos" ? null : empleadoFiltro;
    const textoBusqueda = normalizarTexto(busquedaEmpleado);

    const fechaInicio = fechaInicioFiltro
      ? parseDateSafe(`${fechaInicioFiltro}T00:00:00`)
      : null;
    const fechaFin = fechaFinFiltro ? parseDateSafe(`${fechaFinFiltro}T23:59:59`) : null;

    return planillas.filter((planilla) => {
      const tipoPlanilla = normalizarTipoPago(getPlanillaTipoPagoValue(planilla) || "");

      if (filtroTipoPago !== "todos" && tipoPlanilla !== filtroTipoPago) {
        return false;
      }

      const empleadoId = resolveEmpleadoId(planilla);
      const idPlanilla = empleadoId !== null && empleadoId !== undefined ? empleadoId.toString() : "";

      if (filtroEmpleadoId && idPlanilla !== filtroEmpleadoId) {
        return false;
      }

      if (textoBusqueda) {
        const posiblesNombres = [
          `${planilla?.nombre ?? ""} ${planilla?.apellido ?? ""}`,
          planilla?.nombre_completo,
          planilla?.nombreCompleto,
          planilla?.nombre_colaborador,
          planilla?.nombre_empleado,
        ]
          .map((valor) => normalizarTexto(valor))
          .filter(Boolean);

        const coincidenciaBusqueda = [normalizarTexto(idPlanilla), ...posiblesNombres].some(
          (valor) => valor.includes(textoBusqueda),
        );

        if (!coincidenciaBusqueda) {
          return false;
        }
      }

      if (!fechaInicio && !fechaFin) {
        return true;
      }

      const periodoInicio = parseDateSafe(planilla?.periodo_inicio);
      const periodoFin = parseDateSafe(planilla?.periodo_fin);

      if (!periodoInicio || !periodoFin) {
        return false;
      }

      if (fechaInicio && periodoFin < fechaInicio) {
        return false;
      }

      if (fechaFin && periodoInicio > fechaFin) {
        return false;
      }

      return true;
    });
  }, [planillas, tipoPagoFiltro, empleadoFiltro, busquedaEmpleado, fechaInicioFiltro, fechaFinFiltro]);

  const totalPlanillas = Array.isArray(planillas) ? planillas.length : 0;

  const resumenPlanillas = useMemo(() => {
    const totalPago = (planillasFiltradas || []).reduce((sum, planillaActual) => {
      const pagoNeto = getPlanillaNumericField(planillaActual, ["pago_neto", "pagoNeto"]);
      return sum + (pagoNeto ?? 0);
    }, 0);

    return {
      cantidad: planillasFiltradas?.length || 0,
      totalPago: currencyFormatter.format(totalPago),
    };
  }, [planillasFiltradas]);

  const handleExportResumen = async (format) => {
    setExportResumenError("");
    setExportResumenMessage("");
    setExportingResumen(format);

    try {
      const data = await planillaService.exportResumen(format);
      const fileUrl = normalizeFileUrl(data?.url);
      const responseFormat = data?.format || format;

      if (!fileUrl) {
        throw new Error("No se recibió la URL del archivo generado.");
      }

      window.open(fileUrl, "_blank", "noopener");

      setExportResumenMessage(
        responseFormat === "excel"
          ? "Resumen en Excel generado correctamente."
          : "Resumen en PDF generado correctamente.",
      );
    } catch (err) {
      const message =
        err.response?.data?.error || err.message || "No se pudo generar el resumen de planillas.";
      setExportResumenError(message);
    } finally {
      setExportingResumen(null);
    }
  };

  const obtenerTipoPagoPlanilla = (planilla) =>
    formatearTipoPago(getPlanillaTipoPagoValue(planilla), {
      etiquetaPorDefecto: "No especificado",
    });

  const obtenerNombreCompletoEmpleado = (empleado = {}) => {
    const partesNombre = [empleado.nombre, empleado.apellido]
      .map((parte) => (parte || "").trim())
      .filter(Boolean);

    if (partesNombre.length > 0) {
      return partesNombre.join(" ");
    }

    const nombreAlterno =
      empleado.nombre_completo ||
      empleado.nombreCompleto ||
      empleado.nombre_completo_empleado ||
      empleado.nombreColaborador;

    return (nombreAlterno || "").trim() || "Sin nombre";
  };

  const modalScrollRef = useRef(null);
  const detalleOverlayFocusRef = useRef(null);
  const detalleSectionRef = useRef(null);
  const detalleHighlightTimeoutRef = useRef(null);
  const prevDetalleOverlayOpenRef = useRef(false);
  const [detalleOverlayOpen, setDetalleOverlayOpen] = useState(false);
  const [detalleHighlighted, setDetalleHighlighted] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    const scrollContainer = modalScrollRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTo({ top: 0, behavior: "auto" });
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen || !error) return;
    const scrollContainer = modalScrollRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
  }, [error, modalOpen]);

  useEffect(() => {
    if (!modalOpen) {
      setDetalleOverlayOpen(false);
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!detalleOverlayOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDetalleOverlayOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [detalleOverlayOpen]);

  useEffect(() => {
    if (detalleOverlayOpen && detalleOverlayFocusRef.current) {
      detalleOverlayFocusRef.current.focus({ preventScroll: true });
    }
  }, [detalleOverlayOpen]);

  useEffect(() => {
    const wasOverlayOpen = prevDetalleOverlayOpenRef.current;
    prevDetalleOverlayOpenRef.current = detalleOverlayOpen;

    if (!modalOpen) {
      if (detalleHighlighted) {
        setDetalleHighlighted(false);
      }
      if (detalleHighlightTimeoutRef.current) {
        clearTimeout(detalleHighlightTimeoutRef.current);
        detalleHighlightTimeoutRef.current = null;
      }
      return;
    }

    if (detalleOverlayOpen) {
      if (detalleHighlighted) {
        setDetalleHighlighted(false);
      }
      if (detalleHighlightTimeoutRef.current) {
        clearTimeout(detalleHighlightTimeoutRef.current);
        detalleHighlightTimeoutRef.current = null;
      }
      return;
    }

    if (!wasOverlayOpen) {
      return;
    }

    if (detalleHighlighted) {
      setDetalleHighlighted(false);
    }
    if (detalleHighlightTimeoutRef.current) {
      clearTimeout(detalleHighlightTimeoutRef.current);
      detalleHighlightTimeoutRef.current = null;
    }
  }, [detalleOverlayOpen, detalleHighlighted, modalOpen]);

  useEffect(() => () => {
    if (detalleHighlightTimeoutRef.current) {
      clearTimeout(detalleHighlightTimeoutRef.current);
      detalleHighlightTimeoutRef.current = null;
    }
  }, []);

  const adminLinks = useMemo(() => adminNavigationLinks, []);

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
    setDetalleOverlayOpen(false);
    setDetalleHighlighted(false);
    if (detalleHighlightTimeoutRef.current) {
      clearTimeout(detalleHighlightTimeoutRef.current);
      detalleHighlightTimeoutRef.current = null;
    }
  };

  const selectedEmpleado = useMemo(
    () => empleados.find((emp) => String(emp.id_empleado) === formData.id_empleado),
    [empleados, formData.id_empleado]
  );

  const empleadosFiltrados = useMemo(() => {
    const terminoBusqueda = wizardSearch.trim().toLowerCase();

    return empleados.filter((empleado) => {
      const nombreCompleto = `${empleado.nombre || ""} ${empleado.apellido || ""}`.toLowerCase();
      const coincideBusqueda =
        terminoBusqueda.length === 0 ||
        nombreCompleto.includes(terminoBusqueda) ||
        String(empleado.id_empleado).includes(terminoBusqueda);

      if (!coincideBusqueda) {
        return false;
      }

      const tipoNormalizado = normalizarTipoPago(empleado.tipo_pago);

      if (wizardTipoPagoFiltro === "todos") {
        return true;
      }

      if (wizardTipoPagoFiltro === "diario") {
        return tipoNormalizado === "diario";
      }

      if (wizardTipoPagoFiltro === "quincenal") {
        return tipoNormalizado === "quincenal";
      }

      return true;
    });
  }, [empleados, wizardSearch, wizardTipoPagoFiltro]);

  const empleadosNavegables = useMemo(
    () => (isEditing ? empleados : empleadosFiltrados),
    [empleados, empleadosFiltrados, isEditing]
  );

  const empleadosConPlanillaEnPeriodo = useMemo(() => {
    const inicioSeleccionado = parseDateSafe(formData.periodo_inicio);
    const finSeleccionado = parseDateSafe(formData.periodo_fin);

    if (!inicioSeleccionado || !finSeleccionado) {
      return new Set();
    }

    return planillas.reduce((acumulador, planillaActual) => {
      const empleadoId = resolveEmpleadoId(planillaActual);

      if (empleadoId === null || empleadoId === undefined) {
        return acumulador;
      }

      const planillaInicio = parseDateSafe(planillaActual.periodo_inicio);
      const planillaFin = parseDateSafe(planillaActual.periodo_fin);

      if (!planillaInicio || !planillaFin) {
        return acumulador;
      }

      const noSeTraslapan = finSeleccionado < planillaInicio || inicioSeleccionado > planillaFin;

      if (!noSeTraslapan) {
        acumulador.add(String(empleadoId));
      }

      return acumulador;
    }, new Set());
  }, [formData.periodo_inicio, formData.periodo_fin, planillas]);

  useEffect(() => {
    if (empleadosNavegables.length === 0) {
      if (activeEmpleadoIndex !== 0) {
        setActiveEmpleadoIndex(0);
      }
      return;
    }

    const indiceActual = empleadosNavegables.findIndex(
      (emp) => String(emp.id_empleado) === formData.id_empleado
    );

    if (indiceActual === -1) {
      if (isEditing) {
        return;
      }

      const primerEmpleado = empleadosNavegables[0];

      if (primerEmpleado) {
        setActiveEmpleadoIndex(0);
        selectEmpleado(primerEmpleado.id_empleado);
      }
      return;
    }

    if (indiceActual !== activeEmpleadoIndex) {
      setActiveEmpleadoIndex(indiceActual);
    }
  }, [
    activeEmpleadoIndex,
    empleadosNavegables,
    formData.id_empleado,
    isEditing,
    selectEmpleado,
  ]);

  const autoResizeTextarea = useCallback((element) => {
    if (!element) return;

    // Reset height to properly calculate the scroll height with the latest content.
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, []);

  const restoreDetalleFieldFocus = useCallback((target) => {
    if (!target || typeof window === "undefined") {
      return;
    }

    const { detalleField, detalleIndex, detalleContext } = target.dataset || {};

    if (!detalleField || detalleIndex === undefined || !detalleContext) {
      return;
    }

    const selectionStart =
      typeof target.selectionStart === "number" ? target.selectionStart : null;
    const selectionEnd =
      typeof target.selectionEnd === "number" ? target.selectionEnd : null;
    const selectionDirection = target.selectionDirection || "none";

    window.requestAnimationFrame(() => {
      let element = target;

      if (!element.isConnected) {
        element = document.querySelector(
          `[data-detalle-field="${detalleField}"][data-detalle-index="${detalleIndex}"][data-detalle-context="${detalleContext}"]`
        );
      }

      if (!element) {
        return;
      }

      if (document.activeElement !== element) {
        element.focus({ preventScroll: true });
      }

      if (
        element === document.activeElement &&
        selectionStart !== null &&
        selectionEnd !== null &&
        typeof element.setSelectionRange === "function"
      ) {
        try {
          element.setSelectionRange(selectionStart, selectionEnd, selectionDirection);
        } catch {
          // Some input types (e.g. "number") may not support setSelectionRange in every browser.
        }
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const textareas = document.querySelectorAll(
      '[data-detalle-field="justificacion"]'
    );

    textareas.forEach((element) => {
      autoResizeTextarea(element);
    });
  }, [detalleDias, autoResizeTextarea]);

  const DetalleResumenBadges = ({ className = "" }) => (
    <div className={`flex flex-wrap items-center gap-3 text-xs text-gray-500 ${className}`}>
      <span>Días: {detalleDias.length}</span>
      <span>Pagados: {detalleDiasResumen.diasAsistidos}</span>
      <span>Dobles: {diasDoblesAplicados}</span>
      <span>Faltas: {detalleDiasResumen.diasFaltantes}</span>
      <span>Total detalle: {formatCurrency(detalleDiasResumen.salarioTotal)}</span>
      <span>Extra días dobles: {formatCurrency(pagoExtraDiasDobles)}</span>
    </div>
  );

  const AttendanceStatusMessage = ({ className = "" }) => {
    if (attendanceState.error) {
      return (
        <p className={`text-xs font-medium text-red-600 ${className}`.trim()}>
          {attendanceState.error}
        </p>
      );
    }

    if (attendanceState.loading) {
      return (
        <p className={`text-xs text-blue-600 ${className}`.trim()}>
          Actualizando asistencia...
        </p>
      );
    }

    if (attendanceState.message) {
      return (
        <p className={`text-xs text-gray-500 ${className}`.trim()}>
          {attendanceState.message}
        </p>
      );
    }

    if (attendanceState.dias !== null) {
      const dias = Number(attendanceState.dias) || 0;
      const labelDias = dias === 1 ? "día" : "días";
      return (
        <p className={`text-xs text-gray-500 ${className}`.trim()}>
          Asistencia sincronizada ({dias} {labelDias} registrados).
        </p>
      );
    }

    return null;
  };

  const DetalleTable = ({ className = "", context = "main" }) => {
    if (detalleDias.length === 0) {
      return (
        <p className={`text-sm text-gray-500 ${className}`}>
          Selecciona un colaborador y un periodo para visualizar el detalle diario de la planilla.
        </p>
      );
    }

    const handleJustificacionChange = (event, rowIndex) => {
      const { target } = event;
      const { value } = target;
      autoResizeTextarea(target);
      updateDetalleDia(rowIndex, { justificacion: value });
      restoreDetalleFieldFocus(target);
    };

    const handleSalarioChange = (event, rowIndex) => {
      const { target } = event;
      updateDetalleDia(rowIndex, { salario_dia: target.value });
      restoreDetalleFieldFocus(target);
    };

    const handleObservacionChange = (event, rowIndex) => {
      const { target } = event;
      updateDetalleDia(rowIndex, { observacion: target.value });
      restoreDetalleFieldFocus(target);
    };

    const handleSalarioBlur = (event, rowIndex) => {
      const { value } = event.target;
      if (value === "" || value === null) {
        updateDetalleDia(rowIndex, { salario_dia: "" });
        return;
      }
      normalizeDetalleSalario(rowIndex);
    };

    return (
      <div className={`overflow-x-auto rounded-xl border border-gray-100 ${className}`}>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Día</th>
              <th className="px-4 py-3 text-center">Asistencia</th>
              <th className="px-4 py-3 text-center">Tipo</th>
              <th className="px-4 py-3 text-left min-w-[160px]">Estado</th>
              <th className="px-4 py-3 text-center">Justificado</th>
              <th className="px-4 py-3 text-left min-w-[240px]">Justificación</th>
              <th className="px-4 py-3 text-right">Salario día</th>
              <th className="px-4 py-3 text-left">Observación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {detalleDias.map((detalle, index) => (
              <tr key={`${detalle.fecha}-${index}`} className="hover:bg-gray-50/70">
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(detalle.fecha)}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{detalle.dia_semana}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleDetalleAsistencia(index)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      detalle.asistio
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-100 text-red-600 hover:bg-red-200"
                    }`}
                  >
                    {detalle.asistio ? "Asistió" : "Faltó"}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleDetalleDiaDoble(index)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      detalle.es_dia_doble
                        ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {detalle.es_dia_doble ? "Día doble" : "Normal"}
                  </button>
                </td>
                <td className="px-4 py-3 min-w-[160px]">
                  <select
                    value={detalle.estado || "Presente"}
                    onChange={(event) => updateDetalleDia(index, { estado: event.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {detalleEstadoOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={Boolean(detalle.justificado)}
                    onChange={(event) => updateDetalleDia(index, { justificado: event.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <textarea
                    value={detalle.justificacion || ""}
                    onChange={(event) => handleJustificacionChange(event, index)}
                    placeholder="Describe la justificación"
                    rows={2}
                    maxLength={500}
                    disabled={!detalle.justificado}
                    data-detalle-field="justificacion"
                    data-detalle-index={index}
                    data-detalle-context={context}
                    ref={autoResizeTextarea}
                    className="w-full min-h-[3rem] rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none overflow-hidden disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detalle.salario_dia ?? ""}
                    onChange={(event) => handleSalarioChange(event, index)}
                    onBlur={(event) => handleSalarioBlur(event, index)}
                    data-detalle-field="salario_dia"
                    data-detalle-index={index}
                    data-detalle-context={context}
                    className="w-28 rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={detalle.observacion || ""}
                    onChange={(event) => handleObservacionChange(event, index)}
                    placeholder="Opcional"
                    data-detalle-field="observacion"
                    data-detalle-index={index}
                    data-detalle-context={context}
                    className="w-full rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const tipoPago = selectedEmpleado?.tipo_pago || "Quincenal";
  const salarioBaseReferencia = Number(selectedEmpleado?.salario_monto) || 0;
  const montoHorasExtras = Math.max(Number(formData.horas_extras || 0), 0);
  const bonificaciones = Number(formData.bonificaciones || 0);
  const deduccionesManualInput = Number(formData.deducciones || 0);
  const usaDetalleParaCalculos = detalleDias.length > 0;
  const diasTrabajadosValor = Number(formData.dias_trabajados);
  const diasTrabajadosAplicados = usaDetalleParaCalculos
    ? detalleDiasResumen.diasAsistidos
    : Number.isNaN(diasTrabajadosValor) || diasTrabajadosValor < 0
      ? 0
      : diasTrabajadosValor;
  const diasDescuentoValor = Number(formData.dias_descuento);
  const diasDescuentoAplicados =
    Number.isNaN(diasDescuentoValor) || diasDescuentoValor < 0 ? 0 : diasDescuentoValor;
  const montoDescuentoDiasValor =
    formData.monto_descuento_dias === "" || formData.monto_descuento_dias === null
      ? null
      : Number(formData.monto_descuento_dias);
  const montoDescuentoDiasAplicado =
    montoDescuentoDiasValor === null || Number.isNaN(montoDescuentoDiasValor) || montoDescuentoDiasValor < 0
      ? null
      : montoDescuentoDiasValor;
  const salarioDiarioReferencia =
    tipoPago === "Diario" ? salarioBaseReferencia : salarioBaseReferencia / 15;
  const diasDoblesValor = Number(formData.dias_dobles);
  const diasDoblesManual = Number.isNaN(diasDoblesValor) || diasDoblesValor < 0 ? 0 : diasDoblesValor;
  const ingresoManualDiasDobles =
    (formData.monto_dias_dobles !== "" && formData.monto_dias_dobles !== null) || diasDoblesManual > 0;
  const usaDoblesManual = !usaDetalleParaCalculos || ingresoManualDiasDobles;
  const diasDoblesAplicados = usaDoblesManual
    ? diasDoblesManual
    : Number(detalleDiasResumen.diasDobles) || 0;
  const montoDiasDoblesValor =
    formData.monto_dias_dobles === "" || formData.monto_dias_dobles === null
      ? null
      : Number(formData.monto_dias_dobles);
  const montoDiasDoblesManual =
    montoDiasDoblesValor === null || Number.isNaN(montoDiasDoblesValor) || montoDiasDoblesValor < 0
      ? null
      : montoDiasDoblesValor;
  const pagoExtraDiasDobles = (() => {
    if (!usaDoblesManual) {
      const resumenMonto = Number(detalleDiasResumen.montoDiasDobles) || 0;
      return Math.max(resumenMonto, 0);
    }
    if (montoDiasDoblesManual !== null) {
      return Math.max(montoDiasDoblesManual, 0);
    }
    const calculado = salarioDiarioReferencia * diasDoblesAplicados;
    return Number.isNaN(calculado) || calculado < 0 ? 0 : calculado;
  })();
  const salarioBasePeriodo = (() => {
    if (usaDetalleParaCalculos) {
      const resumenTotal = Number(detalleDiasResumen.salarioTotal) || 0;
      if (usaDoblesManual) {
        const resumenExtra = Number(detalleDiasResumen.montoDiasDobles) || 0;
        const baseSinExtra = resumenTotal - resumenExtra;
        const ajustado = baseSinExtra + pagoExtraDiasDobles;
        return Math.max(ajustado, 0);
      }
      return Math.max(resumenTotal, 0);
    }
    if (tipoPago === "Diario") {
      const base = salarioDiarioReferencia * diasTrabajadosAplicados + pagoExtraDiasDobles;
      return Number.isNaN(base) || base < 0 ? 0 : base;
    }
    const base = Math.max(salarioBaseReferencia, 0);
    return usaDoblesManual ? base + pagoExtraDiasDobles : base;
  })();

  let deduccionDiasCalculada = 0;
  if (tipoPago === "Quincenal") {
    if (usaDetalleParaCalculos) {
      deduccionDiasCalculada = 0;
    } else {
      if (montoDescuentoDiasAplicado !== null) {
        deduccionDiasCalculada = montoDescuentoDiasAplicado;
      } else {
        deduccionDiasCalculada = salarioDiarioReferencia * diasDescuentoAplicados;
      }
    }
  }
  deduccionDiasCalculada = Math.max(
    0,
    Math.min(deduccionDiasCalculada, Math.max(salarioBasePeriodo, 0))
  );
  const salarioBrutoEstimado = salarioBasePeriodo + bonificaciones + montoHorasExtras;
  const usaDeduccionFija = Boolean(Number(selectedEmpleado?.usa_deduccion_fija));
  const porcentajeCCSS = Number(selectedEmpleado?.porcentaje_ccss);
  const deduccionFija = Number(selectedEmpleado?.deduccion_fija);
  const porcentajeAplicable = Number.isNaN(porcentajeCCSS) ? 0 : porcentajeCCSS;
  const deduccionFijaAplicable = Number.isNaN(deduccionFija) ? 0 : deduccionFija;
  const deduccionesManualesAplicables =
    Number.isNaN(deduccionesManualInput) || deduccionesManualInput < 0
      ? 0
      : deduccionesManualInput;
  const deduccionesPrestamos = Number(totalPrestamosSeleccionados || 0);
  const salarioBaseParaCCSS = Math.max(salarioBrutoEstimado - deduccionDiasCalculada, 0);
  const ccssDeduccionEstimado = usaDeduccionFija
    ? deduccionFijaAplicable
    : salarioBaseParaCCSS * (porcentajeAplicable / 100);
  const deduccionDiasResumen = tipoPago === "Quincenal" ? deduccionDiasCalculada : 0;
  const totalDeduccionesEstimado =
    deduccionesManualesAplicables + deduccionesPrestamos + deduccionDiasResumen + ccssDeduccionEstimado;
  const pagoNetoEstimado = salarioBrutoEstimado - totalDeduccionesEstimado;

  useEffect(() => {
    if (!modalOpen || isEditing) return;
    setWizardSearch("");
    setWizardTipoPagoFiltro("todos");
  }, [modalOpen, isEditing]);

  useEffect(() => {
    if (!modalOpen) return;

    if (isEditing || formData.id_empleado) {
      setMobileModalSection("detalle");
      return;
    }

    setMobileModalSection("selector");
  }, [formData.id_empleado, isEditing, modalOpen]);

  const handleCambiarEmpleado = (nuevoEmpleado) => {
    if (!nuevoEmpleado) return;
    selectEmpleado(nuevoEmpleado.id_empleado);
  };

  const handleToggleWizardTipoPagoFiltro = () => {
    setWizardTipoPagoFiltro((previousValue) => {
      const currentIndex = WIZARD_TIPO_PAGO_VALUES.indexOf(previousValue);
      const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % WIZARD_TIPO_PAGO_VALUES.length;
      return WIZARD_TIPO_PAGO_VALUES[nextIndex];
    });
  };

  const wizardTipoPagoFiltroLabel =
    WIZARD_TIPO_PAGO_LABELS[wizardTipoPagoFiltro] ?? WIZARD_TIPO_PAGO_LABELS.todos;

  const obtenerCuotaSugerida = (prestamo) => {
    const saldo = Math.max(Number(prestamo?.saldo) || 0, 0);
    const cuotas = Math.max(Number(prestamo?.cuotas) || 1, 1);
    const monto = Math.max(Number(prestamo?.monto) || saldo, saldo);
    const cuota = monto / cuotas;
    if (!Number.isFinite(cuota) || cuota <= 0) return saldo;
    return Math.min(Number(cuota.toFixed(2)), saldo);
  };

  if (!user) return <p>Cargando usuario...</p>;
  if (user.id_rol !== 1) return <p>No tienes permisos para ver esta página.</p>;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        links={adminLinks}
        roleColor="blue"
        isMobileOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex flex-col flex-grow">
        <Navbar
          title="Panel de Administración"
          user={user}
          roleColor="blue"
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onLogout={logoutUser}
        />

        <main className="flex-grow p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Planilla</h1>
              <p className="text-gray-500 text-sm">
                Calcula y registra los pagos correspondientes a cada periodo.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setError("");
                openCreateModal();
              }}
            >
              Generar planilla
            </Button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <section className="bg-white shadow rounded-xl p-4 space-y-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-800">Exportar resumen</h2>
                <p className="text-sm text-gray-600">
                  Descarga un PDF o Excel con todas las planillas registradas.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={exportingResumen === "pdf"}
                  onClick={() => handleExportResumen("pdf")}
                >
                  {exportingResumen === "pdf" ? "Generando..." : "Exportar PDF"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={exportingResumen === "excel"}
                  onClick={() => handleExportResumen("excel")}
                >
                  {exportingResumen === "excel" ? "Generando..." : "Exportar Excel"}
                </Button>
              </div>
            </div>
            {exportResumenMessage && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-sm">
                {exportResumenMessage}
              </div>
            )}
            {exportResumenError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                {exportResumenError}
              </div>
            )}
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <article className="bg-white shadow rounded-xl p-4">
              <p className="text-sm text-gray-500">Planillas registradas</p>
              <p className="text-3xl font-semibold text-gray-800">{resumenPlanillas.cantidad}</p>
            </article>
            <article className="bg-white shadow rounded-xl p-4">
              <p className="text-sm text-gray-500">Pago neto acumulado</p>
              <p className="text-3xl font-semibold text-gray-800">{resumenPlanillas.totalPago}</p>
            </article>
          </section>

          {/* Tabla */}
          <section className="bg-white shadow rounded-xl overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-4 space-y-4">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Listado de planillas</h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <div className="flex flex-col gap-1 text-sm text-gray-600">
                  <label className="font-medium" htmlFor="filtro-tipo-pago">
                    Tipo de pago
                  </label>
                  <select
                    id="filtro-tipo-pago"
                    value={tipoPagoFiltro}
                    onChange={(event) => setTipoPagoFiltro(event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="todos">Todos</option>
                    <option value="diario">Pago diario</option>
                    <option value="quincenal">Pago quincenal</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1 text-sm text-gray-600">
                  <label className="font-medium" htmlFor="filtro-empleado">
                    Colaborador
                  </label>
                  <select
                    id="filtro-empleado"
                    value={empleadoFiltro}
                    onChange={(event) => setEmpleadoFiltro(event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    <option value="todos">Todos</option>
                    {(Array.isArray(empleados) ? empleados : []).map((empleado) => {
                      const id = (empleado?.id_empleado ?? empleado?.id ?? "").toString();
                      if (!id) return null;
                      return (
                        <option key={id} value={id}>
                          {obtenerNombreCompletoEmpleado(empleado)} (#{id})
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="flex flex-col gap-1 text-sm text-gray-600">
                  <label className="font-medium" htmlFor="busqueda-empleado">
                    Buscar colaborador
                  </label>
                  <input
                    id="busqueda-empleado"
                    type="search"
                    placeholder="Nombre, apellido o ID"
                    value={busquedaEmpleado}
                    onChange={(event) => setBusquedaEmpleado(event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm text-gray-600">
                  <label className="font-medium" htmlFor="filtro-fecha-inicio">
                    Desde
                  </label>
                  <input
                    id="filtro-fecha-inicio"
                    type="date"
                    value={fechaInicioFiltro}
                    onChange={(event) => setFechaInicioFiltro(event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
                <div className="flex flex-col gap-1 text-sm text-gray-600">
                  <label className="font-medium" htmlFor="filtro-fecha-fin">
                    Hasta
                  </label>
                  <input
                    id="filtro-fecha-fin"
                    type="date"
                    value={fechaFinFiltro}
                    onChange={(event) => setFechaFinFiltro(event.target.value)}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>
            </div>
            {loading ? (
              <p className="p-6">Cargando planillas...</p>
            ) : totalPlanillas === 0 ? (
              <p className="p-6 text-gray-600">No hay planillas registradas.</p>
            ) : planillasFiltradas.length === 0 ? (
              <p className="p-6 text-gray-600">
                No hay planillas registradas para el filtro seleccionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Periodo</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Tipo de pago</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Salario base</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Monto horas extras</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Bonificaciones</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">CCSS</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Otras deducciones</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total deducciones</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Salario bruto</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Pago neto</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Fecha pago</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {planillasFiltradas.map((planilla) => {
                      const planillaId = resolvePlanillaId(planilla);
                      const empleadoId = resolveEmpleadoId(planilla);
                      const displayName = buildPlanillaDisplayName(planilla);
                      const salarioBase =
                        getPlanillaNumericField(planilla, [
                          "salario_monto",
                          "salarioMonto",
                          "salario_base",
                          "salarioBase",
                        ]) ?? 0;
                      const horasExtras =
                        getPlanillaNumericField(planilla, ["horas_extras", "horasExtras"]) ?? 0;
                      const bonificaciones =
                        getPlanillaNumericField(planilla, [
                          "bonificaciones",
                          "bonos",
                          "bonificacionesTotales",
                        ]) ?? 0;
                      const ccss =
                        getPlanillaNumericField(planilla, ["ccss_deduccion", "ccssDeduccion"]) ?? 0;
                      const deducciones =
                        getPlanillaNumericField(planilla, [
                          "deducciones",
                          "otras_deducciones",
                          "otrasDeducciones",
                        ]) ?? 0;
                      const salarioBruto =
                        getPlanillaNumericField(planilla, ["salario_bruto", "salarioBruto"]) ?? 0;
                      const pagoNeto =
                        getPlanillaNumericField(planilla, ["pago_neto", "pagoNeto"]) ?? 0;
                      const fechaPago = getPlanillaDateField(planilla, ["fecha_pago", "fechaPago"]);
                      const keyFallback = `${empleadoId ?? "planilla"}-${planilla.periodo_inicio ?? ""}-${
                        planilla.periodo_fin ?? ""
                      }`;
                      const totalDeducciones = deducciones + ccss;

                      return (
                        <tr key={planillaId ?? keyFallback} className="hover:bg-gray-50">
                          <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-800">
                            {displayName}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                            {formatPeriodo(planilla.periodo_inicio, planilla.periodo_fin)}
                          </td>
                          <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                            {obtenerTipoPagoPlanilla(planilla)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {formatCurrency(salarioBase)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {formatCurrency(horasExtras)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {formatCurrency(bonificaciones)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {formatCurrency(ccss)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {formatCurrency(deducciones)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {formatCurrency(totalDeducciones)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm text-gray-600">
                            {formatCurrency(salarioBruto)}
                          </td>
                          <td className="px-4 py-2 text-right text-sm font-semibold text-gray-800">
                            {formatCurrency(pagoNeto)}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-600">
                            {fechaPago ? formatDate(fechaPago) : "Pendiente"}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <div className="flex justify-center gap-2">
                              <Button
                                variant="secondary"
                                size="sm"
                                disabled={!planillaId}
                                onClick={() => {
                                  if (!planillaId) return;
                                  navigate(`/admin/planilla/${planillaId}`, {
                                    state: { planilla: clonePlanillaWithCanonicalFields(planilla) },
                                  });
                                }}
                              >
                                Ver detalle
                              </Button>
                              <Button variant="warning" size="sm" onClick={() => handleEdit(planilla)}>
                                Editar
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Modal */}
          {modalOpen && (
            <>
              <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-6">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl xl:max-w-6xl flex flex-col max-h-[90vh] overflow-hidden">
                  <div className="flex items-center justify-between border-b px-6 py-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                      {editingPlanilla ? "Actualizar planilla" : "Generar planilla"}
                    </h2>
                    <Button variant="secondary" size="sm" type="button" onClick={closeModal}>
                    Cerrar
                  </Button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 overflow-hidden bg-gray-50">
                    <div
                      ref={modalScrollRef}
                      className="h-full overflow-y-auto px-8 py-6 space-y-6"
                    >
                      {error && (
                        <p className="text-red-500 text-sm bg-red-100 border border-red-200 px-4 py-2 rounded-lg">
                          {error}
                        </p>
                      )}

                      <div className="lg:hidden">
                        <div className="mb-2 flex rounded-xl bg-gray-100 p-1 text-xs font-semibold text-gray-600">
                          <button
                            type="button"
                            onClick={() => setMobileModalSection("selector")}
                            className={`flex-1 rounded-lg px-3 py-2 transition ${
                              mobileModalSection === "selector"
                                ? "bg-white text-blue-700 shadow"
                                : "hover:bg-white"
                            }`}
                          >
                            Colaborador
                          </button>
                          <button
                            type="button"
                            onClick={() => setMobileModalSection("detalle")}
                            disabled={!isEditing && !formData.id_empleado}
                            className={`flex-1 rounded-lg px-3 py-2 transition ${
                              mobileModalSection === "detalle"
                                ? "bg-white text-blue-700 shadow"
                                : "hover:bg-white"
                            } ${
                              !isEditing && !formData.id_empleado
                                ? "cursor-not-allowed opacity-60"
                                : ""
                            }`}
                          >
                            Detalle y resumen
                          </button>
                        </div>
                        <p className="text-[11px] text-gray-500">
                          Selecciona un colaborador y luego cambia a la pestaña de Detalle para ver el formulario completo.
                        </p>
                      </div>

                      <div className="flex flex-col gap-6 lg:flex-row">
                        <aside
                          className={`space-y-6 lg:w-80 flex-shrink-0 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1 lg:min-h-0 ${
                            mobileModalSection === "detalle" ? "hidden lg:block" : ""
                          }`}
                        >
                          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4 flex flex-col min-h-0 lg:max-h-[60vh]">
                            {isEditing ? (
                              <div className="space-y-4">
                                <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm">
                                  <p className="text-xs uppercase tracking-wide text-blue-700">Colaborador</p>
                                  {selectedEmpleado ? (
                                    <div className="mt-3 space-y-2 text-sm text-blue-900">
                                      <p className="text-base font-semibold text-blue-900">
                                        {obtenerNombreCompletoEmpleado(selectedEmpleado)}
                                      </p>
                                      <p className="text-sm">
                                        <span className="font-medium">Identificación:</span>{" "}
                                        {selectedEmpleado.cedula || selectedEmpleado.id_empleado}
                                      </p>
                                      {selectedEmpleado.puesto_nombre && (
                                        <p className="text-sm">
                                          <span className="font-medium">Puesto:</span>{" "}
                                          {selectedEmpleado.puesto_nombre}
                                        </p>
                                      )}
                                      <p className="text-sm">
                                        <span className="font-medium">Tipo de pago:</span>{" "}
                                        {formatearTipoPago(selectedEmpleado.tipo_pago)}
                                      </p>
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-blue-800">
                                      No se encontró la información del colaborador asociado a esta planilla.
                                    </p>
                                  )}
                                </div>

                              </div>
                            ) : (
                              <>
                                {!selectedEmpleado && (
                                  <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                                    Selecciona un colaborador desde la lista para ver sus datos.
                                  </div>
                                )}

                                <div className="space-y-3">
                                  <div className="sm:col-span-2">
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={handleToggleWizardTipoPagoFiltro}
                                      className="flex w-full items-center justify-between gap-3 text-xs uppercase tracking-wide text-gray-600 sm:text-sm"
                                      aria-label="Cambiar filtro de tipo de pago"
                                    >
                                      <span className="text-[11px] sm:text-xs">Tipo de pago</span>
                                      <span className="text-sm font-semibold text-gray-800 normal-case">
                                        {wizardTipoPagoFiltroLabel}
                                      </span>
                                    </Button>
                                  </div>
                                  <div className="space-y-2">
                                    <label className="text-xs font-semibold text-gray-500" htmlFor="buscador-empleado">
                                      Buscar colaborador
                                    </label>
                                    <input
                                      id="buscador-empleado"
                                      type="text"
                                      placeholder="Nombre o ID"
                                      value={wizardSearch}
                                      onChange={(event) => setWizardSearch(event.target.value)}
                                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                  </div>
                                </div>
                                <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-[12rem]">
                                  {empleadosFiltrados.length === 0 ? (
                                    <p className="text-sm text-gray-500">
                                      No hay colaboradores que coincidan con la búsqueda o el filtro.
                                    </p>
                                  ) : (
                                    empleadosFiltrados.map((empleado, index) => {
                                      const esActivo = formData.id_empleado === String(empleado.id_empleado);
                                      const tienePlanillaEnPeriodo = empleadosConPlanillaEnPeriodo.has(
                                        String(empleado.id_empleado)
                                      );

                                      const estadoBase = tienePlanillaEnPeriodo
                                        ? "border-amber-300 bg-amber-50 text-amber-700 hover:border-amber-400 hover:bg-amber-100"
                                        : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50";

                                      const estadoActivo = tienePlanillaEnPeriodo
                                        ? "border-amber-500 bg-amber-100 text-amber-800 shadow-sm"
                                        : "border-blue-400 bg-blue-50 text-blue-700";

                                      return (
                                        <button
                                          key={empleado.id_empleado}
                                          type="button"
                                          onClick={() => {
                                            setActiveEmpleadoIndex(index);
                                            handleCambiarEmpleado(empleado);
                                            setMobileModalSection("detalle");
                                          }}
                                          className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                                            esActivo ? estadoActivo : estadoBase
                                          }`}
                                        >
                                          <p className="font-semibold">
                                            {empleado.nombre} {empleado.apellido}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            #{empleado.id_empleado} · {formatearTipoPago(empleado.tipo_pago)}
                                          </p>
                                          {tienePlanillaEnPeriodo && (
                                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                                              Planilla generada en el periodo
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                        </aside>

                        <div
                          className={`flex-1 min-w-0 space-y-6 ${
                            mobileModalSection === "selector" ? "hidden lg:block" : ""
                          }`}
                        >
                          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:max-h-[60vh] lg:overflow-y-auto">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
                              <h3 className="text-base font-semibold text-gray-800">Datos del periodo</h3>
                              <div className="flex items-center gap-2">
                                {detalleDias.length > 0 && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="px-3 py-1 text-xs"
                                    onClick={() => setDetalleOverlayOpen(true)}
                                  >
                                    Abrir detalle en pantalla completa
                                  </Button>
                                )}
                                {isEditing && (
                                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                                    Edición
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:pr-1">
                              {isEditing ? (
                                <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-3">
                                  <label htmlFor="id_empleado" className="text-sm font-medium text-gray-700">
                                    Empleado
                                  </label>
                                  <select
                                    id="id_empleado"
                                    name="id_empleado"
                                    value={formData.id_empleado}
                                    onChange={handleChange}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                                    disabled={Boolean(editingPlanilla)}
                                    required={!editingPlanilla}
                                  >
                                    <option value="">Selecciona un empleado</option>
                                    {empleados.map((empleado) => (
                                      <option key={empleado.id_empleado} value={empleado.id_empleado}>
                                        {empleado.nombre} {empleado.apellido}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <>
                                  <input type="hidden" name="id_empleado" value={formData.id_empleado} />
                                  <div className="md:col-span-2 xl:col-span-3">
                                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                      {selectedEmpleado ? (
                                        <p>
                                          <span className="font-semibold">{selectedEmpleado.nombre} {selectedEmpleado.apellido}</span>
                                          {" · ID "}
                                          {selectedEmpleado.id_empleado}
                                        </p>
                                      ) : (
                                        <p>Selecciona un colaborador desde la barra lateral.</p>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}

                              <div className="flex flex-col gap-2">
                                <label htmlFor="periodo_inicio" className="text-sm font-medium text-gray-700">
                                  Fecha inicio del periodo
                                </label>
                                <input
                                  type="date"
                                  id="periodo_inicio"
                                  name="periodo_inicio"
                                  value={formData.periodo_inicio}
                                  onChange={handleChange}
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                                  disabled={Boolean(editingPlanilla)}
                                  required={!editingPlanilla}
                                />
                              </div>

                              <div className="flex flex-col gap-2">
                                <label htmlFor="periodo_fin" className="text-sm font-medium text-gray-700">
                                  Fecha fin del periodo
                                </label>
                                <input
                                  type="date"
                                  id="periodo_fin"
                                  name="periodo_fin"
                                  value={formData.periodo_fin}
                                  onChange={handleChange}
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                                  disabled={Boolean(editingPlanilla)}
                                  required={!editingPlanilla}
                                />
                              </div>

                              <div className="flex flex-col gap-2">
                                <label htmlFor="fecha_pago" className="text-sm font-medium text-gray-700">
                                  Fecha de pago
                                </label>
                                <input
                                  type="date"
                                  id="fecha_pago"
                                  name="fecha_pago"
                                  value={formData.fecha_pago}
                                  onChange={handleChange}
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div className="flex flex-col gap-2">
                                <label htmlFor="horas_extras" className="text-sm font-medium text-gray-700">
                                  Monto horas extras (₡)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  id="horas_extras"
                                  name="horas_extras"
                                  value={formData.horas_extras}
                                  onChange={handleChange}
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div className="flex flex-col gap-2">
                                <label htmlFor="bonificaciones" className="text-sm font-medium text-gray-700">
                                  Bonificaciones (₡)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  id="bonificaciones"
                                  name="bonificaciones"
                                  value={formData.bonificaciones}
                                  onChange={handleChange}
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                                />
                              </div>

                              <div className="flex flex-col gap-2">
                                <label htmlFor="deducciones" className="text-sm font-medium text-gray-700">
                                  Deducciones adicionales (₡)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  id="deducciones"
                                  name="deducciones"
                                  value={formData.deducciones}
                                  onChange={handleChange}
                                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                                />
                              </div>
                            </div>

                            {!isEditing && (
                              <div className="mt-4">
                                <div className="space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h3 className="text-sm font-semibold text-gray-700">Préstamos asociados a la planilla</h3>
                                    {deduccionesPrestamos > 0 && (
                                      <span className="text-xs font-semibold text-blue-600">
                                        Total seleccionado: {formatCurrency(deduccionesPrestamos)}
                                      </span>
                                    )}
                                  </div>

                                  {prestamosEmpleado.length === 0 ? (
                                    <p className="text-sm text-gray-500">
                                      Este colaborador no tiene préstamos aprobados con saldo pendiente.
                                    </p>
                                  ) : (
                                    <div className="space-y-3">
                                      {prestamosEmpleado.map((prestamo) => {
                                        const seleccion = prestamoSelections[prestamo.id_prestamo];
                                        const estaSeleccionado = Boolean(seleccion?.aplicar);
                                        const cuotaSugerida = obtenerCuotaSugerida(prestamo);
                                        const montoSeleccionado = estaSeleccionado
                                          ? seleccion?.monto ?? cuotaSugerida
                                          : cuotaSugerida;

                                        return (
                                          <div
                                            key={prestamo.id_prestamo}
                                            className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                                          >
                                            <div className="flex items-start gap-3">
                                              <input
                                                type="checkbox"
                                                checked={estaSeleccionado}
                                                onChange={() => togglePrestamo(prestamo.id_prestamo)}
                                                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              <div className="flex-1 space-y-3">
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                  <div>
                                                    <p className="text-sm font-semibold text-gray-800">
                                                      Préstamo #{prestamo.id_prestamo}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                      Solicitado el {formatDate(prestamo.fecha_solicitud)} · {prestamo.cuotas} cuotas
                                                    </p>
                                                  </div>
                                                  <div className="text-right">
                                                    <p className="text-xs text-gray-500">Saldo pendiente</p>
                                                    <p className="text-sm font-semibold text-gray-800">
                                                      {formatCurrency(prestamo.saldo)}
                                                    </p>
                                                  </div>
                                                </div>

                                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                  <p className="text-xs text-gray-500">
                                                    Cuota sugerida: {formatCurrency(cuotaSugerida)}
                                                  </p>
                                                  <div className="flex items-center gap-2">
                                                    <label className="text-xs text-gray-500" htmlFor={`prestamo-${prestamo.id_prestamo}`}>
                                                      Monto a descontar
                                                    </label>
                                                    <input
                                                      id={`prestamo-${prestamo.id_prestamo}`}
                                                      type="number"
                                                      min="0"
                                                      step="0.01"
                                                      value={Number(montoSeleccionado || 0).toString()}
                                                      onChange={(event) =>
                                                        updateMontoPrestamo(prestamo.id_prestamo, event.target.value)
                                                      }
                                                      disabled={!estaSeleccionado}
                                                      className="w-32 rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                                    />
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}

                                      <p className="text-xs text-gray-500">
                                        Los montos seleccionados se sumarán automáticamente a las deducciones de esta planilla.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            <div className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                              <p className="text-xs uppercase tracking-wide text-gray-500">Monto neto estimado a pagar</p>
                              <p className="mt-1 text-xl font-semibold text-gray-800">{formatCurrency(pagoNetoEstimado)}</p>
                              <p className="mt-1 text-xs text-gray-600">
                                {tipoPago === "Diario"
                                  ? "Incluye salario diario según los días aplicados, montos por días dobles, bonificaciones y todas las deducciones seleccionadas."
                                  : "Este monto considera salario base, bonificaciones y deducciones aplicables para el periodo actual."}
                              </p>
                            </div>
                          </div>

                          <div
                            ref={detalleSectionRef}
                            tabIndex={-1}
                            className={`rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-shadow focus:outline-none ${
                              detalleHighlighted ? "ring-2 ring-blue-300" : ""
                            }`}
                          >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h3 className="text-base font-semibold text-gray-800">Detalle diario del periodo</h3>
                              <AttendanceStatusMessage className="mt-1" />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <DetalleResumenBadges />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={refreshAttendance}
                                disabled={attendanceState.loading}
                              >
                                {attendanceState.loading ? "Recalculando..." : "Recalcular asistencia"}
                              </Button>
                            </div>
                          </div>

                          <DetalleTable className="mt-4" context="main" />
                          </div>

                          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <h3 className="text-base font-semibold text-gray-800">Resumen económico estimado</h3>
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                              <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-sm md:col-span-2 xl:col-span-3">
                                <p className="text-xs uppercase tracking-wide text-blue-600">Total a pagar estimado</p>
                                <p className="mt-1 text-2xl font-semibold text-blue-900">{formatCurrency(pagoNetoEstimado)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Salario base del periodo</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(salarioBasePeriodo)}</p>
                              </div>
                              {tipoPago === "Diario" && (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Días pagados</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800">{diasTrabajadosAplicados}</p>
                                </div>
                              )}
                              {tipoPago === "Diario" && (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Días dobles a pagar</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800">{diasDoblesAplicados}</p>
                                </div>
                              )}
                              {tipoPago === "Diario" && (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Pago extra días dobles</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(pagoExtraDiasDobles)}</p>
                                </div>
                              )}
                              {tipoPago === "Quincenal" && (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Días a descontar</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800">{diasDescuentoAplicados}</p>
                                </div>
                              )}
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Monto horas extras</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(montoHorasExtras)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Bonificaciones</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(bonificaciones)}</p>
                              </div>
                              {tipoPago === "Quincenal" && (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Deducción por días</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(deduccionDiasResumen)}</p>
                                </div>
                              )}
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">CCSS estimado</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(ccssDeduccionEstimado)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Deducciones adicionales</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(deduccionesManualesAplicables)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Deducciones por préstamos</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(deduccionesPrestamos)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Total deducciones</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(totalDeduccionesEstimado)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Salario bruto estimado</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(salarioBrutoEstimado)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-white px-8 pb-6 pt-4">
                    <Button variant="secondary" size="sm" type="button" onClick={closeModal}>
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" type="submit">
                      {editingPlanilla ? "Actualizar" : "Generar planilla"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

              {detalleOverlayOpen && (
                <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-6">
                  <div className="absolute inset-0" onClick={() => setDetalleOverlayOpen(false)} />
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Detalle diario del periodo"
                    className="relative z-10 flex w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[calc(100vh-3rem)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-4">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-gray-800">Detalle diario del periodo</h3>
                        <p className="text-sm text-gray-500">
                          Actualiza asistencias, marca días dobles y ajusta los montos directamente en esta vista ampliada.
                        </p>
                        <AttendanceStatusMessage />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <DetalleResumenBadges className="text-sm" />
                        <Button
                          variant="outline"
                          size="sm"
                          type="button"
                          onClick={refreshAttendance}
                          disabled={attendanceState.loading}
                        >
                          {attendanceState.loading ? "Recalculando..." : "Recalcular"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          type="button"
                          onClick={() => setDetalleOverlayOpen(false)}
                        >
                          Cancelar
                        </Button>
                        <Button variant="secondary" size="sm" type="button" onClick={() => setDetalleOverlayOpen(false)}>
                          Aceptar cambios
                        </Button>
                      </div>
                    </div>
                    <div
                      ref={detalleOverlayFocusRef}
                      tabIndex={-1}
                      className="flex-1 overflow-y-auto px-6 py-6 focus:outline-none"
                      style={{ WebkitOverflowScrolling: "touch" }}
                    >
                      <DetalleTable
                        className={detalleDias.length === 0 ? "" : "mt-2"}
                        context="overlay"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Planilla;
