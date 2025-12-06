import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowRightLong, FaFileInvoiceDollar } from "react-icons/fa6";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { useAuth } from "../hooks/useAuth";
import planillaService from "../services/planillaService";
import { empleadoLinks } from "../utils/navigationLinks";

const currencyFormatter = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  currencyDisplay: "narrowSymbol",
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

const normalizarTipoPago = (valor) => (valor ?? "").toString().trim().toLowerCase();

const formatearTipoPago = (valor, { etiquetaPorDefecto = "Sin tipo" } = {}) => {
  const tipoNormalizado = normalizarTipoPago(valor);

  if (tipoNormalizado === "diario") {
    return "Pago diario";
  }

  if (tipoNormalizado.startsWith("quin")) {
    return "Pago quincenal";
  }

  const textoOriginal = (valor ?? "").toString().trim();
  return textoOriginal || etiquetaPorDefecto;
};

const PlanillaEmpleado = () => {
  const { user, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [planillas, setPlanillas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    if (!user || user.id_rol !== 2) return;

    const fetchPlanillas = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await planillaService.getAll();
        setPlanillas(Array.isArray(data) ? data : []);
      } catch (err) {
        const message = err.response?.data?.error || err.message || "No se pudieron cargar tus planillas.";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    fetchPlanillas();
  }, [user]);

  const planillasOrdenadas = useMemo(() => {
    return [...planillas].sort((a, b) => {
      const inicioA = new Date(a.periodo_inicio || 0).getTime();
      const inicioB = new Date(b.periodo_inicio || 0).getTime();
      return inicioB - inicioA;
    });
  }, [planillas]);

  if (!user) return <p>Cargando usuario...</p>;
  if (user.id_rol !== 2) return <p>No tienes permisos para ver esta página.</p>;

  return (
    <div className="flex min-h-screen bg-emerald-50">
      <Sidebar
        links={empleadoLinks}
        roleColor="green"
        isMobileOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col">
        <Navbar
          title="Panel del Empleado"
          user={user}
          roleColor="green"
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onLogout={logoutUser}
        />

        <main className="flex-grow bg-gradient-to-br from-emerald-50 via-white to-slate-50">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-6 py-10">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700/70">
                  Pagos y planillas
                </p>
                <h1 className="text-2xl font-semibold text-emerald-900">Mis planillas</h1>
                <p className="text-sm text-emerald-700/80">
                  Consulta los detalles de tus pagos y descarga los comprobantes sin poder modificarlos.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-emerald-700">
                <FaFileInvoiceDollar className="text-lg" />
                <span>
                  {planillas.length === 1
                    ? "1 planilla disponible"
                    : `${planillas.length} planillas disponibles`}
                </span>
              </div>
            </header>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="rounded-2xl border border-emerald-100 bg-white/80 p-6 shadow-sm">
                <p className="text-sm text-emerald-700">Cargando planillas...</p>
              </div>
            ) : planillasOrdenadas.length === 0 ? (
              <div className="rounded-2xl border border-emerald-100 bg-white/80 p-6 text-sm text-emerald-700 shadow-sm">
                No tienes planillas registradas todavía.
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-white/90 shadow-sm">
                <div className="max-h-[70vh] overflow-auto">
                  <table className="min-w-full divide-y divide-emerald-100">
                    <thead className="bg-emerald-50 text-xs uppercase tracking-wide text-emerald-700/80">
                      <tr>
                        <th className="px-4 py-3 text-left">Periodo</th>
                        <th className="px-4 py-3 text-left">Fecha de pago</th>
                        <th className="px-4 py-3 text-left">Tipo de pago</th>
                        <th className="px-4 py-3 text-right">Pago neto</th>
                        <th className="px-4 py-3 text-left">Colaborador</th>
                        <th className="px-4 py-3 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-50 bg-white text-sm text-emerald-800">
                      {planillasOrdenadas.map((planilla) => {
                        const periodo = formatPeriodo(planilla.periodo_inicio, planilla.periodo_fin);
                        const pagoNeto = formatCurrency(planilla.pago_neto ?? planilla.pagoNeto);
                        const tipoPago = formatearTipoPago(
                          planilla.tipo_pago || planilla.tipo_pago_empleado || planilla.empleado?.tipo_pago,
                        );
                        const planillaId = planilla.id_planilla || planilla.idPlanilla;
                        const fechaPago = formatDate(planilla.fecha_pago);
                        const colaborador = planilla.nombre
                          ? `${planilla.nombre} ${planilla.apellido || ""}`.trim()
                          : "Empleado";

                        return (
                          <tr key={planillaId} className="hover:bg-emerald-50/40">
                            <td className="px-4 py-3">{periodo}</td>
                            <td className="px-4 py-3">{fechaPago}</td>
                            <td className="px-4 py-3">{tipoPago}</td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-900">{pagoNeto}</td>
                            <td className="px-4 py-3">{colaborador}</td>
                            <td className="px-4 py-3 text-center">
                              <Button
                                variant="link"
                                className="flex items-center justify-center gap-2 text-emerald-700 hover:text-emerald-800"
                                onClick={() => navigate(`/empleado/planilla/${planillaId}`, { state: { planilla } })}
                              >
                                Ver detalle
                                <FaArrowRightLong className="text-base" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default PlanillaEmpleado;
