import React from "react";
import { Navigate } from "react-router-dom";

const PrivateRoute = ({ allowedRoles, children }) => {
  const token = localStorage.getItem("token");
  const user = token ? JSON.parse(atob(token.split(".")[1])) : null;

  if (!token || !user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.id_rol)) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default PrivateRoute;
