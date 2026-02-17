/**
 * Router principal del frontend. Se encarga de definir todas las rutas de la
 * aplicación y encapsularlas con `PrivateRoute` para protegerlas según el rol
 * del usuario autenticado. Centralizar la navegación aquí facilita mantener
 * las redirecciones y las autorizaciones en un solo lugar.
 */
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import PrivateRoute from "./PrivateRoute";
import DashboardAdmin from "../pages/DashboardAdmin";
import DashboardEmpleado from "../pages/DashboardEmpleado";
import Empleados from "../pages/Empleados";
import Usuarios from "../pages/Usuarios";
import Puestos from "../pages/Puestos";
import Planilla from "../pages/Planilla";
import PlanillaDetalle from "../pages/PlanillaDetalle";
import PlanillaEmpleado from "../pages/PlanillaEmpleado";
import Vacaciones from "../pages/Vacaciones";
import Prestamos from "../pages/Prestamos";
import Liquidaciones from "../pages/Liquidaciones";
import Aguinaldos from "../pages/Aguinaldos";
import Asistencia from "../pages/Asistencia";
import DiasDobles from "../pages/DiasDobles";
import AuthForm from "../components/AuthForm"; // Login
import Acerca from "../pages/Acerca";

const AppRouter = () => {
  return (
    <Routes>
      {/* Página de login */}
      <Route path="/login" element={<AuthForm />} />
      <Route path="/acerca" element={<Acerca />} />

      {/* Dashboard admin */}
      <Route
        path="/admin/*"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <DashboardAdmin />
          </PrivateRoute>
        }
      />

      {/* Módulo de asistencia (solo admins) */}
      <Route
        path="/admin/asistencia"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Asistencia mode="admin" />
          </PrivateRoute>
        }
      />

      {/* Módulo de asistencia (empleado) */}
      <Route
        path="/empleado/asistencia"
        element={
          <PrivateRoute allowedRoles={[2]}>
            <Asistencia mode="empleado" />
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

      {/* Módulo de empleados (empleado, solo lectura) */}
      <Route
        path="/empleado/empleados"
        element={
          <PrivateRoute allowedRoles={[2]}>
            <Empleados mode="empleado" />
          </PrivateRoute>
        }
      />

      {/* Módulo de puestos (solo admins) */}
      <Route
        path="/admin/puestos"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Puestos />
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


      <Route
        path="/admin/dias-dobles"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <DiasDobles />
          </PrivateRoute>
        }
      />

      {/* Módulo de planilla (solo admins) */}
      <Route
        path="/admin/planilla/:id"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <PlanillaDetalle />
          </PrivateRoute>
        }
      />

      {/* Listado de planillas (solo admins) */}
      <Route
        path="/admin/planilla"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Planilla />
          </PrivateRoute>
        }
      />

      {/* Planilla (empleado) */}
      <Route
        path="/empleado/planilla/:id"
        element={
          <PrivateRoute allowedRoles={[2]}>
            <PlanillaDetalle mode="empleado" />
          </PrivateRoute>
        }
      />
      <Route
        path="/empleado/planilla"
        element={
          <PrivateRoute allowedRoles={[2]}>
            <PlanillaEmpleado />
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

      <Route
        path="/admin/aguinaldos"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Aguinaldos mode="admin" />
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

      <Route
        path="/empleado/aguinaldos"
        element={
          <PrivateRoute allowedRoles={[2]}>
            <Aguinaldos mode="empleado" />
          </PrivateRoute>
        }
      />

      {/* Redirección por defecto a login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
};

export default AppRouter;


