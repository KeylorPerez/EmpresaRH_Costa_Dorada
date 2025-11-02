import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import DashboardAdmin from "../pages/DashboardAdmin";
import DashboardEmpleado from "../pages/DashboardEmpleado";
import Empleados from "../pages/Empleados";
import Usuarios from "../pages/Usuarios";
import AuthForm from "../components/AuthForm"; // Login

const AppRouter = () => {
  return (
    <Router>
      <Routes>
        {/* Página de login */}
        <Route path="/login" element={<AuthForm />} />

        {/* Dashboard admin */}
        <Route
          path="/admin/*"
          element={
            <PrivateRoute allowedRoles={[1]}>
              <DashboardAdmin />
            </PrivateRoute>
          }
        />

        {/* Módulo de empleados (solo admins) */}
        <Route
          path="/admin/empleados"
          element={
            <PrivateRoute allowedRoles={[1]}>
              <Empleados />
            </PrivateRoute>
          }
        />

        <Route
          path="/admin/usuarios"
          element={
            <PrivateRoute allowedRoles={[1]}>
              <Usuarios />
            </PrivateRoute>
          }
        />

        {/* Dashboard empleado */}
        <Route
          path="/empleado/*"
          element={
            <PrivateRoute allowedRoles={[2]}>
              <DashboardEmpleado />
            </PrivateRoute>
          }
        />

        {/* Redirección por defecto a login */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
};

export default AppRouter;
