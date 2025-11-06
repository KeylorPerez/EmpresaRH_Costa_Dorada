import React, { useMemo } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import { usePlanilla } from "../hooks/usePlanilla";

const currencyFormatter = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  minimumFractionDigits: 2,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

const formatDate = (value) => {
  if (!value) return "-";

  if (typeof value === "string") {
    const [datePart] = value.split("T");

    if (datePart && /^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      const [year, month, day] = datePart.split("-");
      return `${day}/${month}/${year}`;
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString();
};

const formatPeriodo = (inicio, fin) => {
  if (!inicio || !fin) return "-";
  return `${formatDate(inicio)} - ${formatDate(fin)}`;
};

const Planilla = () => {
  const { user, logoutUser } = useAuth();
  const {
    planillas,
    empleados,
    loading,
    error,
    modalOpen,
    setModalOpen,
    editingPlanilla,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    openCreateModal,
    resetForm,
    setError,
    totals,
  } = usePlanilla();

  const adminLinks = useMemo(
    () => [
      { path: "/admin", label: "Inicio" },
      { path: "/admin/asistencia", label: "Asistencia" },
      { path: "/admin/usuarios", label: "Usuarios" },
      { path: "/admin/empleados", label: "Empleados" },
      { path: "/admin/puestos", label: "Puestos" },
      { path: "/admin/planilla", label: "Planilla" },
      { path: "/admin/vacaciones", label: "Vacaciones" },
      { path: "/admin/prestamos", label: "Préstamos" },
      { path: "/admin/liquidaciones", label: "Liquidaciones" },
    ],
    []
  );

  const closeModal = () => {
    setModalOpen(false);
    resetForm();
  };

  const selectedEmpleado = useMemo(
    () => empleados.find((emp) => String(emp.id_empleado) === formData.id_empleado),
    [empleados, formData.id_empleado]
  );

  const salarioBase = Number(selectedEmpleado?.salario_monto) || 0;
  const horasExtras = Number(formData.horas_extras || 0);
  const bonificaciones = Number(formData.bonificaciones || 0);
  const deduccionesManuales = Number(formData.deducciones || 0);
  const valorHora = salarioBase ? salarioBase / 160 : 0;
  const montoHorasExtras = horasExtras * valorHora;
  const salarioBrutoEstimado = salarioBase + bonificaciones + montoHorasExtras;
  const usaDeduccionFija = Boolean(Number(selectedEmpleado?.usa_deduccion_fija));
  const porcentajeCCSS = Number(selectedEmpleado?.porcentaje_ccss);
  const deduccionFija = Number(selectedEmpleado?.deduccion_fija);
  const porcentajeAplicable = Number.isNaN(porcentajeCCSS) ? 0 : porcentajeCCSS;
  const deduccionFijaAplicable = Number.isNaN(deduccionFija) ? 0 : deduccionFija;
  const deduccionesManualesAplicables = Number.isNaN(deduccionesManuales)
    ? 0
    : deduccionesManuales;
  const ccssDeduccionEstimado = usaDeduccionFija
    ? deduccionFijaAplicable
    : salarioBrutoEstimado * (porcentajeAplicable / 100);
  const totalDeduccionesEstimado = deduccionesManualesAplicables + ccssDeduccionEstimado;
  const pagoNetoEstimado = salarioBrutoEstimado - totalDeduccionesEstimado;

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

        <main className="flex-grow p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Planilla</h1>
              <p className="text-gray-500 text-sm">
                Calcula y registra los pagos correspondientes a cada periodo.
              </p>
            </div>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                setError("");
                openCreateModal();
              }}
            >
              Generar planilla
            </Button>
          </div>

          {error && (
            <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <article className="bg-white shadow rounded-xl p-4">
              <p className="text-sm text-gray-500">Planillas registradas</p>
              <p className="text-3xl font-semibold text-gray-800">{totals.cantidad}</p>
            </article>
            <article className="bg-white shadow rounded-xl p-4">
              <p className="text-sm text-gray-500">Pago neto acumulado</p>
              <p className="text-3xl font-semibold text-gray-800">{totals.totalPago}</p>
            </article>
          </section>

          {/* Tabla */}
          <section className="bg-white shadow rounded-xl overflow-hidden">
            {loading ? (
              <p className="p-6">Cargando planillas...</p>
            ) : planillas.length === 0 ? (
              <p className="p-6 text-gray-600">No hay planillas registradas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Empleado</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Periodo</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Salario base</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Horas extras</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Bonificaciones</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">CCSS</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Deducciones manuales</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total deducciones</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Salario bruto</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Pago neto</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Fecha pago</th>
                      <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {planillas.map((planilla) => (
                      <tr key={planilla.id_planilla} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-800">
                          {planilla.nombre
                            ? `${planilla.nombre} ${planilla.apellido}`
                            : planilla.id_empleado}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                          {formatPeriodo(planilla.periodo_inicio, planilla.periodo_fin)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-600">
                          {formatCurrency(planilla.salario_monto)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-600">
                          {planilla.horas_extras ?? 0}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-600">
                          {formatCurrency(planilla.bonificaciones)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-600">
                          {formatCurrency(planilla.ccss_deduccion)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-600">
                          {formatCurrency(planilla.deducciones)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-600">
                          {formatCurrency(
                            Number(planilla.deducciones || 0) + Number(planilla.ccss_deduccion || 0)
                          )}
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-600">
                          {formatCurrency(planilla.salario_bruto)}
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-semibold text-gray-800">
                          {formatCurrency(planilla.pago_neto)}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {planilla.fecha_pago ? formatDate(planilla.fecha_pago) : "Pendiente"}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <Button variant="warning" size="sm" onClick={() => handleEdit(planilla)}>
                            Editar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Modal */}
          {modalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-6">
              <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    {editingPlanilla ? "Actualizar planilla" : "Generar planilla"}
                  </h2>
                  <Button variant="secondary" size="sm" type="button" onClick={closeModal}>
                    Cerrar
                  </Button>
                </div>

                <form onSubmit={handleSubmit} className="flex h-full flex-col">
                  <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                    {error && (
                      <p className="text-red-500 text-sm bg-red-100 border border-red-200 px-3 py-2 rounded-lg">
                        {error}
                      </p>
                    )}

                    {/* Campos */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex flex-col gap-2 md:col-span-3">
                        <label htmlFor="id_empleado" className="text-sm font-medium text-gray-700">
                          Empleado
                        </label>
                        <select
                          id="id_empleado"
                          name="id_empleado"
                          value={formData.id_empleado}
                          onChange={handleChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                          disabled={Boolean(editingPlanilla)}
                          required={!editingPlanilla}
                        >
                          <option value="">Selecciona un empleado</option>
                          {empleados.map((empleado) => (
                            <option key={empleado.id_empleado} value={empleado.id_empleado}>
                              {empleado.nombre} {empleado.apellido}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label htmlFor="periodo_inicio" className="text-sm font-medium text-gray-700">
                          Fecha inicio del periodo
                        </label>
                        <input
                          type="date"
                          id="periodo_inicio"
                          name="periodo_inicio"
                          value={formData.periodo_inicio}
                          onChange={handleChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                          disabled={Boolean(editingPlanilla)}
                          required={!editingPlanilla}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label htmlFor="periodo_fin" className="text-sm font-medium text-gray-700">
                          Fecha fin del periodo
                        </label>
                        <input
                          type="date"
                          id="periodo_fin"
                          name="periodo_fin"
                          value={formData.periodo_fin}
                          onChange={handleChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                          disabled={Boolean(editingPlanilla)}
                          required={!editingPlanilla}
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label htmlFor="fecha_pago" className="text-sm font-medium text-gray-700">
                          Fecha de pago
                        </label>
                        <input
                          type="date"
                          id="fecha_pago"
                          name="fecha_pago"
                          value={formData.fecha_pago}
                          onChange={handleChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label htmlFor="horas_extras" className="text-sm font-medium text-gray-700">
                          Horas extras
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          id="horas_extras"
                          name="horas_extras"
                          value={formData.horas_extras}
                          onChange={handleChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label htmlFor="bonificaciones" className="text-sm font-medium text-gray-700">
                          Bonificaciones
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          id="bonificaciones"
                          name="bonificaciones"
                          value={formData.bonificaciones}
                          onChange={handleChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>

                      <div className="flex flex-col gap-2">
                        <label htmlFor="deducciones" className="text-sm font-medium text-gray-700">
                          Deducciones manuales
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          id="deducciones"
                          name="deducciones"
                          value={formData.deducciones}
                          onChange={handleChange}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>

                    {/* Totales */}
                    <div className="bg-gray-50 rounded-xl p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-500">Salario base</p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(salarioBase)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Monto horas extras</p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(montoHorasExtras)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Bonificaciones</p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(bonificaciones)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">CCSS estimado</p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(ccssDeduccionEstimado)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Deducciones manuales</p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(deduccionesManualesAplicables)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Total deducciones</p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(totalDeduccionesEstimado)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Salario bruto estimado</p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(salarioBrutoEstimado)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500">Pago neto estimado</p>
                        <p className="text-lg font-semibold text-gray-800">{formatCurrency(pagoNetoEstimado)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 px-6 pb-6 pt-4 border-t">
                    <Button variant="secondary" size="sm" type="button" onClick={closeModal}>
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" type="submit">
                      {editingPlanilla ? "Actualizar" : "Guardar"}
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

export default Planilla;

