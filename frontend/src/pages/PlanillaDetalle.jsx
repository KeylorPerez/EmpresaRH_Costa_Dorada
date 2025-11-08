import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import planillaService from "../services/planillaService";

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

const PlanillaDetalle = () => {
  const { user, logoutUser } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const planillaId = Number(id);
  const [idError, setIdError] = useState("");
  const [detalle, setDetalle] = useState([]);
  const [detalleLoading, setDetalleLoading] = useState(true);
  const [detalleError, setDetalleError] = useState("");
  const [planillaInfo, setPlanillaInfo] = useState(() => location.state?.planilla ?? null);
  const [planillaInfoLoading, setPlanillaInfoLoading] = useState(() => !location.state?.planilla);
  const [planillaInfoError, setPlanillaInfoError] = useState("");

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

  useEffect(() => {
    if (Number.isNaN(planillaId)) {
      setIdError("Identificador de planilla inválido.");
      setDetalleLoading(false);
      setPlanillaInfoLoading(false);
      return;
    }

    let cancelled = false;

    const fetchDetalle = async () => {
      setDetalleLoading(true);
      setDetalleError("");
      try {
        const data = await planillaService.getDetalle(planillaId);
        if (cancelled) return;
        const dias = Array.isArray(data)
          ? data.map((item) => ({
              ...item,
              asistio: Boolean(item.asistio),
              es_dia_doble: Boolean(item.es_dia_doble),
            }))
          : [];
        setDetalle(dias);
      } catch (err) {
        if (cancelled) return;
        const message =
          err.response?.data?.error || err.message || "Error al cargar el detalle de la planilla.";
        setDetalleError(message);
        setDetalle([]);
      } finally {
        if (!cancelled) {
          setDetalleLoading(false);
        }
      }
    };

    fetchDetalle();

    return () => {
      cancelled = true;
    };
  }, [planillaId]);

  useEffect(() => {
    if (Number.isNaN(planillaId)) {
      setPlanillaInfoLoading(false);
      return;
    }

    if (planillaInfo) {
      setPlanillaInfoLoading(false);
      return;
    }

    let cancelled = false;

    const fetchPlanillaInfo = async () => {
      setPlanillaInfoLoading(true);
      setPlanillaInfoError("");
      try {
        const data = await planillaService.getAll();
        if (cancelled) return;
        const lista = Array.isArray(data) ? data : [];
        const encontrada = lista.find((item) => Number(item.id_planilla) === planillaId) || null;
        if (!encontrada) {
          setPlanillaInfoError("No se encontró la planilla solicitada.");
        }
        setPlanillaInfo(encontrada);
      } catch (err) {
        if (cancelled) return;
        const message =
          err.response?.data?.error || err.message || "Error al cargar la información de la planilla.";
        setPlanillaInfoError(message);
        setPlanillaInfo(null);
      } finally {
        if (!cancelled) {
          setPlanillaInfoLoading(false);
        }
      }
    };

    fetchPlanillaInfo();

    return () => {
      cancelled = true;
    };
  }, [planillaId, planillaInfo]);

  const detalleResumen = useMemo(() => {
    if (!detalle || detalle.length === 0) {
      return { dias: 0, asistencias: 0, total: 0 };
    }

    return detalle.reduce(
      (acumulado, item) => {
        const salario = Number(item.salario_dia) || 0;
        const factor = item.es_dia_doble ? 2 : 1;
        if (item.asistio) {
          acumulado.asistencias += factor;
          acumulado.total += salario * factor;
        }
        acumulado.dias += 1;
        return acumulado;
      },
      { dias: 0, asistencias: 0, total: 0 }
    );
  }, [detalle]);

  const planillaMetricas = useMemo(() => {
    if (!planillaInfo) {
      return null;
    }

    const salarioBase = Number(planillaInfo.salario_monto) || 0;
    const horasExtras = Number(planillaInfo.horas_extras) || 0;
    const bonificaciones = Number(planillaInfo.bonificaciones) || 0;
    const deducciones = Number(planillaInfo.deducciones) || 0;
    const ccss = Number(planillaInfo.ccss_deduccion) || 0;
    const salarioBruto = Number(planillaInfo.salario_bruto) || 0;
    const pagoNeto = Number(planillaInfo.pago_neto) || 0;

    return {
      salarioBase,
      horasExtras,
      bonificaciones,
      deducciones,
      ccss,
      totalDeducciones: deducciones + ccss,
      salarioBruto,
      pagoNeto,
    };
  }, [planillaInfo]);

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

        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">
                Detalle planilla #{Number.isNaN(planillaId) ? "-" : planillaId}
              </h1>
              <p className="text-sm text-gray-500">
                Consulta el resumen diario y los montos calculados para el colaborador seleccionado.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => navigate("/admin/planilla")}>
                Volver a planilla
              </Button>
            </div>
          </div>

          {idError && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {idError}
            </div>
          )}

          {!idError && planillaInfoLoading && (
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-4 text-sm text-gray-500">
              Cargando información de la planilla...
            </div>
          )}

          {!idError && !planillaInfoLoading && planillaInfoError && (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-700">
              {planillaInfoError}
            </div>
          )}

          {!idError && !planillaInfoLoading && planillaInfo && (
            <>
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <article className="rounded-xl bg-white p-4 shadow">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Colaborador</p>
                  <p className="mt-1 text-lg font-semibold text-gray-800">
                    {planillaInfo.nombre
                      ? `${planillaInfo.nombre} ${planillaInfo.apellido}`
                      : `ID ${planillaInfo.id_empleado}`}
                  </p>
                  <p className="text-xs text-gray-500">ID empleado: {planillaInfo.id_empleado}</p>
                </article>
                <article className="rounded-xl bg-white p-4 shadow">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Periodo</p>
                  <p className="mt-1 text-lg font-semibold text-gray-800">
                    {formatPeriodo(planillaInfo.periodo_inicio, planillaInfo.periodo_fin)}
                  </p>
                  <p className="text-xs text-gray-500">
                    Fecha de pago: {planillaInfo.fecha_pago ? formatDate(planillaInfo.fecha_pago) : "Pendiente"}
                  </p>
                </article>
                <article className="rounded-xl bg-white p-4 shadow">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Tipo de pago</p>
                  <p className="mt-1 text-lg font-semibold text-gray-800">
                    {planillaInfo.tipo_pago || "No especificado"}
                  </p>
                  <p className="text-xs text-gray-500">
                    Salario referencia: {formatCurrency(planillaMetricas?.salarioBase)}
                  </p>
                </article>
                <article className="rounded-xl bg-white p-4 shadow">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Resumen de asistencias</p>
                  <p className="mt-1 text-lg font-semibold text-gray-800">
                    {detalleResumen.dias} días · {detalleResumen.asistencias} asistencias efectivas
                  </p>
                  <p className="text-xs text-gray-500">
                    Total estimado: {formatCurrency(detalleResumen.total)}
                  </p>
                </article>
              </section>

              {planillaMetricas && (
                <section className="grid gap-4 md:grid-cols-3">
                  <article className="rounded-xl bg-white p-4 shadow">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Ingresos</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>Salario base: {formatCurrency(planillaMetricas.salarioBase)}</p>
                      <p>Horas extras: {formatCurrency(planillaMetricas.horasExtras)}</p>
                      <p>Bonificaciones: {formatCurrency(planillaMetricas.bonificaciones)}</p>
                      <p className="font-semibold text-gray-800">
                        Salario bruto: {formatCurrency(planillaMetricas.salarioBruto)}
                      </p>
                    </div>
                  </article>
                  <article className="rounded-xl bg-white p-4 shadow">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Deducciones</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>CCSS: {formatCurrency(planillaMetricas.ccss)}</p>
                      <p>Otras deducciones: {formatCurrency(planillaMetricas.deducciones)}</p>
                      <p className="font-semibold text-gray-800">
                        Total deducciones: {formatCurrency(planillaMetricas.totalDeducciones)}
                      </p>
                    </div>
                  </article>
                  <article className="rounded-xl bg-white p-4 shadow">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Pago neto</p>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <p>Monto neto a pagar:</p>
                      <p className="text-2xl font-semibold text-gray-800">
                        {formatCurrency(planillaMetricas.pagoNeto)}
                      </p>
                    </div>
                  </article>
                </section>
              )}
            </>
          )}

          <section className="rounded-xl bg-white shadow">
            <header className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-800">Detalle diario</h2>
              <p className="text-sm text-gray-500">
                Cada fila corresponde a un día del periodo. Marca asistencias, días dobles y revisa observaciones.
              </p>
            </header>
            <div className="px-6 py-4">
              {detalleLoading ? (
                <p className="text-sm text-gray-500">Cargando detalle...</p>
              ) : detalleError ? (
                <p className="text-sm text-red-600">{detalleError}</p>
              ) : detalle.length === 0 ? (
                <p className="text-sm text-gray-500">Esta planilla no tiene detalles registrados.</p>
              ) : (
                <div className="rounded-lg border border-gray-200">
                  <div className="max-h-[65vh] overflow-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left">Fecha</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left">Día</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-center">Asistencia</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-center">Tipo</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-right">Salario día</th>
                          <th className="sticky top-0 z-10 bg-gray-50 px-4 py-3 text-left">Observación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {detalle.map((item) => (
                          <tr key={`${item.id_detalle}-${item.fecha}`} className="hover:bg-gray-50/70">
                            <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatDate(item.fecha)}</td>
                            <td className="px-4 py-3 capitalize text-gray-600">{item.dia_semana}</td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  item.asistio ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                                }`}
                              >
                                {item.asistio ? "Asistió" : "Faltó"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  item.es_dia_doble ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {item.es_dia_doble ? "Día doble" : "Normal"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-gray-800">
                              {formatCurrency(item.salario_dia)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">{item.observacion || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};

export default PlanillaDetalle;
