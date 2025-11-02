import React, { useMemo } from "react";
import PropTypes from "prop-types";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import {
  usePrestamos,
  estadosPrestamo,
  formatearFecha,
  formatearMonto,
  formatearPorcentaje,
} from "../hooks/usePrestamos";

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
    actionLoading,
    setError,
    setSuccessMessage,
  } = usePrestamos();

  const isAdmin = mode === "admin";

  const sidebarLinks = useMemo(() => {
    if (isAdmin) {
      return [
        { path: "/admin", label: "Inicio" },
        { path: "/admin/usuarios", label: "Usuarios" },
        { path: "/admin/empleados", label: "Empleados" },
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
    ];
  }, [isAdmin]);

  const roleColor = isAdmin ? "blue" : "green";
  const tituloPagina = isAdmin ? "Gestión de Préstamos" : "Mis Préstamos";

  const limpiarMensajes = () => {
    if (error) setError("");
    if (successMessage) setSuccessMessage("");
  };

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
            } catch (_) {
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
            } catch (_) {
              // Error ya mostrado
            }
          }}
        >
          Rechazar
        </Button>
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

          {!isAdmin && (
            <section className="bg-white rounded-xl shadow-sm p-6">
              <header className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800">Solicitar préstamo</h2>
                <p className="text-sm text-gray-500">
                  Completa la información y envía tu solicitud de préstamo al departamento financiero.
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cuotas</label>
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
                    max={new Date().toISOString().split("T")[0]}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-400"
                    required
                  />
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
          )}

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

            {prestamos.length === 0 && !loading ? (
              <p className="text-sm text-gray-500">
                {isAdmin
                  ? "No hay solicitudes de préstamo registradas."
                  : "Aún no has realizado solicitudes de préstamo."}
              </p>
            ) : (
              <div className="overflow-x-auto">
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
                      {isAdmin && <th className="px-4 py-3 text-left">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {prestamos.map((prestamo) => (
                      <tr
                        key={prestamo.id_prestamo}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        {isAdmin && (
                          <td className="px-4 py-3 text-gray-800">
                            <p className="font-semibold">
                              {prestamo.nombre || "Empleado"} {prestamo.apellido || ""}
                            </p>
                            <p className="text-xs text-gray-500">ID #{prestamo.id_empleado}</p>
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
                        {isAdmin && <td className="px-4 py-3">{renderAcciones(prestamo)}</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
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
