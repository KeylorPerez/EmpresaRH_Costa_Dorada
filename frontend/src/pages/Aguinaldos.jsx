import React, { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import {
  useAguinaldos,
  formatearMontoCRC,
  formatearFechaCorta,
} from "../hooks/useAguinaldos";

const estadoBadge = (pagado) => {
  const isPaid = Boolean(pagado);
  const classes = isPaid
    ? "bg-green-100 text-green-700"
    : "bg-yellow-100 text-yellow-700";
  const label = isPaid ? "Pagado" : "Pendiente";
  return (
    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
};

const formatearFechaLarga = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("es-CR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
};

const formatearFechaInput = (value) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseDateOnly = (value) => {
  if (!value) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [_, year, month, day] = match;
        return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      }
    }
  }

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
};

const Aguinaldos = ({ mode }) => {
  const isAdminView = mode === "admin";
  const { user, logoutUser } = useAuth();
  const {
    aguinaldos,
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
    markAsPaid,
    isAdmin,
    setError,
    setSuccessMessage,
    esCajeraSeleccionada,
    montosQuincenales,
    promedioQuincenalCalculado,
  } = useAguinaldos();

  const roleColor = isAdminView ? "blue" : "green";
  const tituloPagina = isAdminView ? "Gestión de Aguinaldos" : "Mis Aguinaldos";

  const [anioFiltro, setAnioFiltro] = useState("todos");

  const empleadoSeleccionado = useMemo(() => {
    const id = Number(formData.id_empleado);
    if (!Number.isInteger(id) || id <= 0) return null;
    return empleados.find((empleado) => Number(empleado.id_empleado) === id) || null;
  }, [empleados, formData.id_empleado]);

  const periodoCalculo = useMemo(() => {
    const anioNumero = Number(formData.anio);
    const anioValido = Number.isInteger(anioNumero) ? anioNumero : new Date().getFullYear();
    const inicioDefecto = new Date(anioValido - 1, 11, 1);
    inicioDefecto.setHours(0, 0, 0, 0);
    const finDefecto = new Date(anioValido, 10, 30);
    finDefecto.setHours(0, 0, 0, 0);
    const inicio = parseDateOnly(formData.fecha_inicio_periodo) || inicioDefecto;
    const fin = parseDateOnly(formData.fecha_fin_periodo) || finDefecto;
    const inicioTexto = formatearFechaLarga(inicio) || formatearFechaInput(inicio);
    const finTexto = formatearFechaLarga(fin) || formatearFechaInput(fin);
    return {
      inicio,
      fin,
      etiqueta: `${inicioTexto} al ${finTexto}`,
    };
  }, [formData.anio, formData.fecha_inicio_periodo, formData.fecha_fin_periodo]);

  const fechaCalculoHoy = useMemo(() => formatearFechaInput(new Date()), []);
  const fechaCalculoHoyTexto = useMemo(() => formatearFechaLarga(new Date()), []);

  const fechaIngresoAplicada = useMemo(() => {
    if (!formData.fecha_ingreso_manual) return null;
    const fecha = new Date(formData.fecha_ingreso_manual);
    if (Number.isNaN(fecha.getTime())) return null;
    return formatearFechaLarga(fecha);
  }, [formData.fecha_ingreso_manual]);

  const sidebarLinks = useMemo(() => {
    if (isAdminView) {
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
  }, [isAdminView]);

  const limpiarMensajes = () => {
    if (error) setError("");
    if (successMessage) setSuccessMessage("");
  };

  const listaAnios = useMemo(() => {
    const setYears = new Set();
    aguinaldos.forEach((item) => {
      if (item.anio !== null && item.anio !== undefined) {
        setYears.add(String(item.anio));
      }
    });
    return Array.from(setYears).sort((a, b) => Number(b) - Number(a));
  }, [aguinaldos]);

  const registrosFiltrados = useMemo(() => {
    if (anioFiltro === "todos") return aguinaldos;
    return aguinaldos.filter((item) => String(item.anio) === anioFiltro);
  }, [aguinaldos, anioFiltro]);

  const hayRegistros = registrosFiltrados.length > 0;

  const renderAcciones = (registro) => {
    if (!isAdminView || !isAdmin) return null;
    const id = registro.id_aguinaldo;
    if (!id) return null;
    const isProcessing = Boolean(actionLoading[id]);
    const pagado = Boolean(registro.pagado);

    return (
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={pagado ? "secondary" : "success"}
          disabled={isProcessing}
          onClick={async () => {
            try {
              await markAsPaid(id, !pagado);
            } catch {
              // el hook maneja el error
            }
          }}
        >
          {isProcessing ? "Actualizando..." : pagado ? "Marcar como pendiente" : "Marcar como pagado"}
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
                {isAdminView
                  ? "Calcula y gestiona los aguinaldos de los colaboradores en base a sus planillas registradas."
                  : "Consulta el estado de tus aguinaldos calculados por la empresa."}
              </p>
            </div>
            {loading && <span className="text-sm text-gray-500">Cargando información...</span>}
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

          {isAdminView && isAdmin && (
            <section className="bg-white rounded-xl shadow-sm p-6">
              <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Calcular aguinaldo</h2>
                  <p className="text-sm text-gray-500">
                    Selecciona al colaborador y el año a calcular. El sistema utiliza las planillas registradas del periodo.
                  </p>
                </div>
                <div className="text-sm text-gray-500">
                  {empleadosLoading ? "Cargando colaboradores..." : `${empleados.length} colaboradores disponibles`}
                </div>
              </header>

              <form className="grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Colaborador</label>
                  <select
                    name="id_empleado"
                    value={formData.id_empleado}
                    onChange={handleChange}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Selecciona una opción</option>
                    {empleados.map((empleado) => (
                      <option key={empleado.id_empleado} value={empleado.id_empleado}>
                        {empleado.nombre} {empleado.apellido} (ID #{empleado.id_empleado})
                      </option>
                    ))}
                  </select>
                  {empleadoSeleccionado && (
                    <p className="mt-1 text-xs text-gray-500">
                      Ingreso registrado: {formatearFechaLarga(empleadoSeleccionado.fecha_ingreso) || "Sin registro"}
                    </p>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Año</label>
                  <input
                    type="number"
                    name="anio"
                    value={formData.anio}
                    onChange={handleChange}
                    min="2000"
                    max="2100"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">
                      Inicio del periodo de cálculo
                    </label>
                    <input
                      type="date"
                      name="fecha_inicio_periodo"
                      value={formData.fecha_inicio_periodo || ""}
                      onChange={handleChange}
                      max={formData.fecha_fin_periodo || undefined}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Corresponde al primer día considerado para el cálculo del aguinaldo.
                    </p>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-gray-700 mb-1">
                      Fin del periodo de cálculo
                    </label>
                    <input
                      type="date"
                      name="fecha_fin_periodo"
                      value={formData.fecha_fin_periodo || ""}
                      onChange={handleChange}
                      min={formData.fecha_inicio_periodo || undefined}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Debe ser el último día del periodo a evaluar. No puede ser anterior a la fecha de inicio.
                    </p>
                  </div>
                </div>

                <div className="md:col-span-2 flex flex-col">
                  <label className="text-sm font-medium text-gray-700 mb-1">Observación</label>
                  <textarea
                    name="observacion"
                    value={formData.observacion || ""}
                    onChange={handleChange}
                    rows={2}
                    maxLength={200}
                    placeholder="Comentarios adicionales sobre el cálculo (opcional)"
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Máximo 200 caracteres. Esta nota se guardará junto al registro del aguinaldo.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <fieldset className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <legend className="px-2 text-sm font-semibold text-gray-700">Método de cálculo</legend>
                    <div className="flex flex-col md:flex-row md:items-center gap-3 mt-2">
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="metodo"
                          value="manual"
                          checked={formData.metodo === "manual"}
                          onChange={handleChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span>Manual</span>
                      </label>
                      <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="radio"
                          name="metodo"
                          value="automatico"
                          checked={formData.metodo === "automatico"}
                          onChange={handleChange}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                        />
                        <span>Automático</span>
                      </label>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">
                      El periodo considerado es del {periodoCalculo.etiqueta}.
                    </p>
                  </fieldset>
                </div>

                {formData.metodo === "manual" && (
                  <>
                    {esCajeraSeleccionada && (
                      <div className="md:col-span-2 flex flex-col gap-2">
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-gray-700 mb-1">
                            Montos quincenales registrados
                          </label>
                          <textarea
                            name="salarios_quincenales"
                            value={formData.salarios_quincenales}
                            onChange={handleChange}
                            rows={4}
                            placeholder="Ejemplo: 350000, 362500, 348750"
                            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            Ingresa cada pago quincenal conocido separado por comas, punto y coma o saltos de línea.
                            Calcularemos el promedio automáticamente para el salario quincenal.
                          </p>
                          {promedioQuincenalCalculado !== null && (
                            <p className="mt-2 text-xs font-medium text-blue-700">
                              Promedio utilizado: {formatearMontoCRC(promedioQuincenalCalculado)}
                              {montosQuincenales.length > 0 &&
                                ` (a partir de ${montosQuincenales.length} registro${
                                  montosQuincenales.length === 1 ? "" : "s"
                                })`}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="md:col-span-2 grid gap-4 md:grid-cols-2">
                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1">
                          Fecha de cálculo
                        </label>
                        <input
                          type="date"
                          value={fechaCalculoHoy}
                          readOnly
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-600 cursor-not-allowed"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Se registra automáticamente la fecha del cálculo ({fechaCalculoHoyTexto}).
                        </p>
                        {fechaIngresoAplicada && (
                          <p className="mt-2 text-xs font-medium text-blue-700">
                            Fecha de ingreso del colaborador considerada: {fechaIngresoAplicada}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-gray-700 mb-1">
                          Salario quincenal fijo (CRC)
                        </label>
                        <input
                          type="number"
                          name="salario_quincenal"
                          value={formData.salario_quincenal}
                          onChange={handleChange}
                          min="0"
                          step="0.01"
                          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Se usa como base para proyectar el aguinaldo del periodo.
                        </p>
                      </div>
                    </div>

                    <div className="md:col-span-2 bg-blue-50 border border-blue-100 rounded-lg p-4 text-xs text-blue-700">
                      El cálculo manual estima el aguinaldo según el tiempo laborado en el periodo y el salario quincenal fijo seleccionado.
                    </div>
                  </>
                )}

                {formData.metodo === "automatico" && (
                  <div className="md:col-span-2 grid gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-gray-700">Opciones del cálculo automático</p>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="incluir_bonificaciones"
                        checked={Boolean(formData.incluir_bonificaciones)}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      Incluir bonificaciones del periodo
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                      <input
                        type="checkbox"
                        name="incluir_horas_extra"
                        checked={Boolean(formData.incluir_horas_extra)}
                        onChange={handleChange}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                      />
                      Incluir horas extra registradas
                    </label>
                    <p className="text-xs text-gray-500">
                      Si no se incluyen las bonificaciones u horas extra, el cálculo usará únicamente el salario base registrado en las planillas.
                    </p>
                  </div>
                )}

                <div className="col-span-full flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => resetForm(formData.anio)}
                    disabled={submitting}
                  >
                    Limpiar
                  </Button>
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {submitting ? "Calculando..." : "Calcular aguinaldo"}
                  </Button>
                </div>
              </form>
            </section>
          )}

          <section className="bg-white rounded-xl shadow-sm p-6">
            <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800">Registros generados</h2>
                <p className="text-sm text-gray-500">
                  Consulta el detalle del cálculo y su estado de pago.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600" htmlFor="filtro-anio">
                  Filtrar por año:
                </label>
                <select
                  id="filtro-anio"
                  value={anioFiltro}
                  onChange={(event) => setAnioFiltro(event.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todos">Todos</option>
                  {listaAnios.map((anio) => (
                    <option key={anio} value={anio}>
                      {anio}
                    </option>
                  ))}
                </select>
              </div>
            </header>

            {!hayRegistros && !loading ? (
              <p className="text-sm text-gray-500">
                {anioFiltro === "todos"
                  ? "Aún no se han calculado aguinaldos."
                  : "No hay aguinaldos registrados para el año seleccionado."}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wide">
                    <tr>
                      <th className="px-4 py-3 text-left">Año</th>
                      {isAdminView && <th className="px-4 py-3 text-left">Colaborador</th>}
                      <th className="px-4 py-3 text-left">Salario promedio</th>
                      <th className="px-4 py-3 text-left">Monto aguinaldo</th>
                      <th className="px-4 py-3 text-left">Periodo</th>
                      <th className="px-4 py-3 text-left">Fecha cálculo</th>
                      <th className="px-4 py-3 text-left">Observación</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      {isAdminView && <th className="px-4 py-3 text-left">Acciones</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {registrosFiltrados.map((registro) => (
                      <tr
                        key={registro.id_aguinaldo}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-gray-800 font-semibold">{registro.anio}</td>
                        {isAdminView && (
                          <td className="px-4 py-3 text-gray-700">
                            <p className="font-semibold">
                              {registro.nombre || "Empleado"} {registro.apellido || ""}
                            </p>
                            <p className="text-xs text-gray-500">ID #{registro.id_empleado}</p>
                          </td>
                        )}
                        <td className="px-4 py-3 text-gray-700">
                          {formatearMontoCRC(registro.salario_promedio)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {formatearMontoCRC(registro.monto_aguinaldo)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {registro.fecha_inicio_periodo || registro.fecha_fin_periodo
                            ? `${formatearFechaCorta(registro.fecha_inicio_periodo)} al ${formatearFechaCorta(
                                registro.fecha_fin_periodo
                              )}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {formatearFechaCorta(registro.fecha_calculo)}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {registro.observacion ? (
                            <span>{registro.observacion}</span>
                          ) : (
                            <span className="text-gray-400">Sin observación</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{estadoBadge(registro.pagado)}</td>
                        {isAdminView && <td className="px-4 py-3">{renderAcciones(registro)}</td>}
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

Aguinaldos.propTypes = {
  mode: PropTypes.oneOf(["admin", "empleado"]),
};

Aguinaldos.defaultProps = {
  mode: "empleado",
};

export default Aguinaldos;
