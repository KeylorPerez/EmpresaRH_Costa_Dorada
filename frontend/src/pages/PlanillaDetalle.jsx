import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import api from "../api/axiosConfig";
import planillaService from "../services/planillaService";
import {
  adminLinks as adminNavigationLinks,
  empleadoLinks as empleadoNavigationLinks,
} from "../utils/navigationLinks";
import {
  buildPlanillaDisplayName,
  ensurePlanillaArrayCanonical,
  ensurePlanillaCanonical,
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

const parseMonto = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;

    let cleaned = trimmed.replace(/\s+/g, "");
    const hasComma = cleaned.includes(",");
    const hasDot = cleaned.includes(".");

    if (hasComma && hasDot) {
      const lastComma = cleaned.lastIndexOf(",");
      const lastDot = cleaned.lastIndexOf(".");
      if (lastComma > lastDot) {
        cleaned = cleaned.replace(/\./g, "");
      }
    }

    if (hasComma) {
      cleaned = cleaned.replace(/,/g, ".");
    }

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const formatCurrency = (value) => currencyFormatter.format(parseMonto(value));

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

const getFileNameFromUrl = (url) => {
  if (!url) return "";
  try {
    const parsedUrl = new URL(url, window.location.origin);
    const segments = parsedUrl.pathname.split("/").filter(Boolean);
    if (segments.length > 0) {
      return decodeURIComponent(segments[segments.length - 1]);
    }
  } catch (err) {
    console.error("No se pudo interpretar el nombre del archivo desde la URL", err);
  }
  return "";
};

const normalizeFileUrl = (url) => {
  if (!url) return "";

  try {
    const resolvedUrl = new URL(url, window.location.origin);

    if (window.location.protocol === "https:" && resolvedUrl.protocol === "http:") {
      resolvedUrl.protocol = "https:";
    }

    return resolvedUrl.toString();
  } catch {
    if (url.startsWith("//")) return `${window.location.protocol}${url}`;
    if (url.startsWith("/")) return `${window.location.origin}${url}`;
    return url;
  }
};

const PlanillaDetalle = ({ mode = "admin" }) => {
  const { user, logoutUser } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const isAdminMode = mode === "admin";
  const isEmpleadoMode = mode === "empleado";
  const roleColor = isAdminMode ? "blue" : "green";
  const backPath = isAdminMode ? "/admin/planilla" : "/empleado/planilla";
  const pageTitle = isAdminMode ? "Panel de Administración" : "Panel del Empleado";

  const locationStatePlanilla = location.state?.planilla;
  const initialPlanilla = locationStatePlanilla
    ? ensurePlanillaCanonical(locationStatePlanilla)
    : null;

  const planillaId = Number(id);
  const [idError, setIdError] = useState("");
  const [detalle, setDetalle] = useState([]);
  const [detalleLoading, setDetalleLoading] = useState(true);
  const [detalleError, setDetalleError] = useState("");
  const [planillaInfo, setPlanillaInfo] = useState(initialPlanilla);
  const [planillaInfoLoading, setPlanillaInfoLoading] = useState(() => !initialPlanilla);
  const [planillaInfoError, setPlanillaInfoError] = useState("");
  const [exportingFormat, setExportingFormat] = useState(null);
  const [exportMessage, setExportMessage] = useState("");
  const [exportErrorMessage, setExportErrorMessage] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const sidebarLinks = useMemo(
    () => (isAdminMode ? adminNavigationLinks : empleadoNavigationLinks),
    [isAdminMode]
  );

  useEffect(() => {
    if (Number.isNaN(planillaId)) {
      setIdError("Identificador de planilla inválido.");
      setDetalleLoading(false);
      setPlanillaInfoLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDetalle = async () => {
      setDetalleLoading(true);
      setDetalleError("");
      try {
        const data = await planillaService.getDetalle(planillaId);
        if (cancelled) return;
        const dias = Array.isArray(data)
          ? data.map((item) => {
              const estadoNormalizado =
                typeof item.estado === "string" && item.estado.trim() !== ""
                  ? item.estado.trim()
                  : "Presente";
              const asistenciaNormalizada =
                typeof item.asistencia === "string" && item.asistencia.trim() !== ""
                  ? item.asistencia.trim()
                  : "";
              const esDescanso =
                Boolean(item.es_descanso) ||
                estadoNormalizado.toLowerCase() === "descanso" ||
                asistenciaNormalizada.toLowerCase() === "descanso";
              const estadoFinal = esDescanso ? "Descanso" : estadoNormalizado;

              return {
                ...item,
                asistio: Boolean(item.asistio),
                es_dia_doble: Boolean(item.es_dia_doble),
                estado: estadoFinal,
                es_descanso: esDescanso,
                justificado:
                  item.justificado === true || item.justificado === 1 || item.justificado === "1",
                justificacion:
                  item.justificacion === undefined || item.justificacion === null
                    ? ""
                    : String(item.justificacion),
              };
            })
          : [];
        setDetalle(dias);
      } catch (err) {
        if (cancelled) return;
        const message =
          err.response?.data?.error || err.message || "Error al cargar el detalle de la planilla.";
        setDetalleError(message);
        setDetalle([]);
      } finally {
        if (!cancelled) {
          setDetalleLoading(false);
        }
      }
    };

    fetchDetalle();

    return () => {
      cancelled = true;
    };
  }, [planillaId]);

  useEffect(() => {
    if (Number.isNaN(planillaId)) {
      setPlanillaInfoLoading(false);
      return;
    }

    if (planillaInfo) {
      setPlanillaInfoLoading(false);
      return;
    }

    let cancelled = false;

    const fetchPlanillaInfo = async () => {
      setPlanillaInfoLoading(true);
      setPlanillaInfoError("");
      try {
        const data = await planillaService.getAll();
        if (cancelled) return;
        const lista = ensurePlanillaArrayCanonical(data);
        const encontrada =
          lista.find((item) => Number(resolvePlanillaId(item)) === planillaId) || null;
        if (!encontrada) {
          setPlanillaInfoError("No se encontró la planilla solicitada.");
        }
        setPlanillaInfo(encontrada);
      } catch (err) {
        if (cancelled) return;
        const message =
          err.response?.data?.error || err.message || "Error al cargar la información de la planilla.";
        setPlanillaInfoError(message);
        setPlanillaInfo(null);
      } finally {
        if (!cancelled) {
          setPlanillaInfoLoading(false);
        }
      }
    };

    fetchPlanillaInfo();

    return () => {
      cancelled = true;
    };
  }, [planillaId, planillaInfo]);

  const handleGenerateExport = async (format, { openInNewTab = true, silent = false } = {}) => {
    if (Number.isNaN(planillaId)) {
      setExportErrorMessage("Identificador de planilla inválido.");
      return null;
    }

    setExportErrorMessage("");
    if (!silent) {
      setExportMessage("");
    }
    setExportingFormat(format);

    try {
      const data = await planillaService.exportFile(planillaId, format);
      const fileUrl = normalizeFileUrl(data?.url);
      const responseFormat = data?.format || format;
      const filename = data?.filename || "";

      if (!fileUrl) {
        throw new Error("No se recibió la URL del archivo generado.");
      }

      if (openInNewTab) {
        window.open(fileUrl, "_blank", "noopener");
      }

      if (!silent) {
        setExportMessage(
          responseFormat === "excel"
            ? "Archivo de Excel generado correctamente."
            : "Archivo PDF generado correctamente."
        );
      }

      return { url: fileUrl, filename, format: responseFormat };
    } catch (err) {
      const message =
        err.response?.data?.error || err.message || "No se pudo generar el archivo solicitado.";
      setExportErrorMessage(message);
      return null;
    } finally {
      setExportingFormat(null);
    }
  };

  const handleShare = async () => {
    setExportErrorMessage("");
    setExportMessage("");
    const exportData = await handleGenerateExport("pdf", { openInNewTab: false, silent: true });
    if (!exportData?.url) {
      return;
    }

    const { url, filename: providedFileName } = exportData;
    const fallbackFileName = providedFileName || getFileNameFromUrl(url) || `planilla-${planillaId}.pdf`;

    try {
      const response = await api.get(url, {
        responseType: "blob",
        headers: { Accept: "application/pdf" },
      });

      const blob = response.data;
      const fileType = blob.type || "application/pdf";
      const fileName = fallbackFileName.endsWith(".pdf")
        ? fallbackFileName
        : `${fallbackFileName}.pdf`;

      if (typeof File === "function") {
        const shareFile = new File([blob], fileName, { type: fileType });

        if (
          typeof navigator.share === "function" &&
          typeof navigator.canShare === "function" &&
          navigator.canShare({ files: [shareFile] })
        ) {
          await navigator.share({
            files: [shareFile],
            title: `Planilla #${planillaId}`,
            text: "Te comparto la planilla generada desde el sistema.",
          });
          setExportMessage("PDF compartido correctamente.");
          return;
        }
      }

      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      setExportMessage("Descarga completada. Comparte el PDF manualmente desde tu dispositivo.");
    } catch (err) {
      setExportErrorMessage(err.message || "No se pudo completar la acción de compartir.");
    }
  };

  const resolveAsistenciaBadge = (item) => {
    if (item.es_descanso && !item.asistio) {
      return {
        label: "Descanso",
        className: "bg-slate-100 text-slate-700",
      };
    }

    const asistenciaTexto =
      (typeof item.asistencia === "string" && item.asistencia.trim().length > 0
        ? item.asistencia.trim()
        : null) || (item.asistio ? "Asistió" : "Faltó");

    return {
      label: asistenciaTexto,
      className: item.asistio ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600",
    };
  };

  const planillaDisplayName = useMemo(
    () => (planillaInfo ? buildPlanillaDisplayName(planillaInfo) : ""),
    [planillaInfo]
  );

  const planillaEmpleadoId = useMemo(
    () => (planillaInfo ? resolveEmpleadoId(planillaInfo) : null),
    [planillaInfo]
  );

  const planillaFechaPago = useMemo(
    () => (planillaInfo ? getPlanillaDateField(planillaInfo, ["fecha_pago", "fechaPago"]) : null),
    [planillaInfo]
  );

  const planillaTipoPago = useMemo(
    () =>
      planillaInfo
        ? formatearTipoPago(getPlanillaTipoPagoValue(planillaInfo), {
            etiquetaPorDefecto: "No especificado",
          })
        : "No especificado",
    [planillaInfo]
  );

  const detalleResumen = useMemo(() => {
    if (!detalle || detalle.length === 0) {
      return { dias: 0, asistencias: 0, total: 0 };
    }

    return detalle.reduce(
      (acumulado, item) => {
        const salario = parseMonto(item.salario_dia);
        const factor = item.es_dia_doble ? 2 : 1;
        if (item.asistio) {
          acumulado.asistencias += factor;
          acumulado.total += salario * factor;
        }
        acumulado.dias += 1;
        return acumulado;
      },
      { dias: 0, asistencias: 0, total: 0 }
    );
  }, [detalle]);

  const planillaMetricas = useMemo(() => {
    if (!planillaInfo) {
      return null;
    }

    const salarioBase =
      getPlanillaNumericField(
        planillaInfo,
        ["salario_monto", "salarioMonto", "salario_base", "salarioBase"],
        { includeNested: true }
      ) ?? 0;
    const montoHorasExtras = Math.max(
      getPlanillaNumericField(planillaInfo, ["horas_extras", "horasExtras"]) ?? 0,
      0
    );
    const bonificaciones = getPlanillaNumericField(planillaInfo, ["bonificaciones", "bonos"]) ?? 0;
    const deducciones = Math.max(
      getPlanillaNumericField(planillaInfo, ["deducciones", "otras_deducciones", "otrasDeducciones"]) ?? 0,
      0
    );
    const ccss = Math.max(
      getPlanillaNumericField(planillaInfo, ["ccss_deduccion", "ccssDeduccion"]) ?? 0,
      0
    );
    const salarioBruto =
      getPlanillaNumericField(planillaInfo, ["salario_bruto", "salarioBruto"]) ??
      salarioBase + bonificaciones + montoHorasExtras;
    const pagoNeto = getPlanillaNumericField(planillaInfo, ["pago_neto", "pagoNeto"]) ?? 0;

    return {
      salarioBase,
      horasExtras: montoHorasExtras,
      bonificaciones,
      deducciones,
      ccss,
      totalDeducciones: deducciones + ccss,
      salarioBruto,
      pagoNeto,
    };
  }, [planillaInfo]);

  const isExportingPdf = exportingFormat === "pdf";
  const isExportingExcel = exportingFormat === "excel";
  const exportDisabled = Number.isNaN(planillaId) || planillaInfoLoading || detalleLoading;

  if (!user) return <p>Cargando usuario...</p>;
  if (isAdminMode && user.id_rol !== 1)
    return <p>No tienes permisos para ver esta página.</p>;
  if (isEmpleadoMode && user.id_rol !== 2)
    return <p>No tienes permisos para ver esta página.</p>;

  return (
    <div className="flex h-screen overflow-y-hidden overflow-x-auto bg-gray-100">
      <Sidebar
        links={sidebarLinks}
        roleColor={roleColor}
        isMobileOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex flex-col flex-grow overflow-x-auto">
        <Navbar
          title={pageTitle}
          user={user}
          roleColor={roleColor}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onLogout={logoutUser}
        />

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Detalle planilla #{Number.isNaN(planillaId) ? "-" : planillaId}
              </h1>
              <p className="text-sm text-gray-500">
                Consulta el resumen diario y los montos calculados para el colaborador seleccionado.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleGenerateExport("pdf")}
                disabled={exportDisabled || isExportingPdf}
              >
                {isExportingPdf ? "Generando PDF..." : "📄 Exportar PDF"}
              </Button>
              <Button
                variant="success"
                size="sm"
                onClick={() => handleGenerateExport("excel")}
                disabled={exportDisabled || isExportingExcel}
              >
                {isExportingExcel ? "Generando Excel..." : "📊 Exportar Excel"}
              </Button>
              <Button
                variant="warning"
                size="sm"
                onClick={handleShare}
                disabled={exportDisabled || exportingFormat !== null}
              >
                {exportingFormat ? "Procesando..." : "📤 Compartir"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => navigate(backPath)}>
                Volver a planilla
              </Button>
            </div>
          </div>

          {(exportMessage || exportErrorMessage) && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm ${
                exportErrorMessage
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}
            >
              {exportErrorMessage || exportMessage}
            </div>
          )}

          {idError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {idError}
            </div>
          )}

          {!idError && planillaInfoLoading && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 text-sm text-gray-500">
              Cargando información de la planilla...
            </div>
          )}

          {!idError && !planillaInfoLoading && planillaInfoError && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
              {planillaInfoError}
            </div>
          )}

          {!idError && !planillaInfoLoading && planillaInfo && (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl bg-white p-4 shadow">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Colaborador</p>
                  <p className="mt-1 text-lg font-semibold text-gray-800">
                    {planillaDisplayName}
                  </p>
                  <p className="text-xs text-gray-500">
                    ID empleado: {planillaEmpleadoId ?? "-"}
                  </p>
                </article>
                <article className="rounded-xl bg-white p-4 shadow">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Periodo</p>
                  <p className="mt-1 text-lg font-semibold text-gray-800">
                    {formatPeriodo(planillaInfo.periodo_inicio, planillaInfo.periodo_fin)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Fecha de pago: {planillaFechaPago ? formatDate(planillaFechaPago) : "Pendiente"}
                  </p>
                </article>
                <article className="rounded-xl bg-white p-4 shadow">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Tipo de pago</p>
                  <p className="mt-1 text-lg font-semibold text-gray-800">
                    {planillaTipoPago}
                  </p>
                  <p className="text-xs text-gray-500">
                    Salario referencia: {formatCurrency(planillaMetricas?.salarioBase)}
                  </p>
                </article>
                <article className="rounded-xl bg-white p-4 shadow">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Resumen de asistencias</p>
                  <p className="mt-1 text-lg font-semibold text-gray-800">
                    {detalleResumen.dias} días · {detalleResumen.asistencias} asistencias efectivas
                  </p>
                  <p className="text-xs text-gray-500">
                    Total estimado: {formatCurrency(detalleResumen.total)}
                  </p>
                </article>
              </section>

              {planillaMetricas && (
                <section className="grid gap-4 md:grid-cols-3">
                  <article className="rounded-xl bg-white p-4 shadow">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Ingresos</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>Salario base: {formatCurrency(planillaMetricas.salarioBase)}</p>
                      <p>Monto horas extras: {formatCurrency(planillaMetricas.horasExtras)}</p>
                      <p>Bonificaciones: {formatCurrency(planillaMetricas.bonificaciones)}</p>
                      <p className="font-semibold text-gray-800">
                        Salario bruto: {formatCurrency(planillaMetricas.salarioBruto)}
                      </p>
                    </div>
                  </article>
                  <article className="rounded-xl bg-white p-4 shadow">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Deducciones</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>CCSS: {formatCurrency(planillaMetricas.ccss)}</p>
                      <p>Otras deducciones: {formatCurrency(planillaMetricas.deducciones)}</p>
                      <p className="font-semibold text-gray-800">
                        Total deducciones: {formatCurrency(planillaMetricas.totalDeducciones)}
                      </p>
                    </div>
                  </article>
                  <article className="rounded-xl bg-white p-4 shadow">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Pago neto</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>Monto neto a pagar:</p>
                      <p className="text-2xl font-semibold text-gray-800">
                        {formatCurrency(planillaMetricas.pagoNeto)}
                      </p>
                    </div>
                  </article>
                </section>
              )}
            </>
          )}

          <section className="rounded-xl bg-white shadow">
            <header className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800">Detalle diario del periodo</h2>
              <p className="text-sm text-gray-500">
                Cada fila corresponde a un día del periodo. Marca asistencias, días dobles y revisa observaciones.
              </p>
            </header>
            <div className="px-6 py-4">
              {detalleLoading ? (
                <p className="text-sm text-gray-500">Cargando detalle...</p>
              ) : detalleError ? (
                <p className="text-sm text-red-600">{detalleError}</p>
              ) : detalle.length === 0 ? (
                <p className="text-sm text-gray-500">Esta planilla no tiene detalles registrados.</p>
              ) : (
                <div className="rounded-lg border border-gray-200">
                  <div className="max-h-[65vh] overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left">Fecha</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left">Día</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-center">Asistencia</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-center">Tipo</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left">Estado</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-center">Justificado</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left">Justificación</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-right">Salario día</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left">Observación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {detalle.map((item) => (
                          <tr key={`${item.id_detalle}-${item.fecha}`} className="hover:bg-gray-50/70">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(item.fecha)}</td>
                            <td className="px-4 py-3 capitalize text-gray-600">{item.dia_semana}</td>
                            <td className="px-4 py-3 text-center">
                              {(() => {
                                const asistenciaBadge = resolveAsistenciaBadge(item);
                                return (
                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${asistenciaBadge.className}`}
                                  >
                                    {asistenciaBadge.label}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              {(() => {
                                const tipoTexto =
                                  (typeof item.tipo === "string" && item.tipo.trim().length > 0
                                    ? item.tipo.trim()
                                    : null) || (item.es_dia_doble ? "Día doble" : "Normal");

                                return (
                                  <span
                                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                      item.es_dia_doble
                                        ? "bg-purple-100 text-purple-700"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {tipoTexto}
                                  </span>
                                );
                              })()}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {(() => {
                                if (typeof item.estado === "string") {
                                  const texto = item.estado.trim();
                                  if (texto.length > 0) return texto;
                                }
                                return "-";
                              })()}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  item.justificado
                                    ? "bg-indigo-100 text-indigo-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {item.justificado ? "Sí" : "No"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {item.justificacion && item.justificacion.trim() !== ""
                                ? item.justificacion
                                : "-"}
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                              {formatCurrency(item.salario_dia)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.observacion || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

PlanillaDetalle.propTypes = {
  mode: PropTypes.oneOf(["admin", "empleado"]),
};

export default PlanillaDetalle;
