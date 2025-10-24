import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PrivateRoute from './PrivateRoute';
import DashboardAdmin from '../pages/DashboardAdmin';
import DashboardEmpleado from '../pages/DashboardEmpleado';
import Empleados from '../pages/Empleados';
import Login from '../pages/Login';

const AppRouter = () => {
  return (
    <Router>
      <Routes>
        {/* Página de login */}
        <Route path="/login" element={<Login />} />

        {/* Dashboard admin */}
        <Route
          path="/dashboard-admin"
          element={
            <PrivateRoute allowedRoles={[1]}>
              <DashboardAdmin />
            </PrivateRoute>
          }
        />

        {/* Dashboard empleado */}
        <Route
          path="/dashboard-empleado"
          element={
            <PrivateRoute allowedRoles={[2]}>
              <DashboardEmpleado />
            </PrivateRoute>
          }
        />

        {/* Módulo de empleados (solo admins) */}
        <Route
          path="/empleados"
          element={
            <PrivateRoute allowedRoles={[1]}>
              <Empleados />
            </PrivateRoute>
          }
        />

        {/* Ruta por defecto: si no encuentra nada, ir a login */}
        <Route path="*" element={<Login />} />
      </Routes>
    </Router>
  );
};

export default AppRouter;
