/**
 * Panel principal para administradores. Coordina la validación de rol, la
 * navegación a los módulos clave y la presentación de acciones rápidas en la
 * pantalla inicial. Mantener las colecciones `adminLinks` y `quickActions`
 * aquí permite que el resto de componentes (Navbar, Sidebar, tarjetas) sean
 * puramente presentacionales.
 */
import React, { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  FaArrowRightLong,
  FaBriefcase,
  FaCalendarCheck,
  FaFileInvoiceDollar,
  FaFileSignature,
  FaGift,
  FaHandHoldingDollar,
  FaUmbrellaBeach,
  FaUserGear,
  FaUserGroup,
} from "react-icons/fa6";
import AuthContext from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";
import { adminLinks } from "../utils/navigationLinks";
import { getRoleLabel } from "../utils/roles";

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const { user, logoutUser } = useContext(AuthContext);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Guard de navegación: si no hay usuario o su rol no es admin, se reubica
  // al login o al dashboard de empleado según corresponda.
  React.useEffect(() => {
    if (!user) {
      navigate("/login");
    } else if (user.id_rol !== 1) {
      navigate("/empleado");
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  // Acciones rápidas para el panel principal
  const quickActions = [
    {
      path: "/admin/asistencia",
      label: "Gestionar Asistencia",
      description: "Controla horarios, registros y reportes de asistencia.",
      icon: FaCalendarCheck,
      accent: "from-blue-500 to-blue-600",
    },
    {
      path: "/admin/usuarios",
      label: "Gestionar Usuarios",
      description: "Administra roles, accesos y credenciales del sistema.",
      icon: FaUserGear,
      accent: "from-indigo-500 to-purple-500",
    },
    {
      path: "/admin/empleados",
      label: "Gestionar Empleados",
      description: "Actualiza expedientes, datos personales y contratos.",
      icon: FaUserGroup,
      accent: "from-sky-500 to-cyan-500",
    },
    {
      path: "/admin/puestos",
      label: "Gestionar Puestos",
      description: "Configura jerarquías, descripciones y requisitos.",
      icon: FaBriefcase,
      accent: "from-amber-500 to-orange-500",
    },
    {
      path: "/admin/planilla",
      label: "Planilla",
      description: "Prepara nóminas, pagos y reportes contables.",
      icon: FaFileInvoiceDollar,
      accent: "from-emerald-500 to-green-500",
    },
    {
      path: "/admin/vacaciones",
      label: "Vacaciones",
      description: "Autoriza solicitudes y controla saldos pendientes.",
      icon: FaUmbrellaBeach,
      accent: "from-teal-500 to-cyan-500",
    },
    {
      path: "/admin/prestamos",
      label: "Préstamos",
      description: "Registra adelantos y gestiona estados de pago.",
      icon: FaHandHoldingDollar,
      accent: "from-fuchsia-500 to-rose-500",
    },
    {
      path: "/admin/liquidaciones",
      label: "Liquidaciones",
      description: "Calcula liquidaciones y genera documentación.",
      icon: FaFileSignature,
      accent: "from-slate-500 to-slate-600",
    },
    {
      path: "/admin/aguinaldos",
      label: "Aguinaldos",
      description: "Prepara bonificaciones y reportes anuales.",
      icon: FaGift,
      accent: "from-pink-500 to-rose-500",
    },
  ];

  const initials =
    user && user.username ? user.username.charAt(0).toUpperCase() : "A";

  return (
    <div className="flex min-h-screen bg-slate-100/60">
      <Sidebar
        links={adminLinks}
        roleColor="blue"
        isMobileOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col">
        <Navbar
          title="Panel de Administración"
          user={user}
          roleColor="blue"
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          onLogout={handleLogout}
        />

        <main className="flex-grow bg-gradient-to-br from-slate-100 via-white to-blue-50">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-12">
            {user ? (
              <>
                <div className="grid gap-8 lg:grid-cols-3">
                  <section className="relative overflow-hidden rounded-3xl border border-white/40 bg-gradient-to-br from-blue-600 via-blue-600 to-indigo-600 p-8 text-white shadow-xl">
                    <div className="absolute -right-20 top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
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
                        Gestiona los módulos principales de recursos humanos y
                        mantén el control de tu organización desde un solo lugar.
                      </p>

                      <div className="grid gap-4 text-sm">
                        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                          <span className="inline-flex w-fit items-center rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.3em] text-white/70">
                            Rol
                          </span>
                          <p className="mt-3 text-xl font-semibold leading-tight text-white break-words">
                            {getRoleLabel(user)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                          <p className="text-xs uppercase tracking-wide text-white/60">
                            Accesos directos
                          </p>
                          <p className="mt-1 text-lg font-semibold">
                            {quickActions.length}
                          </p>
                        </div>
                      </div>

                      <div className="mt-auto flex flex-wrap gap-3 text-sm">
                        <Button
                          onClick={() => navigate("/admin/planilla")}
                          variant="secondary"
                          size="sm"
                          className="border border-white/30 bg-white/20 px-5 text-white backdrop-blur-sm hover:bg-white/30"
                        >
                          Ir a Planilla
                        </Button>
                        <Button
                          onClick={() => navigate("/admin/usuarios")}
                          variant="secondary"
                          size="sm"
                          className="border border-white/30 bg-white/10 px-5 text-white backdrop-blur-sm hover:bg-white/20"
                        >
                          Gestionar Usuarios
                        </Button>
                      </div>
                    </div>
                  </section>

                  <section className="lg:col-span-2">
                    <div className="mb-6 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold text-slate-800">
                          Acciones rápidas
                        </h3>
                        <p className="text-sm text-slate-500">
                          Selecciona una opción para continuar con tu gestión.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      {quickActions.map((action) => {
                        const Icon = action.icon;
                        return (
                          <button
                            key={action.path}
                            type="button"
                            onClick={() => navigate(action.path)}
                            className="group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-slate-200 bg-white/80 p-5 text-left shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                          >
                            <div>
                              <span
                                className={`inline-flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br ${action.accent} text-white shadow-md`}
                              >
                                <Icon className="text-xl" />
                              </span>
                              <h4 className="mt-4 text-base font-semibold text-slate-800">
                                {action.label}
                              </h4>
                              <p className="mt-2 text-sm text-slate-500">
                                {action.description}
                              </p>
                            </div>
                            <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition group-hover:text-blue-600">
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

        <footer className="border-t border-slate-200 bg-white/70 py-4 text-center text-sm text-slate-500 backdrop-blur">
          © {new Date().getFullYear()} EmpresaRH - Todos los derechos reservados
        </footer>
      </div>
    </div>
  );
};

export default DashboardAdmin;
