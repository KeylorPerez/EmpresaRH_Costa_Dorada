// src/components/Sidebar.jsx
/**
 * Barra lateral reutilizable para admin y empleados. Recibe la lista de enlaces
 * desde el contenedor para mantener la navegación desacoplada y permite ajustar
 * la paleta (`roleColor`) según el rol, facilitando la diferenciación visual.
 */
import React from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";
import { FaXmark } from "react-icons/fa6";

const Sidebar = ({
  links = [],
  roleColor = "blue",
  isMobileOpen = false,
  onClose,
}) => {
  const location = useLocation();

  const gradientColors = {
    blue: "from-blue-600 via-blue-700 to-indigo-700",
    green: "from-emerald-600 via-emerald-700 to-teal-700",
    gray: "from-slate-600 via-slate-700 to-slate-800",
  };

  const accentColor =
    roleColor === "green"
      ? "text-emerald-500"
      : roleColor === "gray"
      ? "text-slate-600"
      : "text-blue-500";

  return (
    <>
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/50 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-30 flex min-h-screen w-72 transform bg-gradient-to-br ${
          gradientColors[roleColor] ?? gradientColors.blue
        } text-white shadow-2xl transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.28),transparent_60%)]" />

        <div className="flex h-full w-full flex-col p-6">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium uppercase tracking-[0.3em] text-white/60">
                Panel
              </span>
              <h2 className="text-2xl font-semibold">Menu</h2>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="mt-1 inline-flex items-center justify-center rounded-full border border-white/20 bg-white/10 p-2 text-white transition hover:border-white/40 hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:hidden"
                aria-label="Cerrar menú"
              >
                <FaXmark />
              </button>
            )}
          </div>

          <nav className="flex flex-col gap-2 text-sm">
            {links.map((link) => {
              const isActive = location.pathname === link.path;
              const Icon = link.icon;

              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={onClose}
                  className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3 font-medium transition-all ${
                    isActive
                      ? "bg-white text-slate-900 shadow-lg shadow-blue-900/20"
                      : "hover:bg-white/10"
                  }`}
                >
                  {Icon && (
                    <span
                      className={`text-lg transition-colors ${
                        isActive
                          ? accentColor
                          : "text-white/70 group-hover:text-white"
                      }`}
                    >
                      <Icon />
                    </span>
                  )}
                  <span className="flex-1">{link.label}</span>
                  {isActive && (
                    <span className={`text-xs font-semibold ${accentColor}`}>
                      ●
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-8 text-xs text-white/60">
            © {new Date().getFullYear()} EmpresaRH
          </div>
        </div>
      </aside>
    </>
  );
};

Sidebar.propTypes = {
  links: PropTypes.arrayOf(
    PropTypes.shape({
      path: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      icon: PropTypes.elementType,
    })
  ).isRequired,
  roleColor: PropTypes.string,
  isMobileOpen: PropTypes.bool,
  onClose: PropTypes.func,
};

export default Sidebar;
