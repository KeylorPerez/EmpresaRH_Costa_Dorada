import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { adminLinks, empleadoLinks } from "../utils/navigationLinks";
import {
  usePrestamos,
  estadosPrestamo,
  formatearFecha,
  formatearMonto,
  formatearPorcentaje,
} from "../hooks/usePrestamos";
import { getTodayInputValue } from "../utils/dateUtils";

const Prestamos = ({ mode }) => {
  const { user, logoutUser } = useAuth();
  const {
    prestamos,
    loading,
    submitting,
    error,
    successMessage,
    formData,
    handleChange,
    handleSubmit,
    resetForm,
    approvePrestamo,
    rejectPrestamo,
    exportPrestamo,
    actionLoading,
    setError,
    setSuccessMessage,
  } = usePrestamos();

  const isAdmin = mode === "admin";
  const estadoDefault = "todos";
  const [estadoFiltro, setEstadoFiltro] = useState(estadoDefault);
  const [busquedaNombre, setBusquedaNombre] = useState("");
  const [fechaInicioFiltro, setFechaInicioFiltro] = useState("");
  const [fechaFinFiltro, setFechaFinFiltro] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const filtrosGridCols = isAdmin ? "md:grid-cols-4" : "md:grid-cols-3";
  const filtrosButtonColSpan = isAdmin ? "md:col-span-4" : "md:col-span-3";
  const fechaSolicitudMaxima = getTodayInputValue();

  const hayFiltrosActivos =
    estadoFiltro !== estadoDefault ||
    (isAdmin && busquedaNombre.trim() !== "") ||
    fechaInicioFiltro !== "" ||
    fechaFinFiltro !== "";

  const sidebarLinks = useMemo(() => {
    if (isAdmin) {
      return adminLinks;
    }

    return empleadoLinks;
  }, [isAdmin]);

  const roleColor = isAdmin ? "blue" : "green";
  const tituloPagina = isAdmin ? "Gestión de Préstamos" : "Mis Préstamos";

  const limpiarMensajes = () => {
    if (error) setError("");
    if (successMessage) setSuccessMessage("");
  };

  const handleResetFiltros = () => {
    setEstadoFiltro(estadoDefault);
    setBusquedaNombre("");
    setFechaInicioFiltro("");
    setFechaFinFiltro("");
  };

  const filteredPrestamos = useMemo(() => {
    const normalizar = (valor = "") => valor.toString().toLowerCase().trim();
    const fechaToComparable = (valor) => {
      if (!valor) return null;
      const fecha = new Date(valor);
      return Number.isNaN(fecha.getTime()) ? null : fecha;
    };

    const inicioFiltro = fechaToComparable(fechaInicioFiltro);
    const finFiltro = fechaToComparable(fechaFinFiltro);

    return prestamos.filter((prestamo) => {
      if (estadoFiltro !== "todos" && String(prestamo.id_estado) !== estadoFiltro) {
        return false;
      }

      if (isAdmin && busquedaNombre.trim()) {
        const nombreCompleto = normalizar(
          `${prestamo.nombre || ""} ${prestamo.apellido || ""}`
        );
        const termino = normalizar(busquedaNombre);
        if (!nombreCompleto.includes(termino)) {
          return false;
        }
      }

      if (inicioFiltro || finFiltro) {
        const fechaSolicitud = fechaToComparable(prestamo.fecha_solicitud);
        if (inicioFiltro && (!fechaSolicitud || fechaSolicitud < inicioFiltro)) {
          return false;
        }
        if (finFiltro && (!fechaSolicitud || fechaSolicitud > finFiltro)) {
          return false;
        }
      }

      return true;
    });
  }, [
    prestamos,
    estadoFiltro,
    busquedaNombre,
    fechaInicioFiltro,
    fechaFinFiltro,
    isAdmin,
  ]);

  const renderEstadoBadge = (prestamo) => {
    const estado = estadosPrestamo[prestamo.id_estado] || {
      label: "Desconocido",
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

  const renderAcciones = (prestamo) => {
    if (!isAdmin || prestamo.id_estado !== 1) return null;

    const isUpdating = Boolean(actionLoading[prestamo.id_prestamo]);

    return (
      <div className="flex items-center gap-2">
        <Button
          variant="success"
          size="sm"
          disabled={isUpdating}
          onClick={async () => {
            try {
              await approvePrestamo(prestamo.id_prestamo);
            } catch {
              // Error gestionado en el hook
            }
          }}
        >
          {isUpdating ? "Procesando..." : "Aprobar"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={isUpdating}
          onClick={async () => {
            try {
              await rejectPrestamo(prestamo.id_prestamo);
            } catch {
              // Error gestionado en el hook
            }
          }}
        >
          Rechazar
        </Button>
      </div>
    );
  };

  const onExport = async (prestamo) => {
    try {
      setDownloadingId(prestamo.id_prestamo);
      const data = await exportPrestamo(prestamo.id_prestamo);
      if (data?.url) {
        window.open(data.url, "_blank", "noopener");
      }
    } catch {
      // El hook gestiona los mensajes de error
    } finally {
      setDownloadingId(null);
    }
  };

  if (!user) {
    return <p className="p-6">Cargando información del usuario...</p>;
  }

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
                  ? "Revisa las solicitudes de préstamo de los colaboradores y cambia su estado."
                  : "Solicita nuevos préstamos y revisa el estado de tus solicitudes."}
              </p>
            </div>
            {loading && (
              <span className="text-sm text-gray-500">Cargando información...</span>
            )}
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

          <section className="bg-white rounded-xl shadow-sm p-6">
            <header className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800">
                Solicitar préstamo
              </h2>
              <p className="text-sm text-gray-500">
                {isAdmin
                  ? "Registra una solicitud de préstamo con la información del día."
                  : "Completa la información y envía tu solicitud de préstamo al departamento financiero."}
              </p>
            </header>

            <form className="grid gap-4 md:grid-cols-4" onSubmit={handleSubmit}>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Monto solicitado
                </label>
                <input
                  type="number"
                  name="monto"
                  value={formData.monto}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="₡"
                  required
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cuotas
                </label>
                <input
                  type="number"
                  name="cuotas"
                  value={formData.cuotas}
                  onChange={handleChange}
                  min="1"
                  step="1"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="Ej. 12"
                  required
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Interés (% anual)
                </label>
                <input
                  type="number"
                  name="interes"
                  value={formData.interes}
                  onChange={handleChange}
                  min="0"
                  step="0.01"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                  placeholder="Ej. 8"
                  required
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha de solicitud
                </label>
                <input
                  type="date"
                  name="fecha_solicitud"
                  value={formData.fecha_solicitud}
                  onChange={handleChange}
                  max={fechaSolicitudMaxima}
                  className={`w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400 ${
                    isAdmin ? "" : "bg-gray-100 cursor-not-allowed"
                  }`}
                  required
                  readOnly={!isAdmin}
                  disabled={!isAdmin}
                  aria-readonly={!isAdmin}
                />
                {!isAdmin && (
                  <p className="mt-1 text-xs text-gray-500">
                    La fecha se completa automáticamente con el día de hoy.
                  </p>
                )}
              </div>

              <div className="md:col-span-4 flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar solicitud"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    limpiarMensajes();
                    resetForm();
                  }}
                >
                  Limpiar
                </Button>
              </div>
            </form>
          </section>

          <section className="bg-white rounded-xl shadow-sm p-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  {isAdmin ? "Solicitudes registradas" : "Historial de préstamos"}
                </h2>
                <p className="text-sm text-gray-500">
                  {isAdmin
                    ? "Consulta el detalle de cada préstamo y gestiona su aprobación."
                    : "Consulta el estado, saldo y detalle de cada solicitud."}
                </p>
              </div>
            </header>

            <div className={`mb-4 grid gap-4 ${filtrosGridCols}`}>
              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  Estado
                </label>
                <select
                  value={estadoFiltro}
                  onChange={(event) => setEstadoFiltro(event.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="todos">Todos</option>
                  <option value="1">Pendientes</option>
                  <option value="2">Aprobados</option>
                  <option value="3">Rechazados</option>
                </select>
              </div>

              {isAdmin && (
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Buscar por nombre
                  </label>
                  <input
                    type="text"
                    value={busquedaNombre}
                    onChange={(event) => setBusquedaNombre(event.target.value)}
                    placeholder="Ej. Juan Pérez"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              )}

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  Desde
                </label>
                <input
                  type="date"
                  value={fechaInicioFiltro}
                  onChange={(event) => setFechaInicioFiltro(event.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  max={fechaFinFiltro || undefined}
                />
              </div>

              <div className="flex flex-col">
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  Hasta
                </label>
                <input
                  type="date"
                  value={fechaFinFiltro}
                  onChange={(event) => setFechaFinFiltro(event.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  min={fechaInicioFiltro || undefined}
                />
              </div>

              <div className={`col-span-full flex justify-end ${filtrosButtonColSpan}`}>
                <Button variant="secondary" size="sm" onClick={handleResetFiltros}>
                  Limpiar filtros
                </Button>
              </div>
            </div>

            {filteredPrestamos.length === 0 && !loading ? (
              <p className="text-sm text-gray-500">
                {hayFiltrosActivos
                  ? "No se encontraron préstamos con los filtros aplicados."
                  : isAdmin
                  ? "No hay solicitudes de préstamo registradas."
                  : "Aún no has realizado solicitudes de préstamo."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <div className="max-h-[70vh] overflow-y-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                      <tr>
                        {isAdmin && <th className="px-4 py-3 text-left">Colaborador</th>}
                        <th className="px-4 py-3 text-left">Fecha solicitud</th>
                        <th className="px-4 py-3 text-left">Monto</th>
                        <th className="px-4 py-3 text-left">Saldo</th>
                        <th className="px-4 py-3 text-left">Cuotas</th>
                        <th className="px-4 py-3 text-left">Interés</th>
                        <th className="px-4 py-3 text-left">Estado</th>
                        <th className="px-4 py-3 text-left">Documento</th>
                        {isAdmin && <th className="px-4 py-3 text-left">Acciones</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPrestamos.map((prestamo) => {
                        const isApproved = Number(prestamo.id_estado) === 2;
                        const isGenerating = downloadingId === prestamo.id_prestamo;

                        return (
                          <tr
                            key={prestamo.id_prestamo}
                            className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                          >
                            {isAdmin && (
                              <td className="px-4 py-3 text-gray-800">
                                <p className="font-semibold">
                                  {prestamo.nombre || "Empleado"}{" "}
                                  {prestamo.apellido || ""}
                                </p>
                                <p className="text-xs text-gray-500">
                                  ID #{prestamo.id_empleado}
                                </p>
                              </td>
                            )}
                            <td className="px-4 py-3 text-gray-700">
                              {formatearFecha(prestamo.fecha_solicitud)}
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-800">
                              {formatearMonto(prestamo.monto)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {formatearMonto(prestamo.saldo)}
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {prestamo.cuotas} cuotas
                            </td>
                            <td className="px-4 py-3 text-gray-700">
                              {formatearPorcentaje(prestamo.interes_porcentaje)}
                            </td>
                            <td className="px-4 py-3">{renderEstadoBadge(prestamo)}</td>
                            <td className="px-4 py-3">
                              {isApproved ? (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => onExport(prestamo)}
                                  disabled={isGenerating}
                                >
                                  {isGenerating ? "Generando..." : "Descargar PDF"}
                                </Button>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  Disponible al aprobarse
                                </span>
                              )}
                            </td>
                            {isAdmin && (
                              <td className="px-4 py-3">{renderAcciones(prestamo)}</td>
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
        </main>

        <footer className="text-center py-4 text-gray-500 text-sm">
          © 2025 EmpresaRH - Todos los derechos reservados
        </footer>
      </div>
    </div>
  );
};

Prestamos.propTypes = {
  mode: PropTypes.oneOf(["admin", "empleado"]),
};

Prestamos.defaultProps = {
  mode: "empleado",
};

export default Prestamos;
