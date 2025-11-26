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
    puestos,
    loading,
    error,
    successMessage,
    modalOpen,
    setModalOpen,
    editingEmpleado,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    handleDeactivate,
    handleActivate,
    resetForm,
    setError,
    setSuccessMessage,
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
  const columnsCount = isAdmin ? 13 : 12;

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
                {isAdmin && (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => {
                      resetForm();
                      setError("");
                      setSuccessMessage("");
                      setModalOpen(true);
                    }}
                  >
                    Agregar Empleado
                  </Button>
                )}
              </div>
              {isAdmin && (
                <div className="mt-3 flex flex-wrap items-center gap-2 md:justify-end md:mt-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={exportDisabled}
                    onClick={() => exportEmpleados("pdf", { status: statusFilter })}
                  >
                    {isExportingPdf ? "Generando PDF..." : "Exportar PDF"}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={exportDisabled}
                    onClick={() => exportEmpleados("excel", { status: statusFilter })}
                  >
                    {isExportingExcel ? "Generando Excel..." : "Exportar Excel"}
                  </Button>
                  <Button
                    variant="primary"
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
                                  <p className="text-xs text-gray-500">
                                    ID: {emp.id_empleado}
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
                                <td className="px-4 py-3 font-semibold text-gray-900">
                                  {formatCurrency(emp.salario_monto)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900">
                                  {formatCurrency(emp.bonificacion_fija)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900">
                                  {formatPercentage(emp)}
                                </td>
                                <td className="px-4 py-3 font-semibold text-gray-900">
                                  {formatCurrency(calculateCCSSDeduccion(emp))}
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
                                      <Button
                                        variant="warning"
                                        size="sm"
                                        onClick={() => handleEdit(emp)}
                                      >
                                        Editar
                                      </Button>
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

          {isAdmin && modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm overflow-y-auto p-4">
              <div className="bg-white p-6 rounded-2xl w-full max-w-2xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    {editingEmpleado ? "Editar Empleado" : "Agregar Empleado"}
                  </h2>
                  <button
                    aria-label="Cerrar"
                    onClick={() => {
                      resetForm();
                      setModalOpen(false);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                {error && (
                  <div
                    role="alert"
                    className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                  >
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      label="Nombre"
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleChange}
                      required
                    />
                    <FormField
                      label="Apellido"
                      name="apellido"
                      value={formData.apellido}
                      onChange={handleChange}
                      required
                    />
                    <FormField
                      label="Cédula"
                      name="cedula"
                      value={formData.cedula}
                      onChange={handleChange}
                      required
                    />
                    <FormField
                      label="Teléfono"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleChange}
                      optional
                    />
                    <FormField
                      label="Correo electrónico"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      optional
                    />
                    <FormField
                      label="Fecha de nacimiento"
                      name="fecha_nacimiento"
                      type="date"
                      value={formData.fecha_nacimiento}
                      onChange={handleChange}
                      optional
                    />
                    <FormField
                      label="Fecha de ingreso"
                      name="fecha_ingreso"
                      type="date"
                      value={formData.fecha_ingreso}
                      onChange={handleChange}
                      required
                    />
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">
                        Puesto<span className="text-red-500"> *</span>
                      </label>
                      <select
                        name="id_puesto"
                        value={formData.id_puesto}
                        onChange={handleChange}
                        required
                        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Selecciona un puesto</option>
                        {puestos.map((puesto) => (
                          <option key={puesto.id_puesto} value={puesto.id_puesto}>
                            {puesto.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <FormField
                      label="Salario base"
                      name="salario_monto"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.salario_monto}
                      onChange={handleChange}
                      required
                    />
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">
                        Tipo de pago<span className="text-red-500"> *</span>
                      </label>
                      <select
                        name="tipo_pago"
                        value={formData.tipo_pago}
                        onChange={handleChange}
                        required
                        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Diario">Diario</option>
                        <option value="Quincenal">Quincenal</option>
                      </select>
                    </div>
                    <FormField
                      label="Bonificación fija"
                      name="bonificacion_fija"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.bonificacion_fija}
                      onChange={handleChange}
                    />
                    <FormField
                      label="Porcentaje CCSS (%)"
                      name="porcentaje_ccss"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.porcentaje_ccss}
                      onChange={handleChange}
                      disabled={formData.usa_deduccion_fija === "1"}
                      required={formData.usa_deduccion_fija !== "1"}
                    />
                    <div className="md:col-span-2 -mt-2">
                      <p className="text-xs text-gray-500">
                        Usa el porcentaje estándar si no aplicas una deducción fija.
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">
                        Usa deducción fija CCSS
                      </label>
                      <select
                        name="usa_deduccion_fija"
                        value={formData.usa_deduccion_fija}
                        onChange={handleChange}
                        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="0">No</option>
                        <option value="1">Sí</option>
                      </select>
                    </div>
                    <FormField
                      label="Deducción fija CCSS"
                      name="deduccion_fija"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.deduccion_fija}
                      onChange={handleChange}
                      disabled={formData.usa_deduccion_fija !== "1"}
                      required={formData.usa_deduccion_fija === "1"}
                    />
                    <div className="md:col-span-2 -mt-2">
                      <p className="text-xs text-gray-500">
                        Solo obligatorio cuando seleccionas una deducción fija.
                      </p>
                    </div>
                    <div className="flex flex-col">
                      <label className="text-sm font-medium text-gray-700 mb-1">
                        Permitir marcación fuera de la oficina
                      </label>
                      <select
                        name="permitir_marcacion_fuera"
                        value={formData.permitir_marcacion_fuera}
                        onChange={handleChange}
                        className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="0">No</option>
                        <option value="1">Sí</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1">
                        Al activar esta opción, el colaborador podrá registrar asistencia aún si se encuentra fuera del rango de la
                        oficina.
                      </p>
                    </div>
                    {editingEmpleado && (
                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1">
                          Estado
                        </label>
                        <select
                          name="estado"
                          value={formData.estado}
                          onChange={handleChange}
                          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="1">Activo</option>
                          <option value="0">Inactivo</option>
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => {
                        resetForm();
                        setModalOpen(false);
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" type="submit">
                      {editingEmpleado ? "Actualizar" : "Crear"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

const FormField = ({
  label,
  name,
  value,
  onChange,
  type = "text",
  required = false,
  step,
  min,
  disabled = false,
  optional = false,
}) => (
  <div className="flex flex-col">
    <label className="text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500"> *</span>}
      {optional && !required && (
        <span className="text-gray-400 text-xs font-normal ml-1">(Opcional)</span>
      )}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      step={step}
      min={min}
      disabled={disabled}
      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

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

