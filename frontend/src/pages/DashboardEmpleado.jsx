import React, { useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";


const DashboardEmpleado = () => {
  const navigate = useNavigate();
  const { user, logoutUser } = useContext(AuthContext);

  // Redirigir si no hay usuario o no es empleado
  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else if (user.id_rol !== 2) {
      navigate("/admin");
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  // Links del Sidebar para empleado
  const empleadoLinks = [
    { path: "/empleado/asistencia", label: "Asistencia" },
    { path: "/empleado/vacaciones", label: "Vacaciones" },
    { path: "/empleado/prestamos", label: "Préstamos" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar links={empleadoLinks} roleColor="green" />

      <div className="flex flex-col flex-grow">
        {/* Navbar */}
        <Navbar
          title="Panel del Empleado"
          user={user}
          roleColor="green"
          onLogout={handleLogout}
        />

        {/* Contenido principal */}
        <main className="flex-grow flex flex-col items-center justify-center p-6">
          {user ? (
            <div className="bg-white p-8 rounded-2xl shadow-md w-96 text-center space-y-4">
              <h2 className="text-2xl font-bold mb-2 text-gray-800">
                ¡Bienvenido, {user.username}!
              </h2>
              <p className="text-gray-600 font-semibold">Rol: Empleado</p>

              {/* Botones rápidos */}
              <div className="flex flex-col space-y-2 mt-4">
                <Button
                  onClick={() => navigate("/empleado/asistencia")}
                  variant="primary"
                  size="md"
                >
                  Asistencia
                </Button>
                <Button
                  onClick={() => navigate("/empleado/vacaciones")}
                  variant="primary"
                  size="md"
                >
                  Vacaciones
                </Button>
                <Button
                  onClick={() => navigate("/empleado/prestamos")}
                  variant="primary"
                  size="md"
                >
                  Préstamos
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-gray-600 text-lg">Cargando...</p>
          )}
        </main>

        {/* Footer */}
        <footer className="text-center py-4 text-gray-500 text-sm">
          © 2025 EmpresaRH - Todos los derechos reservados
        </footer>
      </div>
    </div>
  );
};

export default DashboardEmpleado;
