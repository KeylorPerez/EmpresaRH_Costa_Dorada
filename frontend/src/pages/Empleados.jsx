import React, { useMemo, useState } from "react";
import { useEmpleado } from "../hooks/useEmpleado";
import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";

const Empleados = () => {
  const { user, logoutUser } = useAuth();
  const {
    empleados,
    puestos,
    loading,
    error,
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
  } = useEmpleado();

  const [statusFilter, setStatusFilter] = useState("all");

  const filteredEmpleados = useMemo(() => {
    if (statusFilter === "all") return empleados;
    const shouldBeActive = statusFilter === "active";
    return empleados.filter((emp) => isActive(emp.estado) === shouldBeActive);
  }, [empleados, statusFilter]);

  const adminLinks = [
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

  if (!user) return <p>Cargando usuario...</p>;
  if (user.id_rol !== 1) return <p>No tienes permisos para ver esta página.</p>;

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar links={adminLinks} roleColor="blue" />
      <div className="flex flex-col flex-grow">
        <Navbar
          title="Panel de Administración"
          user={user}
          roleColor="blue"
          onLogout={logoutUser}
        />
        <main className="flex-grow p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Empleados</h1>
              <p className="text-sm text-gray-500">
                Administra la información registrada en la tabla{" "}
                <strong>Empleados</strong> de SQL Server.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todos</option>
                <option value="active">Activos</option>
                <option value="inactive">Inactivos</option>
              </select>
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  resetForm();
                  setError("");
                  setModalOpen(true);
                }}
              >
                Agregar Empleado
              </Button>
            </div>
          </div>

          {error && <p className="text-red-500 mb-2">{error}</p>}

          {loading ? (
            <p>Cargando empleados...</p>
          ) : (
            <div className="overflow-x-auto shadow-sm border border-gray-200 rounded-lg">
              <table className="min-w-full bg-white text-sm">
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
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmpleados.length === 0 ? (
                    <tr>
                      <td colSpan="10" className="px-4 py-6 text-center text-gray-500">
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
                              {emp.tipo_pago || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {formatCurrency(emp.salario_monto)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {formatCurrency(emp.bonificacion_fija)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-gray-900">
                            {formatCurrency(emp.bonificacion_fija)}
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
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {modalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center">
              <div className="bg-white p-6 rounded-lg w-full max-w-2xl shadow-lg">
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
                    />
                    <FormField
                      label="Correo electrónico"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                    />
                    <FormField
                      label="Fecha de nacimiento"
                      name="fecha_nacimiento"
                      type="date"
                      value={formData.fecha_nacimiento}
                      onChange={handleChange}
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
                        Puesto
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

const FormField = ({ label, name, value, onChange, type = "text", required = false, step, min }) => (
  <div className="flex flex-col">
    <label className="text-sm font-medium text-gray-700 mb-1">
      {label}
      {required && <span className="text-red-500"> *</span>}
    </label>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      required={required}
      step={step}
      min={min}
      className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
    />
  </div>
);

const isActive = (estado) => estado === 1 || estado === true || estado === "1";

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

export default Empleados;

