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
    handleToggleDescanso,
    handleToggleDescansoDia,
    handleSubmit,
    handleEdit,
    resetForm,
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
  const [activeDescansoTab, setActiveDescansoTab] = useState("A");
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

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  if (!user) return <p>Cargando usuario...</p>;
  if (isAdmin && user.id_rol !== 1) return <p>No tienes permisos para ver esta página.</p>;
  if (!isAdmin && user.id_rol !== 2) return <p>No tienes permisos para ver esta página.</p>;

  const isExportingPdf = exportingFormat === "pdf";
  const isExportingExcel = exportingFormat === "excel";
  const exportDisabled = loading || Boolean(exportingFormat);
  const columnsCount = isAdmin ? 14 : 13;
  const isPagoDiario = String(formData.tipo_pago || "")
    .toLowerCase()
    .startsWith("diar");
  const descansoTabs = [
    { value: "A", label: "Periodo A" },
    { value: "B", label: "Periodo B" },
  ];
  const diasSemana = [
    { value: "0", label: "Domingo" },
    { value: "1", label: "Lunes" },
    { value: "2", label: "Martes" },
    { value: "3", label: "Miércoles" },
    { value: "4", label: "Jueves" },
    { value: "5", label: "Viernes" },
    { value: "6", label: "Sábado" },
  ];

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
                  <Button variant="primary" size="sm" onClick={openCreateModal}>
                    Agregar empleado
                  </Button>
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
                                      <Button
                                        variant="warning"
                                        size="sm"
                                        onClick={() => handleEdit(emp)}
                                      >
                                        Editar
                                      </Button>
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

          {modalOpen && (
            <div className="fixed inset-0 bg-black/30 flex justify-center items-center z-50">
              <div className="bg-white rounded-xl w-full max-w-5xl shadow-lg max-h-[90vh] overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-800">
                      {editingEmpleado ? "Editar empleado" : "Agregar empleado"}
                    </h2>
                    <p className="text-xs text-gray-500">
                      Completa la información general y la configuración de descanso.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Cerrar"
                    onClick={closeModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-6 px-6 py-4 overflow-y-auto max-h-[75vh]"
                >
                  <section className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Nombre
                      </label>
                      <input
                        type="text"
                        name="nombre"
                        value={formData.nombre}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Apellido
                      </label>
                      <input
                        type="text"
                        name="apellido"
                        value={formData.apellido}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Puesto
                      </label>
                      <select
                        name="id_puesto"
                        value={formData.id_puesto}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      >
                        <option value="">Selecciona un puesto</option>
                        {puestos.map((puesto) => (
                          <option key={puesto.id_puesto} value={puesto.id_puesto}>
                            {puesto.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Cédula
                      </label>
                      <input
                        type="text"
                        name="cedula"
                        value={formData.cedula}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de nacimiento
                      </label>
                      <input
                        type="date"
                        name="fecha_nacimiento"
                        value={formData.fecha_nacimiento}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fecha de ingreso
                      </label>
                      <input
                        type="date"
                        name="fecha_ingreso"
                        value={formData.fecha_ingreso}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Teléfono
                      </label>
                      <input
                        type="tel"
                        name="telefono"
                        value={formData.telefono}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      />
                    </div>
                  </section>

                  <section className="grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Salario base
                      </label>
                      <input
                        type="number"
                        name="salario_monto"
                        value={formData.salario_monto}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Tipo de pago
                      </label>
                      <select
                        name="tipo_pago"
                        value={formData.tipo_pago}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        required
                      >
                        <option value="Diario">Diario</option>
                        <option value="Quincenal">Quincenal</option>
                        <option value="Mensual">Mensual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Bonificación fija
                      </label>
                      <input
                        type="number"
                        name="bonificacion_fija"
                        value={formData.bonificacion_fija}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        % CCSS
                      </label>
                      <input
                        type="number"
                        name="porcentaje_ccss"
                        value={formData.porcentaje_ccss}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Deducción CCSS
                      </label>
                      <select
                        name="usa_deduccion_fija"
                        value={formData.usa_deduccion_fija}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      >
                        <option value="1">Monto fijo</option>
                        <option value="0">Porcentaje</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Monto deducción fija
                      </label>
                      <input
                        type="number"
                        name="deduccion_fija"
                        value={formData.deduccion_fija}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        min="0"
                        step="0.01"
                        disabled={formData.usa_deduccion_fija !== "1"}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Planilla automática
                      </label>
                      <select
                        name="planilla_automatica"
                        value={formData.planilla_automatica}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      >
                        <option value="1">Automática</option>
                        <option value="0">Manual</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Marcación externa
                      </label>
                      <select
                        name="permitir_marcacion_fuera"
                        value={formData.permitir_marcacion_fuera}
                        onChange={handleChange}
                        className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                      >
                        <option value="1">Permitida</option>
                        <option value="0">Restringida</option>
                      </select>
                    </div>
                    {editingEmpleado && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Estado
                        </label>
                        <select
                          name="estado"
                          value={formData.estado}
                          onChange={handleChange}
                          className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                        >
                          <option value="1">Activo</option>
                          <option value="0">Inactivo</option>
                        </select>
                      </div>
                    )}
                  </section>

                  {!isPagoDiario && (
                    <section className="border border-gray-200 rounded-lg p-4 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800">
                            Configuración de descansos
                          </h3>
                          <p className="text-xs text-gray-500">
                            Define el patrón de descanso semanal o quincenal.
                          </p>
                        </div>
                        <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                          <input
                            type="checkbox"
                            checked={formData.descanso_config_habilitado}
                            onChange={(event) => handleToggleDescanso(event.target.checked)}
                          />
                          Activar descanso
                        </label>
                      </div>

                      {formData.descanso_config_habilitado && (
                        <>
                          <div className="grid gap-4 md:grid-cols-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tipo de patrón
                              </label>
                              <select
                                name="descanso_tipo_patron"
                                value={formData.descanso_tipo_patron}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                              >
                                <option value="FIJO">Fijo</option>
                                <option value="ALTERNADO">Alternado</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Ciclo
                              </label>
                              <select
                                name="descanso_ciclo"
                                value={formData.descanso_ciclo}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                              >
                                <option value="SEMANAL">Semanal</option>
                                <option value="QUINCENAL">Quincenal</option>
                              </select>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fecha base
                              </label>
                              <input
                                type="date"
                                name="descanso_fecha_base"
                                value={formData.descanso_fecha_base}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Inicio de vigencia
                              </label>
                              <input
                                type="date"
                                name="descanso_fecha_inicio_vigencia"
                                value={formData.descanso_fecha_inicio_vigencia}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                Fin de vigencia
                              </label>
                              <input
                                type="date"
                                name="descanso_fecha_fin_vigencia"
                                value={formData.descanso_fecha_fin_vigencia}
                                onChange={handleChange}
                                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex gap-2 flex-wrap">
                              {descansoTabs.map((tab) => {
                                const isFixed =
                                  String(formData.descanso_tipo_patron || "").toUpperCase() === "FIJO";
                                const isDisabled = isFixed && tab.value === "B";
                                return (
                                  <button
                                    key={tab.value}
                                    type="button"
                                    onClick={() => setActiveDescansoTab(tab.value)}
                                    disabled={isDisabled}
                                    className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                                      activeDescansoTab === tab.value
                                        ? "bg-blue-600 text-white border-blue-600"
                                        : "bg-white text-gray-600 border-gray-200"
                                    } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
                                  >
                                    {tab.label}
                                  </button>
                                );
                              })}
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              {String(formData.descanso_tipo_patron || "").toUpperCase() === "FIJO"
                                ? "El patrón fijo replica los mismos días en ambos periodos."
                                : "Define los días de descanso para cada periodo."}
                            </p>
                          </div>

                          <div className="grid gap-2 md:grid-cols-3">
                            {diasSemana.map((dia) => {
                              const checked = (formData.descanso_dias?.[activeDescansoTab] || []).includes(
                                dia.value
                              );
                              return (
                                <label
                                  key={`${activeDescansoTab}-${dia.value}`}
                                  className="flex items-center gap-2 text-sm text-gray-700"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() =>
                                      handleToggleDescansoDia(activeDescansoTab, dia.value)
                                    }
                                  />
                                  {dia.label}
                                </label>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </section>
                  )}

                  {isPagoDiario && (
                    <p className="text-xs text-gray-500">
                      El descanso semanal aplica para pagos quincenales o mensuales.
                    </p>
                  )}

                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" size="sm" type="button" onClick={closeModal}>
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
