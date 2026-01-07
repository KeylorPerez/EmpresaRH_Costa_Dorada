import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useEmpleado } from "../hooks/useEmpleado";
import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { adminLinks, empleadoLinks } from "../utils/navigationLinks";

const Empleados = ({ mode = "admin" }) => {
  const { user, logoutUser } = useAuth();
  const {
    empleados,
    loading,
    error,
    successMessage,
    handleDeactivate,
    handleActivate,
    exportingFormat,
    exportEmpleados,
    shareEmpleados,
  } = useEmpleado();

  const isAdmin = mode === "admin";
  const isReadOnly = !isAdmin;
  const roleColor = isAdmin ? "blue" : "green";
  const navigationLinks = isAdmin ? adminLinks : empleadoLinks;
  const panelTitle = isAdmin ? "Panel de Administración" : "Panel del Empleado";
  const pageTitle = isAdmin ? "Empleados" : "Mi información";
  const pageSubtitle = isAdmin
    ? "Administra y gestiona la información del personal registrado en el sistema."
    : "Consulta tus datos laborales registrados en el sistema.";

  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const currentEmpleadoId = useMemo(() => {
    const possibleIds = [
      user?.id_empleado,
      user?.empleado_id,
      user?.idEmpleado,
      user?.empleadoId,
    ];

    const foundId = possibleIds.find((value) => value !== undefined && value !== null);
    return foundId ? Number(foundId) : null;
  }, [user]);

  const scopedEmpleados = useMemo(() => {
    if (isAdmin) return empleados;
    if (!currentEmpleadoId) return [];

    return empleados.filter(
      (emp) => Number(emp.id_empleado) === Number(currentEmpleadoId)
    );
  }, [currentEmpleadoId, empleados, isAdmin]);

  const filteredEmpleados = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return scopedEmpleados
      .filter((emp) => {
        if (statusFilter === "all") return true;
        const shouldBeActive = statusFilter === "active";
        return isActive(emp.estado) === shouldBeActive;
      })
      .filter((emp) => {
        if (!normalizedSearch) return true;
        const fullName = `${emp.nombre} ${emp.apellido}`.toLowerCase();
        return fullName.includes(normalizedSearch);
      });
  }, [scopedEmpleados, searchTerm, statusFilter]);

  if (!user) return <p>Cargando usuario...</p>;
  if (isAdmin && user.id_rol !== 1) return <p>No tienes permisos para ver esta página.</p>;
  if (!isAdmin && user.id_rol !== 2) return <p>No tienes permisos para ver esta página.</p>;

  const isExportingPdf = exportingFormat === "pdf";
  const isExportingExcel = exportingFormat === "excel";
  const exportDisabled = loading || Boolean(exportingFormat);
  const columnsCount = isAdmin ? 14 : 13;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar
        links={navigationLinks}
        roleColor={roleColor}
        isMobileOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex flex-col flex-grow">
        <Navbar
          title={panelTitle}
          user={user}
          roleColor={roleColor}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onLogout={logoutUser}
        />
        <main className="flex-grow p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{pageTitle}</h1>
              <p className="text-sm text-gray-500">{pageSubtitle}</p>
              {isReadOnly && (
                <p className="mt-1 text-xs font-semibold text-emerald-600">
                  Solo lectura — puedes revisar tus datos, pero no modificarlos.
                </p>
              )}
            </div>
            <div className="flex flex-col md:items-end md:gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos</option>
                  <option value="active">Activos</option>
                  <option value="inactive">Inactivos</option>
                </select>
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar por nombre"
                    className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
                </div>
              </div>
              {isAdmin && (
                <div className="mt-3 flex flex-wrap items-center gap-2 md:justify-end md:mt-2">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={exportDisabled}
                    onClick={() => exportEmpleados("pdf", { status: statusFilter })}
                  >
                    {isExportingPdf ? "Generando PDF..." : "Exportar PDF"}
                  </Button>
                  <Button
                    variant="success"
                    size="sm"
                    disabled={exportDisabled}
                    onClick={() => exportEmpleados("excel", { status: statusFilter })}
                  >
                    {isExportingExcel ? "Generando Excel..." : "Exportar Excel"}
                  </Button>
                  <Button
                    variant="warning"
                    size="sm"
                    disabled={exportDisabled}
                    onClick={() => shareEmpleados({ status: statusFilter })}
                  >
                    Compartir
                  </Button>
                </div>
              )}
            </div>
          </div>

          {error && <p className="text-red-500 mb-2">{error}</p>}
          {successMessage && (
            <p className="text-green-600 mb-2 font-medium">{successMessage}</p>
          )}

          {loading ? (
            <p>Cargando empleados...</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-gray-500">
                Desliza horizontal y verticalmente para revisar todos los
                registros sin alargar la página.
              </p>
              <div className="border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <div className="max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <table className="min-w-[1100px] w-full bg-white text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                          <th className="px-4 py-3">Empleado</th>
                          <th className="px-4 py-3">Documento</th>
                          <th className="px-4 py-3">Puesto</th>
                          <th className="px-4 py-3">Contacto</th>
                          <th className="px-4 py-3">Fechas</th>
                          <th className="px-4 py-3">Tipo de Pago</th>
                          <th className="px-4 py-3">Salario Base</th>
                          <th className="px-4 py-3">Bonificación Fija</th>
                          <th className="px-4 py-3">% CCSS</th>
                          <th className="px-4 py-3">Deducción CCSS</th>
                          <th className="px-4 py-3">Planilla automática</th>
                          <th className="px-4 py-3">Marcación externa</th>
                          <th className="px-4 py-3">Estado</th>
                          {isAdmin && <th className="px-4 py-3">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredEmpleados.length === 0 ? (
                          <tr>
                            <td colSpan={columnsCount} className="px-4 py-6 text-center text-gray-500">
                              No hay empleados registrados con el filtro seleccionado.
                            </td>
                          </tr>
                        ) : (
                          filteredEmpleados.map((emp) => {
                            const active = isActive(emp.estado);
                            return (
                              <tr
                                key={emp.id_empleado}
                                className="border-t border-gray-100 hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-4 py-3">
                                  <p className="font-semibold text-gray-900">
                                    {emp.nombre} {emp.apellido}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="font-medium text-gray-800">{emp.cedula}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-gray-800 font-medium">{emp.puesto_nombre}</p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-gray-800">{emp.telefono || "—"}</p>
                                  <p className="text-xs text-gray-500">
                                    {emp.email || "Sin correo"}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <p className="text-gray-800">
                                    Ingreso: {formatDate(emp.fecha_ingreso)}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Nacimiento: {formatDate(emp.fecha_nacimiento)}
                                  </p>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                                    {emp.tipo_pago || "—"}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                                  {formatCurrency(emp.salario_monto)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                                  {formatCurrency(emp.bonificacion_fija)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900">
                                  {formatPercentage(emp)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">
                                  {formatCurrency(calculateCCSSDeduccion(emp))}
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                      Number(emp.es_automatica ?? emp.planilla_automatica) === 1
                                        ? "bg-emerald-100 text-emerald-700"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {Number(emp.es_automatica ?? emp.planilla_automatica) === 1
                                      ? "Automática"
                                      : "Manual"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                      Number(emp.permitir_marcacion_fuera) === 1
                                        ? "bg-indigo-100 text-indigo-700"
                                        : "bg-gray-100 text-gray-600"
                                    }`}
                                  >
                                    {Number(emp.permitir_marcacion_fuera) === 1
                                      ? "Permitida"
                                      : "Restringida"}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                                      active
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-700"
                                    }`}
                                  >
                                    {active ? "Activo" : "Inactivo"}
                                  </span>
                                </td>
                                {isAdmin && (
                                  <td className="px-4 py-3">
                                    <div className="flex flex-wrap gap-2">
                                      {active ? (
                                        <Button
                                          variant="danger"
                                          size="sm"
                                          onClick={() => handleDeactivate(emp.id_empleado)}
                                        >
                                          Desactivar
                                        </Button>
                                      ) : (
                                        <Button
                                          variant="success"
                                          size="sm"
                                          onClick={() => handleActivate(emp.id_empleado)}
                                        >
                                          Activar
                                        </Button>
                                      )}
                                    </div>
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const isActive = (estado) => estado === 1 || estado === true || estado === "1";

const formatDate = (value) => {
  if (!value) return "—";

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
    if (match) {
      const [, year, month, day] = match;
      return `${day}/${month}/${year}`;
    }
  }

  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${day}/${month}/${year}`;
};

const currencyFormatter = new Intl.NumberFormat("es-CR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const formatCurrency = (value) => {
  if (value === undefined || value === null || value === "") return "—";
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return value;
  return `₡ ${currencyFormatter.format(numeric)}`;
};

const usesFixedDeduction = (empleado) => {
  if (!empleado) return false;
  return Boolean(Number(empleado.usa_deduccion_fija));
};

const formatPercentage = (empleado) => {
  if (!empleado) return "—";
  if (usesFixedDeduction(empleado)) return "Monto fijo";
  const value = Number(empleado.porcentaje_ccss);
  if (Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}%`;
};

const calculateCCSSDeduccion = (empleado) => {
  if (!empleado) return 0;
  if (usesFixedDeduction(empleado)) {
    return Number(empleado.deduccion_fija || 0);
  }
  const salarioBase = Number(empleado.salario_monto) || 0;
  const porcentaje = Number(empleado.porcentaje_ccss) || 0;
  return salarioBase * (porcentaje / 100);
};

Empleados.propTypes = {
  mode: PropTypes.oneOf(["admin", "empleado"]),
};

export default Empleados;
