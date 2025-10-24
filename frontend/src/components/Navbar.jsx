import React, { useContext } from "react";
import AuthContext from "../context/AuthContext";
import Button from "./Button";

const Navbar = () => {
  const { user, logoutUser } = useContext(AuthContext);

  const handleLogout = () => {
    logoutUser();
  };

  const title = user?.id_rol === 1 ? "Panel de Administración" : "Panel del Empleado";

  return (
    <nav className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md">
      <h1 className="text-xl font-semibold">{title}</h1>
      {user && <Button variant="danger" onClick={handleLogout}>Cerrar sesión</Button>}
    </nav>
  );
};

export default Navbar;
