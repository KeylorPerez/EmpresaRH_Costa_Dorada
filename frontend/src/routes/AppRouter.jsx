import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import DashboardAdmin from "../pages/DashboardAdmin";
import DashboardEmpleado from "../pages/DashboardEmpleado";
import Empleados from "../pages/Empleados";
import Usuarios from "../pages/Usuarios";
import Planilla from "../pages/Planilla";
import AuthForm from "../components/AuthForm"; // Login

const AppRouter = () => {
  return (
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

      <Route
        path="/admin/planilla"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Planilla />
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
  );
};

export default AppRouter;
