import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AuthForm from "./components/AuthForm";
import DashboardAdmin from "./pages/DashboardAdmin";
import DashboardEmpleado from "./pages/DashboardEmpleado";
import Empleados from "./pages/Empleados"; // <-- import del módulo
import PrivateRoute from "./routes/PrivateRoute";

function App() {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<AuthForm />} />

      {/* Rutas privadas con roles */}
      <Route
        path="/admin/*"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <DashboardAdmin />
          </PrivateRoute>
        }
      />
      <Route
        path="/admin/empleados"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <Empleados />
          </PrivateRoute>
        }
      />

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
}

export default App;
