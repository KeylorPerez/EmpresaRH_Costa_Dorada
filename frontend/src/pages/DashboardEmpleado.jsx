import React, { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowRightLong,
  FaCalendarCheck,
  FaFileSignature,
  FaGift,
  FaHandHoldingDollar,
  FaUmbrellaBeach,
} from "react-icons/fa6";
import AuthContext from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { empleadoLinks } from "../utils/navigationLinks";


const DashboardEmpleado = () => {
  const navigate = useNavigate();
  const { user, logoutUser } = useContext(AuthContext);

  // Redirigir si no hay usuario o no es empleado
  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else if (user.id_rol !== 2) {
      navigate("/admin");
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  const quickActions = [
    {
      path: "/empleado/asistencia",
      label: "Revisar asistencia",
      description: "Consulta tus registros diarios y verifica tus marcaciones.",
      icon: FaCalendarCheck,
      accent: "from-emerald-500 to-teal-500",
    },
    {
      path: "/empleado/vacaciones",
      label: "Solicitar vacaciones",
      description: "Visualiza tu saldo disponible y gestiona nuevas solicitudes.",
      icon: FaUmbrellaBeach,
      accent: "from-teal-500 to-cyan-500",
    },
    {
      path: "/empleado/prestamos",
      label: "Gestionar préstamos",
      description: "Revisa tus adelantos y da seguimiento a los pagos pendientes.",
      icon: FaHandHoldingDollar,
      accent: "from-amber-500 to-orange-500",
    },
    {
      path: "/empleado/liquidaciones",
      label: "Ver liquidaciones",
      description: "Consulta el historial de tus liquidaciones y descárgalas.",
      icon: FaFileSignature,
      accent: "from-slate-500 to-slate-600",
    },
    {
      path: "/empleado/aguinaldos",
      label: "Aguinaldos",
      description: "Accede a los detalles de tus bonificaciones anuales.",
      icon: FaGift,
      accent: "from-pink-500 to-rose-500",
    },
  ];

  const initials =
    user && user.username ? user.username.charAt(0).toUpperCase() : "E";

  return (
    <div className="flex min-h-screen bg-emerald-50">
      <Sidebar links={empleadoLinks} roleColor="green" />

      <div className="flex flex-1 flex-col">
        <Navbar
          title="Panel del Empleado"
          user={user}
          roleColor="green"
          onLogout={handleLogout}
        />

        <main className="flex-grow bg-gradient-to-br from-emerald-50 via-white to-slate-50">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-12">
            {user ? (
              <>
                <div className="grid gap-8 lg:grid-cols-3">
                  <section className="relative overflow-hidden rounded-3xl border border-white/50 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 p-8 text-white shadow-xl">
                    <div className="absolute -right-20 top-12 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute -left-16 -top-10 h-48 w-48 rounded-full bg-white/10 blur-3xl" />

                    <div className="relative z-10 flex h-full flex-col gap-6">
                      <div className="flex items-center gap-4">
                        <div className="flex size-16 items-center justify-center rounded-full bg-white/20 text-2xl font-semibold uppercase backdrop-blur-sm">
                          {initials}
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/70">
                            ¡Bienvenido!
                          </p>
                          <h2 className="text-3xl font-semibold leading-tight">
                            {user.username}
                          </h2>
                        </div>
                      </div>

                      <p className="text-sm text-white/80">
                        Consulta tus recursos personales, mantén al día tus trámites y gestiona tu información desde un solo panel.
                      </p>

                      <div className="grid gap-4 text-sm">
                        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                          <span className="inline-flex w-fit items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/70">
                            Rol
                          </span>
                          <p className="mt-3 text-xl font-semibold leading-tight text-white break-words">
                            {user.rol || "Empleado"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                          <p className="text-xs uppercase tracking-wide text-white/60">
                            Accesos directos
                          </p>
                          <p className="mt-1 text-lg font-semibold">{quickActions.length}</p>
                        </div>
                      </div>

                      <div className="mt-auto flex flex-wrap gap-3 text-sm">
                        <Button
                          onClick={() => navigate("/empleado/vacaciones")}
                          variant="secondary"
                          size="sm"
                          className="border border-white/30 bg-white/20 px-5 text-white backdrop-blur-sm hover:bg-white/30"
                        >
                          Ver vacaciones
                        </Button>
                        <Button
                          onClick={() => navigate("/empleado/asistencia")}
                          variant="secondary"
                          size="sm"
                          className="border border-white/30 bg-white/10 px-5 text-white backdrop-blur-sm hover:bg-white/20"
                        >
                          Revisar asistencia
                        </Button>
                      </div>
                    </div>
                  </section>

                  <section className="lg:col-span-2">
                    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-emerald-900">
                          Acciones rápidas
                        </h3>
                        <p className="text-sm text-emerald-700/80">
                          Elige una opción para continuar con tu gestión diaria.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.path}
                            type="button"
                            onClick={() => navigate(action.path)}
                            className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-emerald-100 bg-white/80 p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500"
                          >
                            <div>
                              <span
                                className={`inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${action.accent} text-white shadow-md`}
                              >
                                <Icon className="text-xl" />
                              </span>
                              <h4 className="mt-4 text-base font-semibold text-emerald-900">
                                {action.label}
                              </h4>
                              <p className="mt-2 text-sm text-emerald-700/80">
                                {action.description}
                              </p>
                            </div>
                            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 transition group-hover:text-emerald-700">
                              Explorar
                              <FaArrowRightLong className="text-base transition-transform group-hover:translate-x-1" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                </div>
              </>
            ) : (
              <p className="text-center text-lg text-gray-600">Cargando...</p>
            )}
          </div>
        </main>

        <footer className="border-t border-emerald-100 bg-white/80 py-4 text-center text-sm text-emerald-700/80 backdrop-blur">
          © {new Date().getFullYear()} EmpresaRH - Todos los derechos reservados
        </footer>
      </div>
    </div>
  );
};

export default DashboardEmpleado;
