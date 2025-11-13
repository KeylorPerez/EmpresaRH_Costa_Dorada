import React, { useMemo } from "react";
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
                  onClick={() => guardarLiquidacion({ confirmar: false })}
                  disabled={submitting || draftDetalles.length === 0}
                >
                  {submitting ? "Guardando..." : "Guardar como borrador"}
                </Button>
                <Button
                  type="button"
                  variant="success"
                  onClick={() => guardarLiquidacion({ confirmar: true })}
                  disabled={submitting || draftDetalles.length === 0}
                  className="bg-emerald-600 hover:bg-emerald-700"
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
                {previewData?.encabezado?.observaciones && (
                  <div className="border border-dashed border-gray-300 rounded-lg p-3 text-sm text-gray-600">
                    <p className="font-semibold text-gray-700 mb-1">Observaciones previstas</p>
                    <p className="whitespace-pre-line">{previewData.encabezado.observaciones}</p>
                  </div>
                )}
                {previewData && (
                  <div className="border border-gray-200 rounded-lg p-4 text-xs text-gray-600 leading-relaxed bg-gray-50">
                    <p className="font-semibold text-gray-700 mb-2">Texto legal sugerido</p>
                    <p>
                      El presente documento certifica la liquidación de prestaciones laborales correspondiente al periodo {" "}
                      {formatearFechaCorta(previewData.encabezado.fecha_inicio_periodo)} — {" "}
                      {formatearFechaCorta(previewData.encabezado.fecha_fin_periodo)}, calculada con base en la normativa laboral vigente.
                      Las cantidades detalladas han sido revisadas y quedan sujetas a la aprobación final de la dirección de Recursos Humanos.
                    </p>
                    <p className="mt-2">
                      Cualquier ajuste adicional deberá registrarse en el sistema antes de la confirmación definitiva para garantizar la trazabilidad del proceso.
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
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => openLiquidacion(registro.id_liquidacion)}
                          >
                            Ver detalle
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
