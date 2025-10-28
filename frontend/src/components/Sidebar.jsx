// src/components/Sidebar.jsx
import React from "react";
import PropTypes from "prop-types";
import { Link, useLocation } from "react-router-dom";

const Sidebar = ({ links = [], roleColor = "blue" }) => {
  const location = useLocation();

  const bgColor =
    roleColor === "blue"
      ? "bg-blue-600"
      : roleColor === "green"
      ? "bg-green-600"
      : "bg-gray-600";

  return (
    <aside className={`min-h-screen w-64 ${bgColor} text-white flex flex-col`}>
      <div className="p-4 text-2xl font-bold border-b border-white/20">Menu</div>

      <nav className="flex flex-col flex-grow p-4 space-y-2">
        {links.map((link) => {
          const isActive = location.pathname === link.path;
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`px-4 py-2 rounded-lg transition-colors font-medium ${
                isActive
                  ? "bg-white text-black"
                  : "hover:bg-white/20 text-white"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

Sidebar.propTypes = {
  links: PropTypes.arrayOf(
    PropTypes.shape({
      path: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
    })
  ).isRequired,
  roleColor: PropTypes.string,
};

export default Sidebar;
