import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import {
  useLiquidaciones,
  estadosLiquidacion,
  formatearMontoCRC,
  formatearFechaCorta,
} from "../hooks/useLiquidaciones";

const diasFormatter = new Intl.NumberFormat("es-CR", { maximumFractionDigits: 0 });

const formatPeriodoMensual = (periodo) => {
  if (!periodo) return "—";
  if (typeof periodo === "string" && /^\d{4}-\d{2}$/.test(periodo)) {
    const [year, month] = periodo.split("-").map((segment) => Number(segment));
    if (Number.isInteger(year) && Number.isInteger(month)) {
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString("es-CR", { month: "short", year: "numeric" });
    }
  }
  const parsed = new Date(periodo);
  if (Number.isNaN(parsed.getTime())) {
    return periodo;
  }
  return parsed.toLocaleDateString("es-CR", { month: "short", year: "numeric" });
};

const formatDiasLabel = (value) => {
  if (value === null || value === undefined) return "—";
  const numero = Number(value);
  if (Number.isNaN(numero)) return "—";
  return `${diasFormatter.format(numero)} días`;
};

const mapResumenEditable = (encabezado = {}) => ({
  salario_promedio_mensual:
    encabezado.salario_promedio_mensual !== undefined ? encabezado.salario_promedio_mensual : "",
  salario_promedio_diario:
    encabezado.salario_promedio_diario !== undefined ? encabezado.salario_promedio_diario : "",
  salario_acumulado:
    encabezado.salario_acumulado !== undefined ? encabezado.salario_acumulado : "",
  dias_trabajados_aguinaldo:
    encabezado.dias_trabajados_aguinaldo !== undefined ? encabezado.dias_trabajados_aguinaldo : "",
  dias_pendientes_vacaciones:
    encabezado.dias_pendientes_vacaciones !== undefined ? encabezado.dias_pendientes_vacaciones : "",
  dias_preaviso: encabezado.dias_preaviso !== undefined ? encabezado.dias_preaviso : "",
  dias_cesantia: encabezado.dias_cesantia !== undefined ? encabezado.dias_cesantia : "",
});

const mapHistoricoEditable = (historicos = []) => {
  if (!Array.isArray(historicos)) return [];
  return historicos.map((registro) => ({
    periodo: registro.periodo || "",
    monto: registro.monto ?? "",
  }));
};

const numberInputBaseClasses =
  "w-full border border-transparent rounded-md bg-white/70 text-right text-sm font-semibold text-gray-900 focus:border-blue-300 focus:ring-2 focus:ring-blue-200 px-2 py-1";

const PanelResumenLiquidacion = ({ encabezado, editable = false, onChange, onReset }) => {
  if (!encabezado) return null;

  const handleValueChange = (campo, valor) => {
    if (typeof onChange === "function") {
      onChange(campo, valor);
    }
  };

  const renderMontoField = (label, campo) => {
    const value = encabezado[campo];
    if (!editable) {
      return (
        <div className="flex items-center justify-between">
          <span>{label}</span>
          <span className="font-semibold">{formatearMontoCRC(value)}</span>
        </div>
      );
    }

    return (
      <label className="flex flex-col gap-1 text-sm text-blue-900">
        <span className="text-xs font-medium uppercase tracking-wide text-blue-600">{label}</span>
        <input
          type="number"
          step="0.01"
          className={numberInputBaseClasses}
          value={value ?? ""}
          onChange={(event) => handleValueChange(campo, event.target.value)}
        />
      </label>
    );
  };

  const renderDiasField = (label, campo) => {
    const value = encabezado[campo];
    if (!editable) {
      return (
        <div>
          <p className="text-xs uppercase text-amber-500">{label}</p>
          <p className="font-semibold">{formatDiasLabel(value)}</p>
        </div>
      );
    }

    return (
      <label className="flex flex-col gap-1 text-xs text-amber-800">
        <span className="font-semibold tracking-wide">{label}</span>
        <input
          type="number"
          step="1"
          className={`${numberInputBaseClasses} text-amber-900 border-amber-100 focus:border-amber-200 focus:ring-amber-100`}
          value={value ?? ""}
          onChange={(event) => handleValueChange(campo, event.target.value)}
        />
      </label>
    );
  };

  const {
    salario_promedio_mensual,
    salario_promedio_diario,
    salario_acumulado,
    dias_trabajados_aguinaldo,
    dias_pendientes_vacaciones,
    dias_preaviso,
    dias_cesantia,
  } = encabezado;

  const mostrarMontos = [
    salario_promedio_mensual,
    salario_promedio_diario,
    salario_acumulado,
  ].some((valor) => valor !== null && valor !== undefined);

  const mostrarDias = [
    dias_trabajados_aguinaldo,
    dias_pendientes_vacaciones,
    dias_preaviso,
    dias_cesantia,
  ].some((valor) => valor !== null && valor !== undefined);

  if (!mostrarMontos && !mostrarDias) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {mostrarMontos && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-4 text-sm text-blue-900">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              Resumen salarial
            </p>
            {editable && (
              <button
                type="button"
                onClick={() => onReset && onReset()}
                className="text-[11px] font-semibold text-blue-700 hover:text-blue-900"
              >
                Restablecer
              </button>
            )}
          </div>
          <div className="mt-3 space-y-3">
            {renderMontoField("Promedio mensual", "salario_promedio_mensual")}
            {renderMontoField("Promedio diario", "salario_promedio_diario")}
            {renderMontoField("Salario acumulado", "salario_acumulado")}
          </div>
        </div>
      )}
      {mostrarDias && (
        <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-4 text-sm text-amber-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">
            Días considerados
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {renderDiasField("Aguinaldo", "dias_trabajados_aguinaldo")}
            {renderDiasField("Vacaciones", "dias_pendientes_vacaciones")}
            {renderDiasField("Preaviso", "dias_preaviso")}
            {renderDiasField("Cesantía", "dias_cesantia")}
          </div>
        </div>
      )}
    </div>
  );
};

const TablaHistoricoSalarios = ({
  registros,
  editable = false,
  onChange,
  onAddRow,
  onRemoveRow,
  onReset,
}) => {
  const filas = Array.isArray(registros) ? registros : [];
  const mostrarTabla = filas.length > 0 || editable;
  if (!mostrarTabla) return null;

  const handleFieldChange = (index, campo, valor) => {
    if (typeof onChange === "function") {
      onChange(index, campo, valor);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-sm font-semibold text-gray-800">Desglose de salarios por mes</p>
        {editable && (
          <div className="flex flex-wrap gap-2 text-xs">
            <button
              type="button"
              onClick={() => onReset && onReset()}
              className="rounded border border-gray-200 px-3 py-1 font-semibold text-gray-600 hover:bg-gray-50"
            >
              Restablecer
            </button>
            <button
              type="button"
              onClick={() => onAddRow && onAddRow()}
              className="rounded border border-blue-200 px-3 py-1 font-semibold text-blue-600 hover:bg-blue-50"
            >
              Agregar mes
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
            <tr>
              <th className="px-4 py-2 text-left">Periodo</th>
              <th className="px-4 py-2 text-right">Monto</th>
              {editable && <th className="px-4 py-2 text-right">Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && editable ? (
              <tr>
                <td className="px-4 py-4 text-center text-gray-500" colSpan={editable ? 3 : 2}>
                  Añade los montos de los últimos seis meses para personalizar el cálculo.
                </td>
              </tr>
            ) : (
              filas.map((fila, index) => (
                <tr key={`${fila.periodo || index}-${index}`} className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-800">
                    {editable ? (
                      <input
                        type="month"
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        value={fila.periodo || ""}
                        onChange={(event) => handleFieldChange(index, "periodo", event.target.value)}
                      />
                    ) : (
                      formatPeriodoMensual(fila.periodo)
                    )}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-800">
                    {editable ? (
                      <input
                        type="number"
                        step="0.01"
                        className="w-full rounded-md border border-gray-200 px-2 py-1 text-right text-sm focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                        value={fila.monto ?? ""}
                        onChange={(event) => handleFieldChange(index, "monto", event.target.value)}
                      />
                    ) : (
                      formatearMontoCRC(fila.monto)
                    )}
                  </td>
                  {editable && (
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => onRemoveRow && onRemoveRow(index)}
                        className="text-xs font-semibold text-red-600 hover:text-red-800"
                      >
                        Eliminar
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {editable && (
        <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
          Procura mantener al menos los últimos seis meses para reflejar el comportamiento salarial real.
        </div>
      )}
    </div>
  );
};

PanelResumenLiquidacion.propTypes = {
  encabezado: PropTypes.shape({
    salario_promedio_mensual: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    salario_promedio_diario: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    salario_acumulado: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    dias_trabajados_aguinaldo: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    dias_pendientes_vacaciones: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    dias_preaviso: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    dias_cesantia: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  }),
  editable: PropTypes.bool,
  onChange: PropTypes.func,
  onReset: PropTypes.func,
};

PanelResumenLiquidacion.defaultProps = {
  encabezado: null,
  editable: false,
  onChange: null,
  onReset: null,
};

TablaHistoricoSalarios.propTypes = {
  registros: PropTypes.arrayOf(
    PropTypes.shape({
      periodo: PropTypes.oneOfType([PropTypes.string, PropTypes.instanceOf(Date)]),
      monto: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    }),
  ),
  editable: PropTypes.bool,
  onChange: PropTypes.func,
  onAddRow: PropTypes.func,
  onRemoveRow: PropTypes.func,
  onReset: PropTypes.func,
};

TablaHistoricoSalarios.defaultProps = {
  registros: [],
  editable: false,
  onChange: null,
  onAddRow: null,
  onRemoveRow: null,
  onReset: null,
};

const Liquidaciones = ({ mode }) => {
  const { user, logoutUser } = useAuth();
  const {
    liquidaciones,
    loading,
    error,
    successMessage,
    setError,
    setSuccessMessage,
    empleados,
    empleadosLoading,
    draftForm,
    draftDetalles,
    draftTotales,
    previewData,
    detalleSeleccionado,
    detalleLoading,
    handleDraftChange,
    generarPreview,
    actualizarDetalle,
    agregarDetalleManual,
    eliminarDetalle,
    guardarLiquidacion,
    resetDraft,
    submitting,
    actionLoading,
    approveLiquidacion,
    rejectLiquidacion,
    openLiquidacion,
    exportLiquidacion,
    shareLiquidacion,
    exportingId,
    sharingId,
  } = useLiquidaciones();

  const [resumenEditable, setResumenEditable] = useState(null);
  const [resumenDirty, setResumenDirty] = useState(false);
  const [historicoEditable, setHistoricoEditable] = useState([]);
  const [historicoDirty, setHistoricoDirty] = useState(false);

  const isAdmin = mode === "admin";

  const sidebarLinks = useMemo(() => {
    if (isAdmin) {
      return [
        { path: "/admin", label: "Inicio" },
        { path: "/admin/asistencia", label: "Asistencia" },
        { path: "/admin/usuarios", label: "Usuarios" },
        { path: "/admin/empleados", label: "Empleados" },
        { path: "/admin/puestos", label: "Puestos" },
        { path: "/admin/planilla", label: "Planilla" },
        { path: "/admin/vacaciones", label: "Vacaciones" },
        { path: "/admin/prestamos", label: "Préstamos" },
        { path: "/admin/liquidaciones", label: "Liquidaciones" },
        { path: "/admin/aguinaldos", label: "Aguinaldos" },
      ];
    }
    return [
      { path: "/empleado/asistencia", label: "Asistencia" },
      { path: "/empleado/vacaciones", label: "Vacaciones" },
      { path: "/empleado/prestamos", label: "Préstamos" },
      { path: "/empleado/liquidaciones", label: "Liquidaciones" },
      { path: "/empleado/aguinaldos", label: "Aguinaldos" },
    ];
  }, [isAdmin]);

  const roleColor = isAdmin ? "blue" : "green";
  const tituloPagina = isAdmin ? "Liquidaciones híbridas" : "Mis liquidaciones";

  const empleadoSeleccionado = useMemo(() => {
    if (!draftForm.id_empleado) return null;
    return (
      empleados.find(
        (empleado) => String(empleado.id_empleado) === String(draftForm.id_empleado)
      ) || null
    );
  }, [draftForm.id_empleado, empleados]);

  const disableFechaInicio = Boolean(empleadoSeleccionado?.fecha_ingreso);

  useEffect(() => {
    if (previewData?.encabezado) {
      setResumenEditable(mapResumenEditable(previewData.encabezado));
    } else {
      setResumenEditable(null);
    }
    setResumenDirty(false);

    if (previewData?.salarios_historicos) {
      setHistoricoEditable(mapHistoricoEditable(previewData.salarios_historicos));
    } else {
      setHistoricoEditable([]);
    }
    setHistoricoDirty(false);
  }, [previewData]);

  const handleResumenManualChange = (campo, valor) => {
    setResumenDirty(true);
    setResumenEditable((prev) => ({ ...(prev || {}), [campo]: valor }));
  };

  const handleResetResumenManual = () => {
    if (previewData?.encabezado) {
      setResumenEditable(mapResumenEditable(previewData.encabezado));
    } else {
      setResumenEditable(null);
    }
    setResumenDirty(false);
  };

  const handleHistoricoChange = (index, campo, valor) => {
    setHistoricoDirty(true);
    setHistoricoEditable((prev) => {
      const copia = [...prev];
      copia[index] = { ...(copia[index] || {}), [campo]: valor };
      return copia;
    });
  };

  const handleAgregarHistorico = () => {
    setHistoricoDirty(true);
    setHistoricoEditable((prev) => [...prev, { periodo: "", monto: "" }]);
  };

  const handleEliminarHistorico = (index) => {
    setHistoricoDirty(true);
    setHistoricoEditable((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleResetHistorico = () => {
    if (previewData?.salarios_historicos) {
      setHistoricoEditable(mapHistoricoEditable(previewData.salarios_historicos));
    } else {
      setHistoricoEditable([]);
    }
    setHistoricoDirty(false);
  };

  const handleGuardarLiquidacion = (options = {}) => {
    guardarLiquidacion({
      ...options,
      encabezadoOverrides: resumenDirty ? resumenEditable : null,
      salariosHistoricos: historicoDirty ? historicoEditable : null,
    });
  };

  const limpiarMensajes = () => {
    if (error) setError("");
    if (successMessage) setSuccessMessage("");
  };

  const renderEstado = (registro) => {
    const estado = estadosLiquidacion[registro.id_estado] || {
      label: "Pendiente",
      badgeClass: "bg-gray-200 text-gray-700",
    };

    return (
      <span
        className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${estado.badgeClass}`}
      >
        {estado.label}
      </span>
    );
  };

  const renderAcciones = (registro) => {
    if (!isAdmin) return null;
    if (registro.id_estado !== 1) {
      return <span className="text-xs text-gray-500">Sin acciones</span>;
    }

    const isProcessing = Boolean(actionLoading[registro.id_liquidacion]);

    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          size="sm"
          disabled={isProcessing}
          onClick={() => approveLiquidacion(registro)}
        >
          {isProcessing ? "Procesando..." : "Confirmar"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={isProcessing}
          onClick={() => rejectLiquidacion(registro)}
        >
          Rechazar
        </Button>
      </div>
    );
  };

  const renderDetalleSeleccionado = () => {
    if (!detalleSeleccionado) {
      return <p className="text-sm text-gray-500">Selecciona una liquidación para ver el detalle.</p>;
    }

    const puedeExportar = Number(detalleSeleccionado.id_estado) === 2;
    const isExporting = exportingId === detalleSeleccionado.id_liquidacion;
    const isSharing = sharingId === detalleSeleccionado.id_liquidacion;
    const supportsShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
    const resumen = (detalleSeleccionado.detalles || []).reduce(
      (acc, detalle) => {
        const montoBase =
          detalle.monto_final !== null && detalle.monto_final !== undefined
            ? Number(detalle.monto_final)
            : Number(detalle.monto_calculado);
        if (Number.isNaN(montoBase)) {
          return acc;
        }
        if (detalle.tipo === "DESCUENTO") {
          acc.descuentos += montoBase;
        } else {
          acc.ingresos += montoBase;
        }
        return acc;
      },
      { ingresos: 0, descuentos: 0 }
    );

    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-600">
              Liquidación #{detalleSeleccionado.id_liquidacion}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {formatearMontoCRC(detalleSeleccionado.total_pagar)}
            </p>
            <p className="text-xs text-gray-500">
              Generada el {formatearFechaCorta(detalleSeleccionado.fecha_liquidacion)} · Estado: {" "}
              {estadosLiquidacion[detalleSeleccionado.id_estado]?.label || "Pendiente"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={!puedeExportar || isExporting}
              onClick={() => exportLiquidacion(detalleSeleccionado.id_liquidacion)}
            >
              {isExporting ? "Generando PDF..." : "Descargar PDF"}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={!puedeExportar || !supportsShare || isSharing || isExporting}
              onClick={() => shareLiquidacion(detalleSeleccionado.id_liquidacion)}
            >
              {isSharing ? "Compartiendo..." : "Compartir"}
            </Button>
          </div>
        </div>

        {!puedeExportar && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Solo las liquidaciones confirmadas pueden descargarse o compartirse.
          </div>
        )}

        {puedeExportar && !supportsShare && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">
            Tu navegador no permite compartir archivos directamente. Puedes descargar el PDF y enviarlo manualmente.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-xs font-medium text-green-700">Total ingresos</p>
            <p className="text-lg font-semibold text-green-800">
              {formatearMontoCRC(resumen.ingresos)}
            </p>
          </div>
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-xs font-medium text-red-700">Total descuentos</p>
            <p className="text-lg font-semibold text-red-800">
              {formatearMontoCRC(resumen.descuentos)}
            </p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-medium text-blue-700">Total a pagar</p>
            <p className="text-lg font-semibold text-blue-800">
              {formatearMontoCRC(detalleSeleccionado.total_pagar)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="font-semibold text-gray-700">Colaborador</p>
            <p className="text-gray-800">
              {detalleSeleccionado.nombre} {detalleSeleccionado.apellido}
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700">Periodo</p>
            <p className="text-gray-800">
              {formatearFechaCorta(detalleSeleccionado.fecha_inicio_periodo)} — {" "}
              {formatearFechaCorta(detalleSeleccionado.fecha_fin_periodo)}
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700">Motivo</p>
            <p className="text-gray-800 whitespace-pre-line">
              {detalleSeleccionado.motivo_liquidacion || "Sin motivo registrado"}
            </p>
          </div>
          <div>
            <p className="font-semibold text-gray-700">Promedio mensual</p>
            <p className="text-gray-800">
              {formatearMontoCRC(detalleSeleccionado.salario_promedio_mensual)}
            </p>
          </div>
          <div className="md:col-span-2">
            <p className="font-semibold text-gray-700">Observaciones</p>
            <p className="text-gray-800 whitespace-pre-line">
              {detalleSeleccionado.observaciones || "Sin observaciones adicionales"}
            </p>
          </div>
        </div>

      <PanelResumenLiquidacion encabezado={detalleSeleccionado} />

      <TablaHistoricoSalarios registros={detalleSeleccionado.salarios_historicos} />

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Concepto</th>
                <th className="px-4 py-2 text-left">Tipo</th>
                <th className="px-4 py-2 text-right">Monto calculado</th>
                <th className="px-4 py-2 text-right">Monto final</th>
                <th className="px-4 py-2 text-left">Comentario</th>
              </tr>
            </thead>
            <tbody>
              {(detalleSeleccionado.detalles || []).map((detalle) => (
                <tr key={detalle.id_detalle} className="border-b border-gray-100">
                  <td className="px-4 py-2 text-gray-800">{detalle.concepto}</td>
                  <td className="px-4 py-2 text-gray-800">{detalle.tipo}</td>
                  <td className="px-4 py-2 text-gray-800 text-right">
                    {formatearMontoCRC(detalle.monto_calculado)}
                  </td>
                  <td className="px-4 py-2 text-gray-800 text-right">
                    {formatearMontoCRC(
                      detalle.monto_final !== null ? detalle.monto_final : detalle.monto_calculado
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {detalle.comentario || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (!user) {
    return <p className="p-6">Cargando información del usuario...</p>;
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar links={sidebarLinks} roleColor={roleColor} />

      <div className="flex flex-col flex-grow">
        <Navbar
          title={tituloPagina}
          user={user}
          roleColor={roleColor}
          onLogout={() => {
            limpiarMensajes();
            logoutUser();
          }}
        />

        <main className="flex-grow p-6 space-y-6">
          <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{tituloPagina}</h1>
              <p className="text-sm text-gray-500">
                {isAdmin
                  ? "Genera liquidaciones automáticas basadas en planilla y ajústalas antes de confirmarlas."
                  : "Consulta el detalle de tus liquidaciones registradas."}
              </p>
            </div>
            {loading && <span className="text-sm text-gray-500">Cargando información...</span>}
          </header>

          {(error || successMessage) && (
            <div
              className={`rounded-lg border px-4 py-3 text-sm font-medium ${
                error
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-green-200 bg-green-50 text-green-700"
              }`}
            >
              {error || successMessage}
            </div>
          )}

          {isAdmin && (
            <section className="bg-white rounded-xl shadow-sm p-6 space-y-6">
              <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Generar borrador</h2>
                  <p className="text-sm text-gray-500">
                    Selecciona el colaborador y el periodo. El sistema precargará los conceptos y podrás ajustarlos.
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  Total estimado: <span className="font-semibold">{formatearMontoCRC(draftTotales.total_pagar)}</span>
                </div>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                  <select
                    name="id_empleado"
                    value={draftForm.id_empleado}
                    onChange={handleDraftChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">
                      {empleadosLoading ? "Cargando colaboradores..." : "Selecciona un colaborador"}
                    </option>
                    {empleados.map((empleado) => (
                      <option key={empleado.id_empleado} value={empleado.id_empleado}>
                        {empleado.nombre} {empleado.apellido} — ID {empleado.id_empleado}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Fecha de liquidación</label>
                  <input
                    type="date"
                    name="fecha_liquidacion"
                    value={draftForm.fecha_liquidacion}
                    onChange={handleDraftChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Inicio del periodo</label>
                  <input
                    type="date"
                    name="fecha_inicio_periodo"
                    value={draftForm.fecha_inicio_periodo}
                    onChange={handleDraftChange}
                    className={`border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      disableFechaInicio ? "bg-gray-100 cursor-not-allowed" : ""
                    }`}
                    readOnly={disableFechaInicio}
                  />
                  {disableFechaInicio && (
                    <span className="mt-1 text-xs text-gray-500">
                      Esta fecha coincide con la fecha de ingreso del colaborador.
                    </span>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Fin del periodo</label>
                  <input
                    type="date"
                    name="fecha_fin_periodo"
                    value={draftForm.fecha_fin_periodo}
                    onChange={handleDraftChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="md:col-span-2 flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Motivo</label>
                  <textarea
                    name="motivo_liquidacion"
                    value={draftForm.motivo_liquidacion}
                    onChange={handleDraftChange}
                    rows={3}
                    maxLength={300}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Describe brevemente el motivo de la liquidación"
                  />
                  <span className="mt-1 text-xs text-gray-400">Máximo 300 caracteres.</span>
                </div>

                <div className="md:col-span-2 flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Observaciones</label>
                  <textarea
                    name="observaciones"
                    value={draftForm.observaciones}
                    onChange={handleDraftChange}
                    rows={2}
                    maxLength={500}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                    placeholder="Notas adicionales que aparecerán en el reporte"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="button" variant="secondary" onClick={resetDraft}>
                  Limpiar
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={generarPreview}
                  disabled={submitting || !draftForm.id_empleado}
                >
                  {submitting ? "Generando..." : "Generar borrador"}
                </Button>
                <Button
                  type="button"
                  variant="success"
                  onClick={() => handleGuardarLiquidacion({ confirmar: false })}
                  disabled={submitting || draftDetalles.length === 0}
                >
                  {submitting ? "Guardando..." : "Guardar como borrador"}
                </Button>
                <Button
                  type="button"
                  variant="success"
                  onClick={() => handleGuardarLiquidacion({ confirmar: true })}
                  disabled={submitting || draftDetalles.length === 0}
                >
                  {submitting ? "Confirmando..." : "Confirmar liquidación"}
                </Button>
              </div>

              {draftDetalles.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-800">Conceptos calculados</h3>
                    <Button type="button" variant="secondary" onClick={agregarDetalleManual}>
                      Agregar concepto
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                        <tr>
                          <th className="px-4 py-2 text-left">Concepto</th>
                          <th className="px-4 py-2 text-left">Tipo</th>
                          <th className="px-4 py-2 text-right">Monto calculado</th>
                          <th className="px-4 py-2 text-right">Monto final</th>
                          <th className="px-4 py-2 text-left">Comentario</th>
                          <th className="px-4 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {draftDetalles.map((detalle, index) => (
                          <tr key={`${detalle.concepto}-${index}`} className="border-b border-gray-100">
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={detalle.concepto}
                                onChange={(event) => actualizarDetalle(index, "concepto", event.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={detalle.tipo}
                                onChange={(event) => actualizarDetalle(index, "tipo", event.target.value)}
                                className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
                              >
                                <option value="INGRESO">Ingreso</option>
                                <option value="DESCUENTO">Descuento</option>
                              </select>
                            </td>
                            <td className="px-4 py-2 text-right text-gray-600">
                              {formatearMontoCRC(detalle.monto_calculado)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={
                                  detalle.monto_final !== null && detalle.monto_final !== undefined
                                    ? detalle.monto_final
                                    : detalle.monto_calculado
                                }
                                onChange={(event) => actualizarDetalle(index, "monto_final", event.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm text-right"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="text"
                                value={detalle.comentario || ""}
                                onChange={(event) => actualizarDetalle(index, "comentario", event.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm"
                                placeholder="Comentario opcional"
                              />
                            </td>
                            <td className="px-4 py-2 text-center">
                              <Button
                                type="button"
                                variant="danger"
                                size="sm"
                                onClick={() => eliminarDetalle(index)}
                              >
                                Eliminar
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
                    <p className="text-blue-600 font-semibold">Total ingresos</p>
                    <p className="text-lg font-bold text-blue-700">
                      {formatearMontoCRC(draftTotales.totalIngresos)}
                    </p>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                    <p className="text-amber-600 font-semibold">Total descuentos</p>
                    <p className="text-lg font-bold text-amber-700">
                      {formatearMontoCRC(draftTotales.totalDescuentos)}
                    </p>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                    <p className="text-emerald-600 font-semibold">Total a pagar</p>
                    <p className="text-lg font-bold text-emerald-700">
                      {formatearMontoCRC(draftTotales.total_pagar)}
                    </p>
                  </div>
                </div>

                {previewData && (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-blue-100 bg-blue-50/70 p-3 text-xs text-blue-800">
                      Ajusta los promedios y el historial tal como lo harías en una hoja de cálculo. Los cambios se guardarán en
                      el documento final.
                    </div>
                    <PanelResumenLiquidacion
                      encabezado={resumenEditable || previewData.encabezado}
                      editable
                      onChange={handleResumenManualChange}
                      onReset={handleResetResumenManual}
                    />

                    <TablaHistoricoSalarios
                      registros={historicoEditable.length > 0 ? historicoEditable : previewData.salarios_historicos}
                      editable
                      onChange={handleHistoricoChange}
                      onAddRow={handleAgregarHistorico}
                      onRemoveRow={handleEliminarHistorico}
                      onReset={handleResetHistorico}
                    />
                  </div>
                )}

                {previewData?.encabezado?.observaciones && (
                  <div className="border border-dashed border-gray-300 rounded-lg p-3 text-sm text-gray-600">
                    <p className="font-semibold text-gray-700 mb-1">Observaciones previstas</p>
                    <p className="whitespace-pre-line">{previewData.encabezado.observaciones}</p>
                  </div>
                )}
                {previewData && (
                  <div className="border border-gray-200 rounded-lg p-4 text-xs text-gray-600 leading-relaxed bg-gray-50">
                    <p className="font-semibold text-gray-700 mb-2">Nota informativa</p>
                    <p>
                      El presente documento certifica la liquidación de prestaciones laborales correspondiente al periodo comprendido entre {" "}
                      {formatearFechaCorta(previewData.encabezado.fecha_inicio_periodo)} y {" "}
                      {formatearFechaCorta(previewData.encabezado.fecha_fin_periodo)}, calculada con base en la normativa laboral vigente.
                    </p>
                    <p className="mt-2">
                      Las cantidades detalladas han sido revisadas y quedan sujetas a la aprobación final de la Dirección de Recursos Humanos. La empresa asume la responsabilidad de definir y aplicar este monto fijo conforme a sus políticas internas y a la normativa vigente.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

          <section className="bg-white rounded-xl shadow-sm p-6 space-y-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Historial de liquidaciones</h2>
                <p className="text-sm text-gray-500">
                  Consulta las liquidaciones registradas y revisa sus conceptos detallados.
                </p>
              </div>
              {loading && <p className="text-sm text-gray-500">Cargando registros...</p>}
            </header>

            {liquidaciones.length === 0 && !loading ? (
              <p className="text-gray-500 text-sm">Aún no hay liquidaciones registradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                    <tr>
                      {isAdmin && <th className="px-4 py-3 text-left">Colaborador</th>}
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Promedio mensual</th>
                      <th className="px-4 py-3 text-left">Ingresos</th>
                      <th className="px-4 py-3 text-left">Descuentos</th>
                      <th className="px-4 py-3 text-left">Total</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liquidaciones.map((registro) => (
                      <tr
                        key={registro.id_liquidacion}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        {isAdmin && (
                          <td className="px-4 py-3 text-gray-800">
                            <p className="font-semibold">
                              {registro.nombre || "Empleado"} {registro.apellido || ""}
                            </p>
                            <p className="text-xs text-gray-500">ID: {registro.id_empleado}</p>
                          </td>
                        )}
                        <td className="px-4 py-3 text-gray-800">
                          {formatearFechaCorta(registro.fecha_liquidacion || registro.created_at)}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {formatearMontoCRC(registro.salario_promedio_mensual)}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {formatearMontoCRC(registro.total_ingresos_detalle)}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {formatearMontoCRC(registro.total_descuentos_detalle)}
                        </td>
                        <td className="px-4 py-3 text-gray-800">
                          {formatearMontoCRC(registro.total_pagar)}
                        </td>
                        <td className="px-4 py-3">{renderEstado(registro)}</td>
                        <td className="px-4 py-3 space-y-2">
                          {detalleSeleccionado?.id_liquidacion === registro.id_liquidacion && (
                            <span className="block text-xs text-blue-600 font-medium">
                              Detalle abierto
                            </span>
                          )}
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openLiquidacion(registro.id_liquidacion)}
                          >
                            {detalleSeleccionado?.id_liquidacion === registro.id_liquidacion
                              ? "Ocultar detalle"
                              : "Ver detalle"}
                          </Button>
                          {renderAcciones(registro)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-5">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Detalle seleccionado</h3>
              {detalleLoading ? (
                <p className="text-sm text-gray-500">Cargando detalle...</p>
              ) : (
                renderDetalleSeleccionado()
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

Liquidaciones.propTypes = {
  mode: PropTypes.oneOf(["admin", "empleado"]).isRequired,
};

export default Liquidaciones;
