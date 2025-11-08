import React, { useEffect, useMemo, useRef, useState } from "react";
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
    selectEmpleado,
    resetForm,
    setError,
    totals,
    prestamosEmpleado,
    prestamoSelections,
    togglePrestamo,
    updateMontoPrestamo,
    totalPrestamosSeleccionados,
    attendanceState,
    refreshAttendance,
    detalleDias,
    updateDetalleDia,
    toggleDetalleAsistencia,
    toggleDetalleDiaDoble,
    detalleDiasResumen,
    loadDetallePlanilla,
    closeDetallePlanilla,
    detalleSeleccionado,
  } = usePlanilla();

  const isEditing = Boolean(editingPlanilla);
  const [activeEmpleadoIndex, setActiveEmpleadoIndex] = useState(0);
  const [wizardSearch, setWizardSearch] = useState("");

  // ✅ Mantener este bloque (resuelve el conflicto)
  const modalScrollRef = useRef(null);
  const detalleOverlayFocusRef = useRef(null);
  const [detalleOverlayOpen, setDetalleOverlayOpen] = useState(false);

  useEffect(() => {
    if (!modalOpen) return;
    const scrollContainer = modalScrollRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTo({ top: 0, behavior: "auto" });
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen || !error) return;
    const scrollContainer = modalScrollRef.current;
    if (!scrollContainer) return;
    scrollContainer.scrollTo({ top: 0, behavior: "smooth" });
  }, [error, modalOpen]);

  useEffect(() => {
    if (!modalOpen) {
      setDetalleOverlayOpen(false);
    }
  }, [modalOpen]);

  useEffect(() => {
    if (!detalleOverlayOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDetalleOverlayOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [detalleOverlayOpen]);

  useEffect(() => {
    if (detalleOverlayOpen && detalleOverlayFocusRef.current) {
      detalleOverlayFocusRef.current.focus({ preventScroll: true });
    }
  }, [detalleOverlayOpen]);

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
    setDetalleOverlayOpen(false);
  };

  const selectedEmpleado = useMemo(
    () => empleados.find((emp) => String(emp.id_empleado) === formData.id_empleado),
    [empleados, formData.id_empleado]
  );

  const empleadosFiltrados = useMemo(() => {
    if (!wizardSearch.trim()) return empleados;
    const term = wizardSearch.trim().toLowerCase();
    return empleados.filter((empleado) => {
      const nombreCompleto = `${empleado.nombre || ""} ${empleado.apellido || ""}`.toLowerCase();
      return nombreCompleto.includes(term) || String(empleado.id_empleado).includes(term);
    });
  }, [empleados, wizardSearch]);

  const detalleSeleccionadoResumen = useMemo(() => {
    if (!detalleSeleccionado?.dias || detalleSeleccionado.dias.length === 0) {
      return { dias: 0, asistencias: 0, total: 0 };
    }

    return detalleSeleccionado.dias.reduce(
      (acumulado, detalle) => {
        acumulado.dias += 1;
        if (detalle.asistio) {
          const salario = Number(detalle.salario_dia) || 0;
          const factor = detalle.es_dia_doble ? 2 : 1;
          acumulado.asistencias += factor;
          acumulado.total += salario * factor;
        }
        return acumulado;
      },
      { dias: 0, asistencias: 0, total: 0 }
    );
  }, [detalleSeleccionado]);

  const DetalleResumenBadges = ({ className = "" }) => (
    <div className={`flex flex-wrap items-center gap-3 text-xs text-gray-500 ${className}`}>
      <span>Días: {detalleDias.length}</span>
      <span>Pagados: {detalleDiasResumen.diasAsistidos}</span>
      <span>Total: {formatCurrency(detalleDiasResumen.salarioTotal)}</span>
    </div>
  );

  const DetalleTable = ({ className = "" }) => {
    if (detalleDias.length === 0) {
      return (
        <p className={`text-sm text-gray-500 ${className}`}>
          Selecciona un colaborador y un periodo para visualizar el detalle diario de la planilla.
        </p>
      );
    }

    return (
      <div className={`overflow-x-auto rounded-xl border border-gray-100 ${className}`}>
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Fecha</th>
              <th className="px-4 py-3 text-left">Día</th>
              <th className="px-4 py-3 text-center">Asistencia</th>
              <th className="px-4 py-3 text-center">Tipo</th>
              <th className="px-4 py-3 text-right">Salario día</th>
              <th className="px-4 py-3 text-left">Observación</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {detalleDias.map((detalle, index) => (
              <tr key={`${detalle.fecha}-${index}`} className="hover:bg-gray-50/70">
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(detalle.fecha)}</td>
                <td className="px-4 py-3 capitalize text-gray-600">{detalle.dia_semana}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleDetalleAsistencia(index)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      detalle.asistio
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-red-100 text-red-600 hover:bg-red-200"
                    }`}
                  >
                    {detalle.asistio ? "Asistió" : "Faltó"}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleDetalleDiaDoble(index)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      detalle.es_dia_doble
                        ? "bg-purple-100 text-purple-700 hover:bg-purple-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {detalle.es_dia_doble ? "Día doble" : "Normal"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detalle.salario_dia ?? ""}
                    onChange={(event) => updateDetalleDia(index, { salario_dia: event.target.value })}
                    className="w-28 rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={detalle.observacion || ""}
                    onChange={(event) => updateDetalleDia(index, { observacion: event.target.value })}
                    placeholder="Opcional"
                    className="w-full rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const tipoPago = selectedEmpleado?.tipo_pago || "Quincenal";
  const salarioBaseReferencia = Number(selectedEmpleado?.salario_monto) || 0;
  const horasExtras = Number(formData.horas_extras || 0);
  const bonificaciones = Number(formData.bonificaciones || 0);
  const deduccionesManualInput = Number(formData.deducciones || 0);
  const diasTrabajadosValor = Number(formData.dias_trabajados);
  const diasTrabajadosAplicados =
    Number.isNaN(diasTrabajadosValor) || diasTrabajadosValor < 0 ? 0 : diasTrabajadosValor;
  const diasDescuentoValor = Number(formData.dias_descuento);
  const diasDescuentoAplicados =
    Number.isNaN(diasDescuentoValor) || diasDescuentoValor < 0 ? 0 : diasDescuentoValor;
  const montoDescuentoDiasValor =
    formData.monto_descuento_dias === "" || formData.monto_descuento_dias === null
      ? null
      : Number(formData.monto_descuento_dias);
  const montoDescuentoDiasAplicado =
    montoDescuentoDiasValor === null || Number.isNaN(montoDescuentoDiasValor) || montoDescuentoDiasValor < 0
      ? null
      : montoDescuentoDiasValor;
  const salarioDiarioReferencia =
    tipoPago === "Diario" ? salarioBaseReferencia : salarioBaseReferencia / 15;
  const salarioBasePeriodo =
    tipoPago === "Diario"
      ? salarioDiarioReferencia * diasTrabajadosAplicados
      : salarioBaseReferencia;
  let deduccionDiasCalculada = 0;
  if (tipoPago === "Quincenal") {
    if (montoDescuentoDiasAplicado !== null) {
      deduccionDiasCalculada = montoDescuentoDiasAplicado;
    } else {
      deduccionDiasCalculada = salarioDiarioReferencia * diasDescuentoAplicados;
    }
  }
  deduccionDiasCalculada = Math.max(
    0,
    Math.min(deduccionDiasCalculada, Math.max(salarioBasePeriodo, 0))
  );
  const horasReferencia = tipoPago === "Diario" ? 8 : 8 * 15;
  const valorHora = horasReferencia > 0 ? salarioBaseReferencia / horasReferencia : 0;
  const montoHorasExtras = horasExtras * valorHora;
  const salarioBrutoEstimado = salarioBasePeriodo + bonificaciones + montoHorasExtras;
  const usaDeduccionFija = Boolean(Number(selectedEmpleado?.usa_deduccion_fija));
  const porcentajeCCSS = Number(selectedEmpleado?.porcentaje_ccss);
  const deduccionFija = Number(selectedEmpleado?.deduccion_fija);
  const porcentajeAplicable = Number.isNaN(porcentajeCCSS) ? 0 : porcentajeCCSS;
  const deduccionFijaAplicable = Number.isNaN(deduccionFija) ? 0 : deduccionFija;
  const deduccionesManualesAplicables =
    Number.isNaN(deduccionesManualInput) || deduccionesManualInput < 0
      ? 0
      : deduccionesManualInput;
  const deduccionesPrestamos = Number(totalPrestamosSeleccionados || 0);
  const salarioBaseParaCCSS = Math.max(salarioBrutoEstimado - deduccionDiasCalculada, 0);
  const ccssDeduccionEstimado = usaDeduccionFija
    ? deduccionFijaAplicable
    : salarioBaseParaCCSS * (porcentajeAplicable / 100);
  const deduccionDiasResumen = tipoPago === "Quincenal" ? deduccionDiasCalculada : 0;
  const totalDeduccionesEstimado =
    deduccionesManualesAplicables + deduccionesPrestamos + deduccionDiasResumen + ccssDeduccionEstimado;
  const pagoNetoEstimado = salarioBrutoEstimado - totalDeduccionesEstimado;

  useEffect(() => {
    if (!modalOpen || isEditing) return;
    setWizardSearch("");
  }, [modalOpen, isEditing]);

  useEffect(() => {
    if (!modalOpen || isEditing || empleados.length === 0) return;

    const indexActual = empleados.findIndex((emp) => String(emp.id_empleado) === formData.id_empleado);
    if (indexActual === -1) {
      setActiveEmpleadoIndex(0);
      selectEmpleado(empleados[0].id_empleado);
    } else {
      setActiveEmpleadoIndex(indexActual);
    }
  }, [modalOpen, isEditing, empleados, formData.id_empleado, selectEmpleado]);

  const handleCambiarEmpleado = (nuevoEmpleado) => {
    if (!nuevoEmpleado) return;
    selectEmpleado(nuevoEmpleado.id_empleado);
  };

  const handleNavegarEmpleado = (step) => {
    if (empleados.length === 0) return;
    const nextIndex = (activeEmpleadoIndex + step + empleados.length) % empleados.length;
    setActiveEmpleadoIndex(nextIndex);
    const empleadoDestino = empleados[nextIndex];
    handleCambiarEmpleado(empleadoDestino);
  };

  const obtenerCuotaSugerida = (prestamo) => {
    const saldo = Math.max(Number(prestamo?.saldo) || 0, 0);
    const cuotas = Math.max(Number(prestamo?.cuotas) || 1, 1);
    const monto = Math.max(Number(prestamo?.monto) || saldo, saldo);
    const cuota = monto / cuotas;
    if (!Number.isFinite(cuota) || cuota <= 0) return saldo;
    return Math.min(Number(cuota.toFixed(2)), saldo);
  };

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

          {detalleSeleccionado.id && (
            <div className="fixed inset-0 z-40 flex items-center justify-end bg-black/30 px-4 py-6">
              <div className="flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b px-6 py-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800">
                      Detalle planilla #{detalleSeleccionado.id}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {detalleSeleccionadoResumen.dias} días · {detalleSeleccionadoResumen.asistencias} asistencias efectivas · Total estimado {formatCurrency(detalleSeleccionadoResumen.total)}
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" type="button" onClick={closeDetallePlanilla}>
                    Cerrar
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                  {detalleSeleccionado.loading ? (
                    <p className="text-sm text-gray-500">Cargando detalle de la planilla...</p>
                  ) : detalleSeleccionado.error ? (
                    <p className="text-sm text-red-600">{detalleSeleccionado.error}</p>
                  ) : detalleSeleccionado.dias.length === 0 ? (
                    <p className="text-sm text-gray-500">Esta planilla no tiene un detalle diario asociado.</p>
                  ) : (
                    <>
                      <div className="overflow-x-auto rounded-xl border border-gray-100">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                          <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                            <tr>
                              <th className="px-4 py-3 text-left">Fecha</th>
                              <th className="px-4 py-3 text-left">Día</th>
                              <th className="px-4 py-3 text-center">Asistencia</th>
                              <th className="px-4 py-3 text-center">Tipo</th>
                              <th className="px-4 py-3 text-right">Salario día</th>
                              <th className="px-4 py-3 text-left">Observación</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 bg-white">
                            {detalleSeleccionado.dias.map((detalle) => (
                              <tr key={detalle.id_detalle} className="hover:bg-gray-50/70">
                                <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(detalle.fecha)}</td>
                                <td className="px-4 py-3 capitalize text-gray-600">{detalle.dia_semana}</td>
                                <td className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                                  {detalle.asistio ? "Asistió" : "Faltó"}
                                </td>
                                <td className="px-4 py-3 text-center text-sm text-gray-600">
                                  {detalle.es_dia_doble ? "Día doble" : "Normal"}
                                </td>
                                <td className="px-4 py-3 text-right font-semibold text-gray-800">
                                  {formatCurrency(detalle.salario_dia)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-600">
                                  {detalle.observacion ? detalle.observacion : "-"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                          <p className="text-xs uppercase tracking-wide text-gray-500">Días registrados</p>
                          <p className="mt-1 text-lg font-semibold text-gray-800">{detalleSeleccionadoResumen.dias}</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                          <p className="text-xs uppercase tracking-wide text-gray-500">Asistencias pagadas</p>
                          <p className="mt-1 text-lg font-semibold text-gray-800">{detalleSeleccionadoResumen.asistencias}</p>
                        </div>
                        <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
                          <p className="text-xs uppercase tracking-wide text-gray-500">Total acumulado</p>
                          <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(detalleSeleccionadoResumen.total)}</p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
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
                      <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Otras deducciones</th>
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
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => loadDetallePlanilla(planilla.id_planilla)}
                            >
                              Ver detalle
                            </Button>
                            <Button variant="warning" size="sm" onClick={() => handleEdit(planilla)}>
                              Editar
                            </Button>
                          </div>
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
            <>
              <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-6">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden">
                  <div className="flex items-center justify-between border-b px-6 py-4">
                    <h2 className="text-xl font-semibold text-gray-800">
                      {editingPlanilla ? "Actualizar planilla" : "Generar planilla"}
                    </h2>
                    <Button variant="secondary" size="sm" type="button" onClick={closeModal}>
                    Cerrar
                  </Button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex-1 overflow-hidden bg-gray-50">
                    <div
                      ref={modalScrollRef}
                      className="h-full overflow-y-auto px-8 py-6 space-y-6"
                    >
                      {error && (
                        <p className="text-red-500 text-sm bg-red-100 border border-red-200 px-4 py-2 rounded-lg">
                          {error}
                        </p>
                      )}

                      <div className="flex flex-col gap-6 lg:flex-row">
                        <aside className="space-y-6 lg:w-72 flex-shrink-0">
                          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              <button
                                type="button"
                                onClick={() => handleNavegarEmpleado(-1)}
                                disabled={isEditing || empleados.length === 0}
                                className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Anterior
                              </button>
                              <div className="flex-1 text-center">
                                <p className="text-xs uppercase tracking-wide text-gray-400">Colaborador</p>
                                <p className="text-sm font-semibold text-gray-800">
                                  {selectedEmpleado
                                    ? `${selectedEmpleado.nombre} ${selectedEmpleado.apellido}`
                                    : "Selecciona un colaborador"}
                                </p>
                                {!isEditing && empleados.length > 0 && (
                                  <p className="text-xs text-gray-500">
                                    {activeEmpleadoIndex + 1} de {empleados.length}
                                  </p>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleNavegarEmpleado(1)}
                                disabled={isEditing || empleados.length === 0}
                                className="rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                Siguiente
                              </button>
                            </div>

                            {!isEditing && (
                              <>
                                <div className="space-y-2">
                                  <label className="text-xs font-semibold text-gray-500" htmlFor="buscador-empleado">
                                    Buscar colaborador
                                  </label>
                                  <input
                                    id="buscador-empleado"
                                    type="text"
                                    placeholder="Nombre o ID"
                                    value={wizardSearch}
                                    onChange={(event) => setWizardSearch(event.target.value)}
                                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                                  />
                                </div>
                                <div className="max-h-56 overflow-y-auto pr-1 space-y-2">
                                  {empleadosFiltrados.length === 0 ? (
                                    <p className="text-sm text-gray-500">
                                      No hay colaboradores que coincidan con la búsqueda.
                                    </p>
                                  ) : (
                                    empleadosFiltrados.map((empleado) => {
                                      const esActivo = formData.id_empleado === String(empleado.id_empleado);
                                      const indiceGlobal = empleados.findIndex(
                                        (item) => item.id_empleado === empleado.id_empleado
                                      );
                                      return (
                                        <button
                                          key={empleado.id_empleado}
                                          type="button"
                                          onClick={() => {
                                            setActiveEmpleadoIndex(indiceGlobal === -1 ? 0 : indiceGlobal);
                                            handleCambiarEmpleado(empleado);
                                          }}
                                          className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                                            esActivo
                                              ? "border-blue-400 bg-blue-50 text-blue-700"
                                              : "border-gray-200 bg-white text-gray-600 hover:border-blue-300 hover:bg-blue-50"
                                          }`}
                                        >
                                          <p className="font-semibold">
                                            {empleado.nombre} {empleado.apellido}
                                          </p>
                                          <p className="text-xs text-gray-500">
                                            #{empleado.id_empleado} · {empleado.tipo_pago || "Sin tipo"}
                                          </p>
                                        </button>
                                      );
                                    })
                                  )}
                                </div>
                              </>
                            )}
                          </div>

                          <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm space-y-3">
                            <h3 className="text-sm font-semibold text-gray-800">Resumen del colaborador</h3>
                            {selectedEmpleado ? (
                              <div className="space-y-2 text-sm text-gray-600">
                                <p>
                                  <span className="font-semibold text-gray-700">Identificación:</span>{" "}
                                  {selectedEmpleado.cedula || selectedEmpleado.id_empleado}
                                </p>
                                <p>
                                  <span className="font-semibold text-gray-700">Tipo de pago:</span>{" "}
                                  {tipoPago}
                                </p>
                                <p>
                                  <span className="font-semibold text-gray-700">Salario base referencia:</span>{" "}
                                  {formatCurrency(salarioBaseReferencia)}
                                </p>
                                <p>
                                  <span className="font-semibold text-gray-700">Días en periodo:</span>{" "}
                                  {detalleDiasResumen.diasPeriodo}
                                </p>
                                <p>
                                  <span className="font-semibold text-gray-700">Días estimados a pagar:</span>{" "}
                                  {detalleDiasResumen.diasAsistidos}
                                </p>
                                <p>
                                  <span className="font-semibold text-gray-700">Monto días estimado:</span>{" "}
                                  {formatCurrency(detalleDiasResumen.salarioTotal)}
                                </p>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">
                                Selecciona un colaborador para ver su información de referencia.
                              </p>
                            )}
                          </div>
                        </aside>

                        <div className="flex-1 min-w-0 space-y-6">
                          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm lg:max-h-[60vh] lg:overflow-y-auto">
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-4">
                              <h3 className="text-base font-semibold text-gray-800">Datos del periodo</h3>
                              <div className="flex items-center gap-2">
                                {detalleDias.length > 0 && (
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    className="px-3 py-1 text-xs"
                                    onClick={() => setDetalleOverlayOpen(true)}
                                  >
                                    Abrir detalle en pantalla completa
                                  </Button>
                                )}
                                {isEditing && (
                                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600">
                                    Edición
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 lg:pr-1">
                              {isEditing ? (
                                <div className="flex flex-col gap-2 md:col-span-2 xl:col-span-3">
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
                              ) : (
                                <>
                                  <input type="hidden" name="id_empleado" value={formData.id_empleado} />
                                  <div className="md:col-span-2 xl:col-span-3">
                                    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                                      {selectedEmpleado ? (
                                        <p>
                                          <span className="font-semibold">{selectedEmpleado.nombre} {selectedEmpleado.apellido}</span>
                                          {" · ID "}
                                          {selectedEmpleado.id_empleado}
                                        </p>
                                      ) : (
                                        <p>Selecciona un colaborador desde la barra lateral.</p>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}

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
                                  Deducciones adicionales
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

                            {!isEditing && selectedEmpleado?.tipo_pago === "Diario" && (
                              <div className="mt-4 space-y-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <label htmlFor="dias_trabajados" className="text-sm font-medium text-blue-900">
                                    Días trabajados en el periodo
                                  </label>
                                  <button
                                    type="button"
                                    onClick={refreshAttendance}
                                    disabled={attendanceState.loading}
                                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed disabled:text-blue-300"
                                  >
                                    {attendanceState.loading ? "Consultando…" : "Actualizar asistencia"}
                                  </button>
                                </div>
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    id="dias_trabajados"
                                    name="dias_trabajados"
                                    value={formData.dias_trabajados}
                                    onChange={handleChange}
                                    className="w-full sm:w-48 rounded-lg border border-blue-200 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                                  />
                                  <div className="flex-1 text-xs text-gray-600">
                                    {attendanceState.error ? (
                                      <span className="text-red-600">{attendanceState.error}</span>
                                    ) : attendanceState.loading ? (
                                      "Consultando asistencia…"
                                    ) : attendanceState.dias !== null ? (
                                      <>Se detectaron {attendanceState.dias} días marcados en asistencia.</>
                                    ) : (
                                      "Ingresa los días trabajados o sincroniza la asistencia para precargarlos."
                                    )}
                                  </div>
                                </div>
                                <p className="text-xs text-gray-600">
                                  Ajusta el valor si necesitas reconocer medios días o ausencias no registradas.
                                </p>
                              </div>
                            )}

                            {!isEditing && selectedEmpleado?.tipo_pago === "Quincenal" && (
                              <div className="mt-4 grid gap-4 rounded-2xl border border-gray-100 bg-gray-50/80 p-4 md:grid-cols-2">
                                <div className="flex flex-col gap-2">
                                  <label htmlFor="dias_descuento" className="text-sm font-medium text-gray-700">
                                    Días a descontar
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    id="dias_descuento"
                                    name="dias_descuento"
                                    value={formData.dias_descuento}
                                    onChange={handleChange}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                                  />
                                </div>
                                <div className="flex flex-col gap-2">
                                  <label htmlFor="monto_descuento_dias" className="text-sm font-medium text-gray-700">
                                    Monto por días descontados
                                  </label>
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    id="monto_descuento_dias"
                                    name="monto_descuento_dias"
                                    value={formData.monto_descuento_dias}
                                    onChange={handleChange}
                                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500"
                                  />
                                  <p className="text-xs text-gray-500">
                                    El monto se recalcula según los días indicados, pero puedes ajustarlo para reflejar medios días u otros acuerdos.
                                  </p>
                                </div>
                              </div>
                            )}

                            {!isEditing && (
                              <div className="mt-4 space-y-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <h3 className="text-sm font-semibold text-gray-700">Préstamos asociados a la planilla</h3>
                                  {deduccionesPrestamos > 0 && (
                                    <span className="text-xs font-semibold text-blue-600">
                                      Total seleccionado: {formatCurrency(deduccionesPrestamos)}
                                    </span>
                                  )}
                                </div>

                                {prestamosEmpleado.length === 0 ? (
                                  <p className="text-sm text-gray-500">
                                    Este colaborador no tiene préstamos aprobados con saldo pendiente.
                                  </p>
                                ) : (
                                  <div className="space-y-3">
                                    {prestamosEmpleado.map((prestamo) => {
                                      const seleccion = prestamoSelections[prestamo.id_prestamo];
                                      const estaSeleccionado = Boolean(seleccion?.aplicar);
                                      const cuotaSugerida = obtenerCuotaSugerida(prestamo);
                                      const montoSeleccionado = estaSeleccionado
                                        ? seleccion?.monto ?? cuotaSugerida
                                        : cuotaSugerida;

                                      return (
                                        <div
                                          key={prestamo.id_prestamo}
                                          className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
                                        >
                                          <div className="flex items-start gap-3">
                                            <input
                                              type="checkbox"
                                              checked={estaSeleccionado}
                                              onChange={() => togglePrestamo(prestamo.id_prestamo)}
                                              className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <div className="flex-1 space-y-3">
                                              <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                  <p className="text-sm font-semibold text-gray-800">
                                                    Préstamo #{prestamo.id_prestamo}
                                                  </p>
                                                  <p className="text-xs text-gray-500">
                                                    Solicitado el {formatDate(prestamo.fecha_solicitud)} · {prestamo.cuotas} cuotas
                                                  </p>
                                                </div>
                                                <div className="text-right">
                                                  <p className="text-xs text-gray-500">Saldo pendiente</p>
                                                  <p className="text-sm font-semibold text-gray-800">
                                                    {formatCurrency(prestamo.saldo)}
                                                  </p>
                                                </div>
                                              </div>

                                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <p className="text-xs text-gray-500">
                                                  Cuota sugerida: {formatCurrency(cuotaSugerida)}
                                                </p>
                                                <div className="flex items-center gap-2">
                                                  <label className="text-xs text-gray-500" htmlFor={`prestamo-${prestamo.id_prestamo}`}>
                                                    Monto a descontar
                                                  </label>
                                                  <input
                                                    id={`prestamo-${prestamo.id_prestamo}`}
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={Number(montoSeleccionado || 0).toString()}
                                                    onChange={(event) =>
                                                      updateMontoPrestamo(prestamo.id_prestamo, event.target.value)
                                                    }
                                                    disabled={!estaSeleccionado}
                                                    className="w-32 rounded-lg border border-gray-300 px-3 py-1 text-sm text-gray-700 focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })}

                                    <p className="text-xs text-gray-500">
                                      Los montos seleccionados se sumarán automáticamente a las deducciones de esta planilla.
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <h3 className="text-base font-semibold text-gray-800">Detalle diario del periodo</h3>
                              <DetalleResumenBadges />
                            </div>

                            <DetalleTable className="mt-4" />
                          </div>

                          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                            <h3 className="text-base font-semibold text-gray-800">Resumen económico estimado</h3>
                            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Salario base del periodo</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(salarioBasePeriodo)}</p>
                              </div>
                              {tipoPago === "Diario" && (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Días pagados</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800">{diasTrabajadosAplicados}</p>
                                </div>
                              )}
                              {tipoPago === "Quincenal" && (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Días a descontar</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800">{diasDescuentoAplicados}</p>
                                </div>
                              )}
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Monto horas extras</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(montoHorasExtras)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Bonificaciones</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(bonificaciones)}</p>
                              </div>
                              {tipoPago === "Quincenal" && (
                                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                  <p className="text-xs uppercase tracking-wide text-gray-500">Deducción por días</p>
                                  <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(deduccionDiasResumen)}</p>
                                </div>
                              )}
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">CCSS estimado</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(ccssDeduccionEstimado)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Deducciones adicionales</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(deduccionesManualesAplicables)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Deducciones por préstamos</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(deduccionesPrestamos)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Total deducciones</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(totalDeduccionesEstimado)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Salario bruto estimado</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(salarioBrutoEstimado)}</p>
                              </div>
                              <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                                <p className="text-xs uppercase tracking-wide text-gray-500">Pago neto estimado</p>
                                <p className="mt-1 text-lg font-semibold text-gray-800">{formatCurrency(pagoNetoEstimado)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-white px-8 pb-6 pt-4">
                    <Button variant="secondary" size="sm" type="button" onClick={closeModal}>
                      Cancelar
                    </Button>
                    <Button variant="primary" size="sm" type="submit">
                      {editingPlanilla ? "Actualizar" : "Generar planilla"}
                    </Button>
                  </div>
                </form>
              </div>
            </div>

              {detalleOverlayOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4 py-6">
                  <div className="absolute inset-0" onClick={() => setDetalleOverlayOpen(false)} />
                  <div
                    role="dialog"
                    aria-modal="true"
                    aria-label="Detalle diario del periodo"
                    className="relative z-10 flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b px-6 py-4">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-gray-800">Detalle diario del periodo</h3>
                        <p className="text-sm text-gray-500">
                          Actualiza asistencias, marca días dobles y ajusta los montos directamente en esta vista ampliada.
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <DetalleResumenBadges className="text-sm" />
                        <Button variant="secondary" size="sm" type="button" onClick={() => setDetalleOverlayOpen(false)}>
                          Cerrar
                        </Button>
                      </div>
                    </div>
                    <div
                      ref={detalleOverlayFocusRef}
                      tabIndex={-1}
                      className="flex-1 overflow-y-auto px-6 py-6 focus:outline-none"
                    >
                      <DetalleTable className={detalleDias.length === 0 ? "" : "mt-2"} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Planilla;
