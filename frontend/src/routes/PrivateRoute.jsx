import React, { useContext } from "react";
import { Navigate } from "react-router-dom";
import AuthContext from "../context/AuthContext"; 

const PrivateRoute = ({ allowedRoles, children }) => {
  const { user, loading } = useContext(AuthContext);

  // Mientras se carga la sesión
  if (loading) return <p className="text-center mt-8">Cargando...</p>;

  // Si no hay usuario logueado, redirige a login
  if (!user) return <Navigate to="/login" replace />;

  // Si el rol del usuario no está permitido, redirige a login
  if (!allowedRoles.includes(user.id_rol)) return <Navigate to="/login" replace />;

  return children;
};

export default PrivateRoute;
