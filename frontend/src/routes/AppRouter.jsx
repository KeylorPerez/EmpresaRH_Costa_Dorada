import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import DashboardAdmin from "../pages/DashboardAdmin";
import DashboardEmpleado from "../pages/DashboardEmpleado";
import Empleados from "../pages/Empleados";
import Usuarios from "../pages/Usuarios";
import Planilla from "../pages/Planilla";
import Vacaciones from "../pages/Vacaciones";
import Prestamos from "../pages/Prestamos";
import Liquidaciones from "../pages/Liquidaciones"; // ✅ agregado correctamente
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

      {/* Módulo de usuarios (solo admins) */}
      <Route
        path="/admin/usuarios"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Usuarios />
          </PrivateRoute>
        }
      />

      {/* Módulo de planilla (solo admins) */}
      <Route
        path="/admin/planilla"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Planilla />
          </PrivateRoute>
        }
      />

      {/* Módulo de vacaciones (admin) */}
      <Route
        path="/admin/vacaciones"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Vacaciones mode="admin" />
          </PrivateRoute>
        }
      />

      {/* Módulo de préstamos (admin) */}
      <Route
        path="/admin/prestamos"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Prestamos mode="admin" />
          </PrivateRoute>
        }
      />

      {/* Módulo de liquidaciones (admin) */}
      <Route
        path="/admin/liquidaciones"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Liquidaciones mode="admin" />
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

      {/* Módulo de vacaciones (empleado) */}
      <Route
        path="/empleado/vacaciones"
        element={
          <PrivateRoute allowedRoles={[2]}>
            <Vacaciones mode="empleado" />
          </PrivateRoute>
        }
      />

      {/* Módulo de préstamos (empleado) */}
      <Route
        path="/empleado/prestamos"
        element={
          <PrivateRoute allowedRoles={[2]}>
            <Prestamos mode="empleado" />
          </PrivateRoute>
        }
      />

      {/* Módulo de liquidaciones (empleado) */}
      <Route
        path="/empleado/liquidaciones"
        element={
          <PrivateRoute allowedRoles={[2]}>
            <Liquidaciones mode="empleado" />
          </PrivateRoute>
        }
      />

      {/* Redirección por defecto a login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRouter;

