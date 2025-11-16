import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import {
  useVacaciones,
  estadoVacaciones,
  formatearFecha,
  diasSolicitados,
} from "../hooks/useVacaciones";

const Vacaciones = ({ mode }) => {
  const { user, logoutUser } = useAuth();
  const {
    solicitudes,
    loading,
    submitting,
    error,
    successMessage,
    formData,
    handleChange,
    handleSubmit,
    approveSolicitud,
    rejectSolicitud,
    exportSolicitud,
    setError,
  } = useVacaciones();
  const isAdmin = mode === "admin";
  const estadoDefault = isAdmin ? "1" : "todos";
  const [diasAprobados, setDiasAprobados] = useState({});
  const [estadoFiltro, setEstadoFiltro] = useState(estadoDefault);
  const [busquedaNombre, setBusquedaNombre] = useState("");
  const [fechaInicioFiltro, setFechaInicioFiltro] = useState("");
  const [fechaFinFiltro, setFechaFinFiltro] = useState("");
  const [downloadingId, setDownloadingId] = useState(null);

  const hayFiltrosActivos =
    estadoFiltro !== estadoDefault ||
    busquedaNombre.trim() !== "" ||
    fechaInicioFiltro !== "" ||
    fechaFinFiltro !== "";


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
  const tituloPagina = isAdmin ? "Gestión de Vacaciones" : "Mis Vacaciones";

  const handleDiasChange = (id_vacacion, value) => {
    setDiasAprobados((prev) => ({ ...prev, [id_vacacion]: value }));
  };

  const handleResetFiltros = () => {
    setEstadoFiltro(estadoDefault);
    setBusquedaNombre("");
    setFechaInicioFiltro("");
    setFechaFinFiltro("");
  };

  const filteredSolicitudes = useMemo(() => {
    if (!isAdmin) {
      return solicitudes;
    }

    const normalizar = (valor = "") => valor.toString().toLowerCase().trim();
    const fechaToComparable = (valor) => {
      const fecha = new Date(valor);
      return Number.isNaN(fecha.getTime()) ? null : fecha;
    };

    const inicioFiltro = fechaToComparable(fechaInicioFiltro);
    const finFiltro = fechaToComparable(fechaFinFiltro);

    return solicitudes.filter((solicitud) => {
      if (estadoFiltro !== "todos" && String(solicitud.id_estado) !== estadoFiltro) {
        return false;
      }

      if (busquedaNombre.trim()) {
        const nombreCompleto = normalizar(
          `${solicitud.nombre || ""} ${solicitud.apellido || ""}`
        );
        const termino = normalizar(busquedaNombre);
        if (!nombreCompleto.includes(termino)) {
          return false;
        }
      }

      if (inicioFiltro) {
        const fechaSolicitud = fechaToComparable(solicitud.fecha_inicio);
        if (!fechaSolicitud || fechaSolicitud < inicioFiltro) {
          return false;
        }
      }

      if (finFiltro) {
        const fechaSolicitud = fechaToComparable(solicitud.fecha_fin);
        if (!fechaSolicitud || fechaSolicitud > finFiltro) {
          return false;
        }
      }

      return true;
    });
  }, [
    solicitudes,
    isAdmin,
    estadoFiltro,
    busquedaNombre,
    fechaInicioFiltro,
    fechaFinFiltro,
  ]);

  const onApprove = async (solicitud) => {
    const raw = diasAprobados[solicitud.id_vacacion];
    const defaultDias = diasSolicitados(
      solicitud.fecha_inicio,
      solicitud.fecha_fin
    );
    const parsed = raw === undefined || raw === "" ? defaultDias : Number(raw);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setError("Ingresa la cantidad de días a aprobar");
      return;
    }

    try {
      await approveSolicitud(solicitud.id_vacacion, parsed);
      setDiasAprobados((prev) => ({ ...prev, [solicitud.id_vacacion]: "" }));
    } catch {
      // El hook ya maneja el error
    }
  };

  const onReject = async (solicitud) => {
    try {
      await rejectSolicitud(solicitud.id_vacacion);
      setDiasAprobados((prev) => ({ ...prev, [solicitud.id_vacacion]: "" }));
    } catch {
      // Error gestionado en el hook
    }
  };

  const onExport = async (solicitud) => {
    try {
      setDownloadingId(solicitud.id_vacacion);
      const data = await exportSolicitud(solicitud.id_vacacion);
      if (data?.url) {
        window.open(data.url, "_blank", "noopener");
      }
    } catch {
      // El hook maneja los errores y mensajes
    } finally {
      setDownloadingId(null);
    }
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
          onLogout={logoutUser}
        />

        <main className="flex-grow p-6 space-y-6">
          <section className="bg-white rounded-xl shadow-sm p-6">
            <header className="mb-6">
              <h1 className="text-2xl font-bold text-gray-800">
                Solicitar vacaciones
              </h1>
              <p className="text-sm text-gray-500">
                Selecciona el rango de fechas y envía la solicitud al
                departamento de recursos humanos.
              </p>
            </header>
            <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha inicio
                </label>
                <input
                  type="date"
                  name="fecha_inicio"
                  value={formData.fecha_inicio}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  max={formData.fecha_fin || undefined}
                  required
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fecha fin
                </label>
                <input
                  type="date"
                  name="fecha_fin"
                  value={formData.fecha_fin}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  min={formData.fecha_inicio || undefined}
                  required
                />
              </div>
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Motivo (opcional)
                </label>
                <textarea
                  name="motivo"
                  value={formData.motivo}
                  onChange={handleChange}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                  placeholder="Describe brevemente el motivo de tu solicitud"
                />
              </div>
              <div className="md:col-span-4 flex items-center gap-3">
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Enviando..." : "Enviar solicitud"}
                </Button>
                {successMessage && (
                  <span className="text-sm text-green-600 font-medium">
                    {successMessage}
                  </span>
                )}
                {error && (
                  <span className="text-sm text-red-500 font-medium">{error}</span>
                )}
              </div>
            </form>
          </section>

          <section className="bg-white rounded-xl shadow-sm p-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Historial de solicitudes
                </h2>
                <p className="text-sm text-gray-500">
                  Consulta el estado de cada solicitud y su historial de
                  aprobación.
                </p>
              </div>
              {loading && (
                <p className="text-sm text-gray-500">Cargando solicitudes...</p>
              )}
            </header>

            {isAdmin && (
              <div className="mb-4 grid gap-4 md:grid-cols-4">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Estado
                  </label>
                  <select
                    value={estadoFiltro}
                    onChange={(event) => setEstadoFiltro(event.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="todos">Todas</option>
                    <option value="1">Pendientes</option>
                    <option value="2">Aprobadas</option>
                    <option value="3">Rechazadas</option>
                  </select>
                </div>
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
                <div className="md:col-span-4 flex justify-end">
                  <Button variant="secondary" size="sm" onClick={handleResetFiltros}>
                    Limpiar filtros
                  </Button>
                </div>
              </div>
            )}

            {filteredSolicitudes.length === 0 && !loading ? (
              <p className="text-gray-500 text-sm">
                {isAdmin && hayFiltrosActivos
                  ? "No se encontraron solicitudes con los filtros aplicados."
                  : "Aún no hay solicitudes registradas."}
              </p>
            ) : (
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                    <tr>
                      {isAdmin && <th className="px-4 py-3 text-left">Empleado</th>}
                      <th className="px-4 py-3 text-left">Periodo</th>
                      <th className="px-4 py-3 text-left">Motivo</th>
                      <th className="px-4 py-3 text-left">Días solicitados</th>
                      <th className="px-4 py-3 text-left">Días aprobados</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">Actualización</th>
                      <th className="px-4 py-3 text-left">Aprobado por</th>
                      <th className="px-4 py-3 text-left">Documento</th>
                      {isAdmin && <th className="px-4 py-3 text-left">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSolicitudes.map((solicitud) => {
                      const dias = diasSolicitados(
                        solicitud.fecha_inicio,
                        solicitud.fecha_fin
                      );
                      const estado = estadoVacaciones[solicitud.id_estado] || {
                        label: "Desconocido",
                        badgeClass: "bg-gray-200 text-gray-700",
                      };
                      const isPending = solicitud.id_estado === 1;
                      const isApproved = solicitud.id_estado === 2;
                      const approvedDays = solicitud.dias_aprobados || 0;
                      const isGenerating = downloadingId === solicitud.id_vacacion;

                      return (
                        <tr
                          key={solicitud.id_vacacion}
                          className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                        >
                          {isAdmin && (
                            <td className="px-4 py-3 text-gray-800">
                              <p className="font-semibold">
                                {solicitud.nombre || "Empleado"}{" "}
                                {solicitud.apellido || ""}
                              </p>
                              <p className="text-xs text-gray-500">
                                ID: {solicitud.id_empleado}
                              </p>
                            </td>
                          )}
                          <td className="px-4 py-3 text-gray-800">
                            <p className="font-medium">
                              {formatearFecha(solicitud.fecha_inicio)} -{" "}
                              {formatearFecha(solicitud.fecha_fin)}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {solicitud.motivo ? (
                              <span className="block max-w-xs text-gray-700 whitespace-pre-wrap">
                                {solicitud.motivo}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-800">{dias}</td>
                          <td className="px-4 py-3 text-gray-800">
                            {approvedDays > 0 ? approvedDays : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${estado.badgeClass}`}
                            >
                              {estado.label}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {formatearFecha(
                              solicitud.updated_at || solicitud.created_at
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {solicitud.aprobado_por_username || "—"}
                          </td>
                          <td className="px-4 py-3">
                            {isApproved ? (
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => onExport(solicitud)}
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
                            <td className="px-4 py-3">
                              {isPending ? (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="1"
                                      className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                      value={
                                        diasAprobados[solicitud.id_vacacion] ?? ""
                                      }
                                      placeholder={String(dias)}
                                      onChange={(event) =>
                                        handleDiasChange(
                                          solicitud.id_vacacion,
                                          event.target.value
                                        )
                                      }
                                    />
                                    <span className="text-xs text-gray-500">días</span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      variant="success"
                                      onClick={() => onApprove(solicitud)}
                                    >
                                      Aprobar
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="danger"
                                      onClick={() => onReject(solicitud)}
                                    >
                                      Rechazar
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-500">
                                  Sin acciones disponibles
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
};

Vacaciones.propTypes = {
  mode: PropTypes.oneOf(["admin", "empleado"]).isRequired,
};

export default Vacaciones;

