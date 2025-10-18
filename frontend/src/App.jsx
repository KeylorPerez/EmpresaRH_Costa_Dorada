import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AuthForm from "./components/AuthForm";
import DashboardAdmin from "./pages/DashboardAdmin";
import DashboardEmpleado from "./pages/DashboardEmpleado";
import PrivateRoute from "./routes/PrivateRoute";

// App.jsx maneja rutas públicas y privadas
function App() {
  return (
    <Routes>
      {/* Ruta pública */}
      <Route path="/login" element={<AuthForm />} />

      {/* Rutas privadas */}
      <Route
        path="/admin/*"
        element={
          <PrivateRoute allowedRoles={[1]}>
            <DashboardAdmin />
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

      {/* Redirección por defecto */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
