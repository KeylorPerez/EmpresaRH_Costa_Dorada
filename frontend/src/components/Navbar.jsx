// src/components/Navbar.jsx
/**
 * Barra superior que muestra el título del módulo y la identidad del usuario.
 * Centraliza el botón de logout para que cada página solo tenga que pasar el
 * handler y no duplicar estilos.
 */
import React from "react";
import PropTypes from "prop-types";

const Navbar = ({ title, user, roleColor = "blue", onLogout }) => {
  const accent = {
    blue: {
      text: "text-blue-600",
      badge: "bg-blue-600/15 text-blue-600",
    },
    green: {
      text: "text-emerald-600",
      badge: "bg-emerald-600/15 text-emerald-600",
    },
    gray: {
      text: "text-slate-700",
      badge: "bg-slate-600/15 text-slate-700",
    },
  }[roleColor] ?? {
    text: "text-blue-600",
    badge: "bg-blue-600/15 text-blue-600",
  };

  return (
    <nav className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-6 py-4 text-slate-700 shadow-sm backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">
          Administración
        </p>
        <h1 className={`text-xl font-semibold ${accent.text}`}>{title}</h1>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        {user && (
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div
              className={`flex size-9 items-center justify-center rounded-full text-sm font-semibold uppercase ${accent.badge}`}
            >
              {user.username?.charAt(0)?.toUpperCase() ?? "A"}
            </div>
            <div className="text-left text-xs leading-tight">
              <p className="font-semibold text-slate-700">{user.username}</p>
              <p className="text-slate-400">
                Rol: {user.rol || "Administrador"}
              </p>
            </div>
          </div>
        )}

        <button
          onClick={onLogout}
          className="rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-rose-600 hover:to-red-600 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-500"
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
};

Navbar.propTypes = {
  title: PropTypes.string.isRequired,
  user: PropTypes.object,
  roleColor: PropTypes.string,
  onLogout: PropTypes.func.isRequired,
};

export default Navbar;
