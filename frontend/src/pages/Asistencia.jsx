import React, { useMemo } from "react";
import PropTypes from "prop-types";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import {
  formatearFecha,
  formatearHora,
  obtenerEtiquetaTipo,
  tipoMarcaOptions,
  useAsistencia,
} from "../hooks/useAsistencia";

const Asistencia = ({ mode }) => {
  const { user, logoutUser } = useAuth();
  const isAdmin = mode === "admin";

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
    rangeFilters,
    handleRangeChange,
    handleRangeSubmit,
    clearRangeFilters,
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
    location,
    locationStatus,
    supportsGeolocation,
    requestLocation,
    updateLocationField,
    resetLocation,
  } = useAsistencia({ mode });

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
      ];
    }
    return [
      { path: "/empleado/asistencia", label: "Asistencia" },
      { path: "/empleado/vacaciones", label: "Vacaciones" },
      { path: "/empleado/prestamos", label: "Préstamos" },
      { path: "/empleado/liquidaciones", label: "Liquidaciones" },
    ];
  }, [isAdmin]);

  const roleColor = isAdmin ? "blue" : "green";
  const tituloPagina = isAdmin ? "Gestión de Asistencia" : "Mi Asistencia";

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

  if (!user) {
    return <p className="p-6">Cargando información del usuario...</p>;
  }

  if (isAdmin && user.id_rol !== 1) {
    return <p className="p-6">No tienes permisos para ver esta página.</p>;
  }

  if (!isAdmin && user.id_rol !== 2) {
    return <p className="p-6">No tienes permisos para ver esta página.</p>;
  }

  const closeEditForm = () => {
    cancelEdit();
    setError("");
    setSuccessMessage("");
  };

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar links={sidebarLinks} roleColor={roleColor} />

      <div className="flex flex-col flex-grow">
        <Navbar
          title={tituloPagina}
          user={user}
          roleColor={roleColor}
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

          <section className="bg-white rounded-xl shadow-sm p-6">
            <header className="mb-4">
              <h2 className="text-xl font-semibold text-gray-800">Registrar nueva marca</h2>
              <p className="text-sm text-gray-500">
                Completa la información para registrar una nueva marca de asistencia.
              </p>
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
                          placeholder="Ej. 9.935000"
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
                          placeholder="Ej. -84.091000"
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
              <form onSubmit={handleRangeSubmit} className="flex flex-col sm:flex-row gap-3">
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
            </header>

            {loading ? (
              <p className="text-sm text-gray-500">Cargando registros...</p>
            ) : registros.length === 0 ? (
              <p className="text-sm text-gray-500">No hay marcas registradas para el criterio seleccionado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Hora</th>
                      <th className="px-4 py-3 text-left">Tipo</th>
                      <th className="px-4 py-3 text-left">Ubicación</th>
                      <th className="px-4 py-3 text-left">Observaciones</th>
                      {isAdmin && <th className="px-4 py-3 text-left">Empleado</th>}
                      {isAdmin && <th className="px-4 py-3 text-left">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {registros.map((registro) => (
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
                            <Button variant="secondary" size="sm" onClick={() => startEdit(registro)}>
                              Editar
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {isAdmin && editingRegistro && (
            <section className="bg-white rounded-xl shadow-sm p-6">
              <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">
                    Editar marca #{editingRegistro.id_asistencia}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Actualiza el tipo de marca u observaciones del registro seleccionado.
                  </p>
                </div>
                <Button variant="secondary" onClick={closeEditForm}>
                  Cancelar edición
                </Button>
              </header>

              <form onSubmit={handleEditSubmit} className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="edit_tipo_marca">
                    Tipo de marca
                  </label>
                  <select
                    id="edit_tipo_marca"
                    name="tipo_marca"
                    value={editForm.tipo_marca}
                    onChange={handleEditChange}
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

                <div className="md:col-span-2 flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1" htmlFor="edit_observaciones">
                    Observaciones
                  </label>
                  <textarea
                    id="edit_observaciones"
                    name="observaciones"
                    rows={3}
                    value={editForm.observaciones}
                    onChange={handleEditChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                    placeholder="Añade notas adicionales si corresponde"
                  />
                </div>

                <div className="md:col-span-2 flex items-center gap-3">
                  <Button type="submit" variant="primary" disabled={editLoading}>
                    {editLoading ? "Guardando..." : "Guardar cambios"}
                  </Button>
                  <Button type="button" variant="secondary" onClick={closeEditForm}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </section>
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
