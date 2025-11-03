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
  calcularTotalLiquidacion,
} from "../hooks/useLiquidaciones";

const Liquidaciones = ({ mode }) => {
  const { user, logoutUser } = useAuth();
  const {
    liquidaciones,
    empleados,
    empleadosLoading,
    loading,
    submitting,
    actionLoading,
    error,
    successMessage,
    formData,
    handleChange,
    handleSubmit,
    resetForm,
    approveLiquidacion,
    rejectLiquidacion,
    setError,
    setSuccessMessage,
  } = useLiquidaciones();

  const isAdmin = mode === "admin";

  const sidebarLinks = useMemo(() => {
    if (isAdmin) {
      return [
        { path: "/admin", label: "Inicio" },
        { path: "/admin/asistencia", label: "Asistencia" },
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
      { path: "/empleado/liquidaciones", label: "Liquidaciones" },
    ];
  }, [isAdmin]);

  const roleColor = isAdmin ? "blue" : "green";
  const tituloPagina = isAdmin ? "Gestión de Liquidaciones" : "Mis Liquidaciones";

  const limpiarMensajes = () => {
    if (error) setError("");
    if (successMessage) setSuccessMessage("");
  };

  if (!user) {
    return <p className="p-6">Cargando información del usuario...</p>;
  }

  const totalCalculado = formatearMontoCRC(calcularTotalLiquidacion(formData));

  const renderEstado = (registro) => {
    const estado = estadosLiquidacion[registro.id_estado] || {
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

  const renderAcciones = (registro) => {
    if (!isAdmin) return null;
    if (registro.id_estado !== 1) {
      return <span className="text-xs text-gray-500">Sin acciones disponibles</span>;
    }

    const isProcessing = Boolean(actionLoading[registro.id_liquidacion]);

    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="success"
          size="sm"
          disabled={isProcessing}
          onClick={async () => {
            try {
              await approveLiquidacion(registro);
            } catch (_) {
              // El hook maneja el error
            }
          }}
        >
          {isProcessing ? "Procesando..." : "Aprobar"}
        </Button>
        <Button
          variant="danger"
          size="sm"
          disabled={isProcessing}
          onClick={async () => {
            try {
              await rejectLiquidacion(registro);
            } catch (_) {
              // El hook maneja el error
            }
          }}
        >
          Rechazar
        </Button>
      </div>
    );
  };

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
                  ? "Genera y gestiona las liquidaciones de los colaboradores, revisando su estado de aprobación."
                  : "Consulta el detalle de tus liquidaciones registradas en el sistema."}
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

          {isAdmin && (
            <section className="bg-white rounded-xl shadow-sm p-6">
              <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">
                    Registrar nueva liquidación
                  </h2>
                  <p className="text-sm text-gray-500">
                    Completa los montos correspondientes. El total se calcula automáticamente.
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  Total estimado: <span className="font-semibold">{totalCalculado}</span>
                </div>
              </header>

              <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    Colaborador
                  </label>
                  <select
                    name="id_empleado"
                    value={formData.id_empleado}
                    onChange={handleChange}
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
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    Fecha de liquidación
                  </label>
                  <input
                    type="date"
                    name="fecha_liquidacion"
                    value={formData.fecha_liquidacion}
                    onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    Salario acumulado
                  </label>
                  <input
                    type="number"
                    name="salario_acumulado"
                    value={formData.salario_acumulado}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    required
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    Vacaciones no gozadas
                  </label>
                  <input
                    type="number"
                    name="vacaciones_no_gozadas"
                    value={formData.vacaciones_no_gozadas}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    Cesantía
                  </label>
                  <input
                    type="number"
                    name="cesantia"
                    value={formData.cesantia}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    Preaviso
                  </label>
                  <input
                    type="number"
                    name="preaviso"
                    value={formData.preaviso}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    Antigüedad
                  </label>
                  <input
                    type="number"
                    name="antiguedad"
                    value={formData.antiguedad}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">
                    Estado inicial
                  </label>
                  <select
                    name="id_estado"
                    value={formData.id_estado}
                    onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {Object.entries(estadosLiquidacion).map(([value, info]) => (
                      <option key={value} value={value}>
                        {info.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 flex flex-wrap gap-3 pt-2">
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? "Guardando..." : "Registrar liquidación"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      limpiarMensajes();
                      resetForm();
                    }}
                  >
                    Limpiar formulario
                  </Button>
                </div>
              </form>
            </section>
          )}

          <section className="bg-white rounded-xl shadow-sm p-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">
                  Historial de liquidaciones
                </h2>
                <p className="text-sm text-gray-500">
                  Revisa los montos calculados y el estado de aprobación de cada liquidación.
                </p>
              </div>
              {loading && <p className="text-sm text-gray-500">Cargando registros...</p>}
            </header>

            {liquidaciones.length === 0 && !loading ? (
              <p className="text-gray-500 text-sm">
                Aún no hay liquidaciones registradas.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                    <tr>
                      {isAdmin && <th className="px-4 py-3 text-left">Colaborador</th>}
                      <th className="px-4 py-3 text-left">Fecha</th>
                      <th className="px-4 py-3 text-left">Salario</th>
                      <th className="px-4 py-3 text-left">Vacaciones</th>
                      <th className="px-4 py-3 text-left">Cesantía</th>
                      <th className="px-4 py-3 text-left">Preaviso</th>
                      <th className="px-4 py-3 text-left">Antigüedad</th>
                      <th className="px-4 py-3 text-left">Total a pagar</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3 text-left">Actualización</th>
                      {isAdmin && <th className="px-4 py-3 text-left">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {liquidaciones.map((registro) => {
                      const total = registro.total_pagar
                        ? Number(registro.total_pagar)
                        : calcularTotalLiquidacion(registro);

                      return (
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
                            {formatearMontoCRC(registro.salario_acumulado)}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {formatearMontoCRC(registro.vacaciones_no_gozadas)}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {formatearMontoCRC(registro.cesantia)}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {formatearMontoCRC(registro.preaviso)}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {formatearMontoCRC(registro.antiguedad)}
                          </td>
                          <td className="px-4 py-3 text-gray-800">
                            {formatearMontoCRC(total)}
                          </td>
                          <td className="px-4 py-3">{renderEstado(registro)}</td>
                          <td className="px-4 py-3 text-gray-800">
                            {formatearFechaCorta(registro.updated_at || registro.created_at)}
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3">{renderAcciones(registro)}</td>
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

Liquidaciones.propTypes = {
  mode: PropTypes.oneOf(["admin", "empleado"]).isRequired,
};

export default Liquidaciones;
