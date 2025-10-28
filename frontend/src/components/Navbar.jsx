// src/components/Navbar.jsx
import React from "react";
import PropTypes from "prop-types";

const Navbar = ({ title, user, roleColor = "blue", onLogout }) => {
  const bgColor =
    roleColor === "blue"
      ? "bg-blue-600 hover:bg-blue-700"
      : roleColor === "green"
      ? "bg-green-600 hover:bg-green-700"
      : "bg-gray-600 hover:bg-gray-700";

  return (
    <nav className={`flex justify-between items-center p-4 text-white shadow-md ${bgColor}`}>
      <h1 className="text-xl font-semibold">{title}</h1>

      <div className="flex items-center space-x-4">
        {user && (
          <span className="font-medium text-sm">
            {user.username} ({user.rol})
          </span>
        )}

        <button
          onClick={onLogout}
          className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-semibold transition"
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
