import React, { useContext } from "react";
import { NavLink } from "react-router-dom";
import AuthContext from "../context/AuthContext";

const Sidebar = () => {
  const { user } = useContext(AuthContext);

  const linksAdmin = [
    { name: "Dashboard", path: "/dashboard-admin" },
    { name: "Empleados", path: "/empleados" },
    { name: "Planilla", path: "/planilla" },
    { name: "Vacaciones", path: "/vacaciones" },
    { name: "Préstamos", path: "/prestamos" },
    { name: "Liquidaciones", path: "/liquidaciones" },
  ];

  const linksEmpleado = [
    { name: "Dashboard", path: "/dashboard-empleado" },
    { name: "Asistencia", path: "/asistencia" },
    { name: "Vacaciones", path: "/vacaciones" },
    { name: "Préstamos", path: "/prestamos" },
  ];

  const links = user?.id_rol === 1 ? linksAdmin : linksEmpleado;

  return (
    <aside className="bg-gray-800 text-white w-64 min-h-screen p-4 flex flex-col space-y-2">
      {links.map((link) => (
        <NavLink
          key={link.path}
          to={link.path}
          className={({ isActive }) =>
            `px-4 py-2 rounded-lg hover:bg-gray-700 transition ${
              isActive ? "bg-gray-700 font-bold" : ""
            }`
          }
        >
          {link.name}
        </NavLink>
      ))}
    </aside>
  );
};

export default Sidebar;
