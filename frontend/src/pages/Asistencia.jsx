/**
 * Vista de gestión de asistencia. Combina funciones administrativas y de
 * autoservicio según el `mode` recibido, reutilizando el hook `useAsistencia`
 * para centralizar la lógica de negocio (peticiones HTTP, validaciones,
 * geolocalización, exportaciones y flujos de justificaciones). Este archivo se
 * enfoca en la presentación y en orquestar los handlers proporcionados por el
 * hook.
 */
import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { adminLinks, empleadoLinks } from "../utils/navigationLinks";
import {
  formatearFecha,
  formatearHora,
  obtenerEtiquetaEstado,
  obtenerEtiquetaTipo,
  obtenerEtiquetaEstadoSolicitud,
  obtenerEtiquetaTipoJustificacion,
  estadoOptions,
  tipoMarcaOptions,
  useAsistencia,
} from "../hooks/useAsistencia";

const formatBusinessCoordinate = (numericValue, fallback) => {
  const fallbackString = fallback?.toString().trim();
  if (fallbackString) {
    return fallbackString;
  }
  if (Number.isFinite(numericValue)) {
    return numericValue.toString();
  }
  return null;
};

const formatBusinessRadius = (numericValue, fallback) => {
  if (Number.isFinite(numericValue) && numericValue > 0) {
    return Math.round(numericValue);
  }
  const fallbackString = fallback?.toString().trim();
  if (!fallbackString) return null;
  const parsed = Number(fallbackString);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.round(parsed);
  }
  return null;
};

const Asistencia = ({ mode }) => {
  const { user, logoutUser } = useAuth();
  const isAdmin = mode === "admin";
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const editableEstadoOptions = useMemo(
    () => estadoOptions.filter((option) => option.value !== "Ausente"),
    []
  );

  // El hook devuelve tanto el estado como los handlers para cada subsección
  // (marcación, filtros, exportación, edición y justificaciones). Mantener el
  // destructuring explícito aquí hace visible qué capacidades se exponen a la
  // vista y evita dependencias implícitas.
  const {
    registros,
    loading,
    error,
    successMessage,
    formData,
    handleChange,
    handleSubmit,
    submitting,
    resetForm,
    rangeMode,
    toggleRangeMode,
    rangeFilters,
    handleRangeChange,
    handleRangeSubmit,
    clearRangeFilters,
    empleadosOptions,
    selectedEmpleado,
    handleEmpleadoSelect,
    exportingFormat,
    exportAsistencia,
    shareAsistencia,
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
    businessLocation,
  } = useAsistencia({ mode, user });

  const officeLatDisplay = useMemo(
    () => formatBusinessCoordinate(businessLocation?.latitudNumero, businessLocation?.latitud),
    [businessLocation]
  );
  const officeLonDisplay = useMemo(
    () => formatBusinessCoordinate(businessLocation?.longitudNumero, businessLocation?.longitud),
    [businessLocation]
  );
  const officeRadiusDisplay = useMemo(
    () => formatBusinessRadius(businessLocation?.radioNumero, businessLocation?.radio),
    [businessLocation]
  );
  const officeRadiusEffectiveDisplay = useMemo(
    () => formatBusinessRadius(businessLocation?.radioEfectivoNumero, businessLocation?.radio),
    [businessLocation]
  );
  const geofenceConfigured =
    officeLatDisplay !== null &&
    officeLonDisplay !== null &&
    (officeRadiusEffectiveDisplay !== null || officeRadiusDisplay !== null);

  // Construye el menú según el rol para reutilizar el mismo componente de
  // página tanto en modo admin como empleado.
  const sidebarLinks = useMemo(() => {
    if (isAdmin) {
      return adminLinks;
    }
    return empleadoLinks;
  }, [isAdmin]);

  const roleColor = isAdmin ? "blue" : "green";
  const tituloPagina = isAdmin ? "Gestión de Asistencia" : "Mi Asistencia";
  const isExportingPdf = exportingFormat === "pdf";
  const isExportingExcel = exportingFormat === "excel";
  const exportDisabled = submitting || loading || (isAdmin && !selectedEmpleado);

  const formatUbicacion = (latitud, longitud) => {
    if (latitud === null || latitud === undefined || longitud === null || longitud === undefined) {
      return "—";
    }
    const lat = Number(latitud);
    const lon = Number(longitud);
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
    const latString = latitud?.toString().trim();
    const lonString = longitud?.toString().trim();
    if (!latString && !lonString) return "—";
    return [latString, lonString].filter(Boolean).join(", ");
  };

  const formatJustificado = (value) => (value ? "Sí" : "No");

  const formatJustificacion = (text) => {
    if (text === null || text === undefined) return "—";
    const trimmed = text.toString().trim();
    return trimmed ? trimmed : "—";
  };

  const getSolicitudBadgeClass = (estado) => {
    switch ((estado || "").toString().toLowerCase()) {
      case "aprobada":
        return "bg-green-100 text-green-700";
      case "rechazada":
        return "bg-red-100 text-red-700";
      case "pendiente":
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  // Solicita un motivo opcional antes de rechazar una solicitud de
  // justificación; evita cerrar el flujo sin contexto para el colaborador.
  const handleRechazarSolicitud = (solicitud) => {
    if (!solicitud) return;
    const respuesta =
      typeof window !== "undefined"
        ? window.prompt("Agrega un motivo de rechazo (opcional):", "")
        : "";
    rechazarJustificacion(solicitud, respuesta || "");
  };

  if (!user) {
    return <p className="p-6">Cargando información del usuario...</p>;
  }

  if (isAdmin && user.id_rol !== 1) {
    return <p className="p-6">No tienes permisos para ver esta página.</p>;
  }

  if (!isAdmin && user.id_rol !== 2) {
    return <p className="p-6">No tienes permisos para ver esta página.</p>;
  }

  // Restablece el estado del formulario de edición y limpia mensajes previos
  // para evitar retroalimentación desactualizada entre operaciones.
  const closeEditForm = () => {
    cancelEdit();
    setError("");
    setSuccessMessage("");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        links={sidebarLinks}
        roleColor={roleColor}
        isMobileOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex flex-col flex-grow">
        <Navbar
          title={tituloPagina}
          user={user}
          roleColor={roleColor}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onLogout={logoutUser}
        />

        <main className="flex-grow p-6 space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-100 border border-green-300 text-green-700 px-4 py-3 rounded-lg">
              {successMessage}
            </div>
          )}

          {!isAdmin && (
            <section className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-gray-800">¿No pudiste marcar tu asistencia?</h2>
                  <p className="text-sm text-gray-500">
                    Envía una justificación para que el administrador revise tu caso y actualice tu asistencia.
                  </p>
                </div>
                <Button type="button" variant="primary" onClick={openManualJustificacionModal}>
                  📝 Enviar justificación
                </Button>
              </div>
            </section>
          )}

          <section className="bg-white rounded-xl shadow-sm p-6">
            <header className="mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Registrar nueva marca</h2>
              <p className="text-sm text-gray-500">
                Completa la información para registrar una nueva marca de asistencia.
              </p>
              {isAdmin && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    id="range_mode"
                    name="range_mode"
                    type="checkbox"
                    checked={rangeMode}
                    onChange={toggleRangeMode}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="text-sm font-medium text-gray-700" htmlFor="range_mode">
                    Registrar por rango de fechas
                  </label>
                </div>
              )}
            </header>

            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
              {isAdmin && (
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="id_empleado">
                    Empleado
                  </label>
                  <select
                    id="id_empleado"
                    name="id_empleado"
                    value={formData.id_empleado || ""}
                    onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  >
                    <option value="">Selecciona un empleado</option>
                    {empleadosOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="tipo_marca">
                  Tipo de marca
                </label>
                <select
                  id="tipo_marca"
                  name="tipo_marca"
                  value={formData.tipo_marca}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                >
                  <option value="">Selecciona una opción</option>
                    {tipoMarcaOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
              </div>

              {isAdmin && (
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="estado">
                    Estado de la asistencia
                  </label>
                  <select
                    id="estado"
                    name="estado"
                    value={formData.estado || "Presente"}
                    onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    required
                  >
                    {estadoOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {rangeMode && isAdmin ? (
                <>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="fecha">
                      Fecha inicio
                    </label>
                    <input
                      id="fecha"
                      name="fecha"
                      type="date"
                      value={formData.fecha}
                      onChange={handleChange}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      required
                    />
                  </div>
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="fecha_fin">
                      Fecha fin
                    </label>
                    <input
                      id="fecha_fin"
                      name="fecha_fin"
                      type="date"
                      value={formData.fecha_fin}
                      onChange={handleChange}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      required
                    />
                  </div>
                </>
              ) : (
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="fecha">
                    Fecha
                  </label>
                  <input
                    id="fecha"
                    name="fecha"
                    type="date"
                    value={formData.fecha}
                    onChange={handleChange}
                    disabled={!isAdmin}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed"
                  />
                </div>
              )}

              <div className="flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="hora">
                  Hora
                </label>
                <input
                  id="hora"
                  name="hora"
                  type="time"
                  value={formData.hora}
                  onChange={handleChange}
                  disabled={!isAdmin}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed"
                />
              </div>

              <div className="md:col-span-2 flex flex-col gap-2">
                <p className="text-sm font-medium text-gray-700">Ubicación de marcación</p>
                {isAdmin ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-gray-600 mb-1" htmlFor="latitud">
                          Latitud
                        </label>
                        <input
                          id="latitud"
                          name="latitud"
                          type="text"
                          value={location.latitud}
                          onChange={(event) => updateLocationField("latitud", event.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="Ej. 10.341133"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-gray-600 mb-1" htmlFor="longitud">
                          Longitud
                        </label>
                        <input
                          id="longitud"
                          name="longitud"
                          type="text"
                          value={location.longitud}
                          onChange={(event) => updateLocationField("longitud", event.target.value)}
                          className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          placeholder="Ej. -83.737750"
                        />
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => {
                          requestLocation().catch(() => {
                            /* El estado de error se muestra automáticamente */
                          });
                        }}
                        disabled={locationStatus.loading}
                      >
                        {locationStatus.loading ? "Obteniendo ubicación..." : "Obtener ubicación actual"}
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={resetLocation}
                        disabled={!location.latitud && !location.longitud}
                      >
                        Limpiar ubicación
                      </Button>
                      {!supportsGeolocation && (
                        <span className="text-sm text-yellow-600">
                          Tu navegador no soporta geolocalización automática; ingresa la ubicación manualmente.
                        </span>
                      )}
                    </div>
                    {locationStatus.error && (
                      <p className="text-sm text-red-500">{locationStatus.error}</p>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      La ubicación se obtiene automáticamente al registrar tu marca.
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <span className="text-sm font-medium text-gray-800">
                        {location.latitud && location.longitud
                          ? formatUbicacion(location.latitud, location.longitud)
                          : locationStatus.loading
                          ? "Obteniendo ubicación..."
                          : "Ubicación pendiente"}
                      </span>
                    </div>
                    {locationStatus.error && (
                      <p className="text-sm text-red-500">{locationStatus.error}</p>
                    )}
                    {!supportsGeolocation && (
                      <p className="text-sm text-yellow-600">
                        Tu navegador no soporta geolocalización automática; contacta a un administrador.
                      </p>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  La latitud y longitud registradas se almacenarán junto con la marca de asistencia.
                </p>
                {geofenceConfigured && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      <div className="bg-blue-50 text-blue-900 border border-blue-100 rounded-lg px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-blue-800">
                          Latitud de referencia
                        </p>
                        <p className="text-sm font-bold">{officeLatDisplay}</p>
                      </div>
                      <div className="bg-blue-50 text-blue-900 border border-blue-100 rounded-lg px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-blue-800">
                          Longitud de referencia
                        </p>
                        <p className="text-sm font-bold">{officeLonDisplay}</p>
                      </div>
                      <div className="bg-blue-50 text-blue-900 border border-blue-100 rounded-lg px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-blue-800">
                          Radio permitido
                        </p>
                        <p className="text-sm font-bold">{officeRadiusDisplay ?? officeRadiusEffectiveDisplay} m</p>
                      </div>
                      <div className="bg-blue-50 text-blue-900 border border-blue-100 rounded-lg px-3 py-2">
                        <p className="text-[11px] uppercase tracking-wide font-semibold text-blue-800">
                          Radio con tolerancia
                        </p>
                        <p className="text-sm font-bold">
                          {officeRadiusEffectiveDisplay ?? officeRadiusDisplay} m
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-gray-500">
                      Solo puedes registrar la asistencia dentro de un radio aproximado de
                      {" "}
                      <span className="font-semibold">
                        {officeRadiusEffectiveDisplay || officeRadiusDisplay} m
                      </span>{" "}
                      (incluyendo tolerancia) alrededor de las coordenadas
                      {" "}
                      <span className="font-semibold">
                        {officeLatDisplay}, {officeLonDisplay}
                      </span>
                      . Si Recursos Humanos marca la casilla
                      {" "}
                      <span className="font-semibold">“Permitir marcación fuera de la oficina”</span>, la
                      restricción no aplicará para tu usuario.
                    </p>
                  </div>
                )}
              </div>

              <div className="md:col-span-2 flex flex-col">
                <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="observaciones">
                  Observaciones (opcional)
                </label>
                <textarea
                  id="observaciones"
                  name="observaciones"
                  rows={3}
                  value={formData.observaciones}
                  onChange={handleChange}
                  className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  placeholder="Añade detalles adicionales si es necesario"
                />
              </div>

              {isAdmin && (
                <>
                  <div className="md:col-span-2 flex items-center gap-2">
                    <input
                      id="justificado"
                      name="justificado"
                      type="checkbox"
                      checked={Boolean(formData.justificado)}
                      onChange={handleChange}
                      className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-gray-700" htmlFor="justificado">
                      Marcar asistencia como justificada
                    </label>
                  </div>

                  <div className="md:col-span-2 flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="justificacion">
                      Justificación
                    </label>
                    <textarea
                      id="justificacion"
                      name="justificacion"
                      rows={3}
                      value={formData.justificacion}
                      onChange={handleChange}
                      disabled={!formData.justificado}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none disabled:bg-gray-100 disabled:text-gray-500 disabled:border-gray-200 disabled:cursor-not-allowed"
                      placeholder="Describe el motivo de la justificación"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Solo se requiere una justificación cuando la asistencia está marcada como justificada.
                    </p>
                  </div>
                </>
              )}

              <div className="md:col-span-2 flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Registrando..." : "Registrar marca"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    resetForm();
                    setError("");
                    setSuccessMessage("");
                  }}
                >
                  Limpiar formulario
                </Button>
              </div>
            </form>
          </section>

          <section className="bg-white rounded-xl shadow-sm p-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-800">Registros de asistencia</h1>
                <p className="text-sm text-gray-500">
                  Consulta las marcas registradas y filtra por rango de fechas.
                </p>
              </div>
              <form onSubmit={handleRangeSubmit} className="flex flex-col lg:flex-row lg:items-end gap-3">
                {isAdmin && (
                  <div className="flex flex-col min-w-[220px]">
                    <label className="text-xs text-gray-600 mb-1" htmlFor="empleado_filter">
                      Empleado
                    </label>
                    <select
                      id="empleado_filter"
                      name="empleado_filter"
                      value={selectedEmpleado}
                      onChange={handleEmpleadoSelect}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Todos los empleados</option>
                      {empleadosOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1" htmlFor="start">
                    Desde
                  </label>
                  <input
                    id="start"
                    name="start"
                    type="date"
                    value={rangeFilters.start}
                    onChange={handleRangeChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-xs text-gray-600 mb-1" htmlFor="end">
                    Hasta
                  </label>
                  <input
                    id="end"
                    name="end"
                    type="date"
                    value={rangeFilters.end}
                    onChange={handleRangeChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button type="submit" variant="primary" size="md">
                    Aplicar
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="md"
                    onClick={clearRangeFilters}
                  >
                    Limpiar
                  </Button>
                </div>
              </form>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  disabled={exportDisabled || isExportingPdf}
                  onClick={() => exportAsistencia("pdf")}
                >
                  {isExportingPdf ? "Generando PDF..." : "📄 Exportar PDF"}
                </Button>
                <Button
                  type="button"
                  variant="success"
                  size="sm"
                  disabled={exportDisabled || isExportingExcel}
                  onClick={() => exportAsistencia("excel")}
                >
                  {isExportingExcel ? "Generando Excel..." : "📊 Exportar Excel"}
                </Button>
                <Button
                  type="button"
                  variant="warning"
                  size="sm"
                  disabled={exportDisabled || exportingFormat !== null}
                  onClick={shareAsistencia}
                >
                  {exportingFormat ? "Preparando..." : "📤 Compartir"}
                </Button>
              </div>
            </header>

            {loading ? (
              <p className="text-sm text-gray-500">Cargando registros...</p>
            ) : registros.length === 0 ? (
              <p className="text-sm text-gray-500">No hay marcas registradas para el criterio seleccionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-100">
                  <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Hora</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">Justificado</th>
                      <th className="px-4 py-3 text-left">Justificación</th>
                      <th className="px-4 py-3 text-left">Solicitud</th>
                      <th className="px-4 py-3 text-left">Ubicación</th>
                      <th className="px-4 py-3 text-left">Observaciones</th>
                      {isAdmin && <th className="px-4 py-3 text-left">Empleado</th>}
                      {isAdmin && <th className="px-4 py-3 text-left">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {registros.map((registro) => {
                      const solicitud = registro.justificacionSolicitud;
                      const estadoSolicitud = solicitud?.estado || "";
                      const isSolicitudPendiente = estadoSolicitud === "pendiente";
                      const isResolviendo = solicitud && resolviendoJustificacionId === solicitud.id_solicitud;

                      return (
                        <tr key={registro.id_asistencia} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-800">
                            {formatearFecha(registro.fecha)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatearHora(registro.hora)}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 text-xs font-semibold">
                              {obtenerEtiquetaTipo(registro.tipo_marca)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold">
                              {obtenerEtiquetaEstado(registro.estado)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">{formatJustificado(registro.justificado)}</td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs">
                            {formatJustificacion(registro.justificacion)}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {solicitud ? (
                              <div className="flex flex-col gap-1">
                                <span
                                  className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${getSolicitudBadgeClass(
                                    estadoSolicitud
                                  )}`}
                                >
                                  {obtenerEtiquetaEstadoSolicitud(estadoSolicitud)}
                                </span>
                                {solicitud.tipo && (
                                  <span className="text-xs text-gray-500">
                                    {obtenerEtiquetaTipoJustificacion(solicitud.tipo)}
                                  </span>
                                )}
                                {solicitud.descripcion && (
                                  <span className="text-xs text-gray-500">{solicitud.descripcion}</span>
                                )}
                                {solicitud.estado === "rechazada" && solicitud.respuesta && (
                                  <span className="text-xs text-red-500">{solicitud.respuesta}</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">Sin solicitud</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {formatUbicacion(registro.latitud, registro.longitud)}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-xs">
                            {registro.observaciones || "-"}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-gray-700">
                              {registro.nombre && registro.apellido
                                ? `${registro.nombre} ${registro.apellido}`
                                : registro.id_empleado}
                            </td>
                          )}
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-2">
                                <Button variant="secondary" size="sm" onClick={() => startEdit(registro)}>
                                  Editar
                                </Button>
                                {solicitud && isSolicitudPendiente && (
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      variant="success"
                                      size="sm"
                                      onClick={() => aprobarJustificacion(solicitud)}
                                      disabled={isResolviendo}
                                    >
                                      {isResolviendo ? "Aprobando..." : "Aprobar"}
                                    </Button>
                                    <Button
                                      variant="danger"
                                      size="sm"
                                      onClick={() => handleRechazarSolicitud(solicitud)}
                                      disabled={isResolviendo}
                                    >
                                      {isResolviendo ? "Rechazando..." : "Rechazar"}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>

          {manualJustificacionModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
              <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
                <header className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Enviar justificación</h3>
                    <p className="text-xs text-gray-500">
                      Registra la fecha, hora y motivo para que tu administrador revise la solicitud.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-gray-400 hover:text-gray-600"
                    onClick={closeManualJustificacionModal}
                    aria-label="Cerrar"
                  >
                    ✕
                  </button>
                </header>
                <form onSubmit={submitManualJustificacion}>
                  <div className="space-y-4 px-6 py-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="manual_fecha">
                          Fecha
                        </label>
                        <input
                          id="manual_fecha"
                          name="fecha"
                          type="date"
                          value={manualJustificacionForm.fecha}
                          onChange={handleManualJustificacionChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          required
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="manual_hora">
                          Hora aproximada
                        </label>
                        <input
                          id="manual_hora"
                          name="hora"
                          type="time"
                          value={manualJustificacionForm.hora || ""}
                          onChange={handleManualJustificacionChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      </div>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="manual_tipo_marca">
                          Marca a reportar
                        </label>
                        <select
                          id="manual_tipo_marca"
                          name="tipo_marca"
                          value={manualJustificacionForm.tipo_marca}
                          onChange={handleManualJustificacionChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          required
                        >
                          {tipoMarcaOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="manual_tipo_justificacion">
                          Motivo
                        </label>
                        <select
                          id="manual_tipo_justificacion"
                          name="tipo"
                          value={manualJustificacionForm.tipo}
                          onChange={handleManualJustificacionChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                          required
                        >
                          <option value="">Selecciona una opción</option>
                          {tipoJustificacionOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="manual_descripcion">
                        Detalles adicionales
                      </label>
                      <textarea
                        id="manual_descripcion"
                        name="descripcion"
                        value={manualJustificacionForm.descripcion}
                        onChange={handleManualJustificacionChange}
                        rows={4}
                        className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        placeholder="Explica brevemente qué ocurrió"
                      />
                    </div>
                  </div>
                  <footer className="flex items-center justify-end gap-3 border-t px-6 py-4">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={closeManualJustificacionModal}
                      disabled={manualJustificacionSubmitting}
                    >
                      Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={manualJustificacionSubmitting}>
                      {manualJustificacionSubmitting ? "Enviando..." : "Enviar justificación"}
                    </Button>
                  </footer>
                </form>
              </div>
            </div>
          )}

          {justificacionModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
              <div className="w-full max-w-xl rounded-xl bg-white shadow-xl">
                <header className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">Enviar justificación</h3>
                    {justificacionRegistro && (
                      <p className="text-xs text-gray-500">
                        Registro del {formatearFecha(justificacionRegistro.fecha)} a las {" "}
                        {formatearHora(justificacionRegistro.hora)} • {" "}
                        {obtenerEtiquetaTipo(justificacionRegistro.tipo_marca)}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={closeJustificacionModal}
                    className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Cerrar"
                  >
                    ✕
                  </button>
                </header>
                <form onSubmit={submitJustificacionSolicitud} className="space-y-4 px-6 py-4">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="justificacion_tipo">
                      Tipo de justificación
                    </label>
                    <select
                      id="justificacion_tipo"
                      name="tipo"
                      value={justificacionForm.tipo}
                      onChange={handleJustificacionFormChange}
                      required
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    >
                      <option value="">Selecciona una opción</option>
                      {tipoJustificacionOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="justificacion_descripcion">
                      Detalle (opcional)
                    </label>
                    <textarea
                      id="justificacion_descripcion"
                      name="descripcion"
                      rows={4}
                      value={justificacionForm.descripcion}
                      onChange={handleJustificacionFormChange}
                      placeholder="Describe brevemente el motivo de tu justificación"
                      className="resize-none border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Esta información se enviará al administrador para que revise y apruebe tu solicitud.
                    </p>
                  </div>

                  <footer className="flex justify-end gap-3 border-t pt-4">
                    <Button type="button" variant="secondary" onClick={closeJustificacionModal} disabled={justificacionSubmitting}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={justificacionSubmitting}>
                      {justificacionSubmitting ? "Enviando..." : "Enviar justificación"}
                    </Button>
                  </footer>
                </form>
              </div>
            </div>
          )}

          {isAdmin && editingRegistro && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-attendance-title"
              onClick={closeEditForm}
            >
              <div
                className="relative flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl max-h-[90vh]"
                onClick={(event) => event.stopPropagation()}
              >
                <header className="flex flex-col gap-2 border-b px-6 py-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 id="edit-attendance-title" className="text-lg font-semibold text-gray-800">
                      Editar marca #{editingRegistro.id_asistencia}
                    </h3>
                    <p className="text-sm text-gray-500">
                      Puedes actualizar fecha, hora, tipo de marca, observaciones, justificación y el estado de
                      asistencia.
                    </p>
                  </div>
                  <div className="flex items-center gap-3 self-end md:self-start">
                    <Button variant="secondary" onClick={closeEditForm}>
                      Cancelar edición
                    </Button>
                    <button
                      type="button"
                      onClick={closeEditForm}
                      className="rounded-full p-1 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                      aria-label="Cerrar"
                    >
                      ✕
                    </button>
                  </div>
                </header>

                <form
                  onSubmit={handleEditSubmit}
                  className="grid flex-1 gap-4 overflow-y-auto px-6 py-4 md:grid-cols-2"
                >
                  <div className="flex flex-col">
                    <label className="mb-1 text-sm font-medium text-gray-700" htmlFor="edit_fecha">
                      Fecha
                    </label>
                    <input
                      id="edit_fecha"
                      name="fecha"
                      type="date"
                      value={editForm.fecha}
                      onChange={handleEditChange}
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      required
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="mb-1 text-sm font-medium text-gray-700" htmlFor="edit_hora">
                      Hora
                    </label>
                    <input
                      id="edit_hora"
                      name="hora"
                      type="time"
                      value={editForm.hora}
                      onChange={handleEditChange}
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      required
                    />
                  </div>

                  <div className="flex flex-col">
                    <label className="mb-1 text-sm font-medium text-gray-700" htmlFor="edit_tipo_marca">
                      Tipo de marca
                    </label>
                    <select
                      id="edit_tipo_marca"
                      name="tipo_marca"
                      value={editForm.tipo_marca}
                      onChange={handleEditChange}
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      required
                    >
                      <option value="">Selecciona una opción</option>
                      {tipoMarcaOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col">
                    <label className="mb-1 text-sm font-medium text-gray-700" htmlFor="edit_estado">
                      Estado de la asistencia
                    </label>
                    <select
                      id="edit_estado"
                      name="estado"
                      value={editForm.estado || "Presente"}
                      onChange={handleEditChange}
                      className="rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      required
                    >
                      {editableEstadoOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col md:col-span-2">
                    <label className="mb-1 text-sm font-medium text-gray-700" htmlFor="edit_observaciones">
                      Observaciones
                    </label>
                    <textarea
                      id="edit_observaciones"
                      name="observaciones"
                      rows={3}
                      value={editForm.observaciones}
                      onChange={handleEditChange}
                      className="resize-none rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Añade notas adicionales si corresponde"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center gap-2">
                    <input
                      id="edit_justificado"
                      name="justificado"
                      type="checkbox"
                      checked={Boolean(editForm.justificado)}
                      onChange={handleEditChange}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label className="text-sm font-medium text-gray-700" htmlFor="edit_justificado">
                      Marcar asistencia como justificada
                    </label>
                  </div>

                  <div className="flex flex-col md:col-span-2">
                    <label className="mb-1 text-sm font-medium text-gray-700" htmlFor="edit_justificacion">
                      Justificación
                    </label>
                    <textarea
                      id="edit_justificacion"
                      name="justificacion"
                      rows={3}
                      value={editForm.justificacion}
                      onChange={handleEditChange}
                      disabled={!editForm.justificado}
                      className="resize-none rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
                      placeholder="Describe el motivo de la justificación"
                    />
                  </div>

                  <div className="md:col-span-2 flex items-center justify-end gap-3 border-t pt-4">
                    <Button type="button" variant="secondary" onClick={closeEditForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" variant="primary" disabled={editLoading}>
                      {editLoading ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>

        <footer className="text-center py-4 text-gray-500 text-sm">
          © 2025 EmpresaRH - Todos los derechos reservados
        </footer>
      </div>
    </div>
  );
};

Asistencia.propTypes = {
  mode: PropTypes.oneOf(["admin", "empleado"]).isRequired,
};

export default Asistencia;
