import React, { useContext } from "react";
import { useNavigate } from "react-router-dom";
import AuthContext from "../context/AuthContext";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import Button from "../components/Button";


const DashboardAdmin = () => {
  const navigate = useNavigate();
  const { user, logoutUser } = useContext(AuthContext);

  // Redirigir si no hay usuario o no es admin
  React.useEffect(() => {
    if (!user) {
      navigate("/login");
    } else if (user.id_rol !== 1) {
      navigate("/empleado");
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logoutUser();
    navigate("/login");
  };

  // Links del Sidebar
  const adminLinks = [
    { path: "/admin", label: "Inicio" },
    { path: "/admin/asistencia", label: "Asistencia" },
    { path: "/admin/usuarios", label: "Usuarios" },
    { path: "/admin/empleados", label: "Empleados" },
    { path: "/admin/puestos", label: "Puestos" },
    { path: "/admin/planilla", label: "Planilla" },
    { path: "/admin/vacaciones", label: "Vacaciones" },
    { path: "/admin/prestamos", label: "Préstamos" },
    { path: "/admin/liquidaciones", label: "Liquidaciones" },
    { path: "/admin/aguinaldos", label: "Aguinaldos" },
  ];

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <Sidebar links={adminLinks} roleColor="blue" />

      <div className="flex flex-col flex-grow">
        {/* Navbar */}
        <Navbar
          title="Panel de Administración"
          user={user}
          roleColor="blue"
          onLogout={handleLogout}
        />

        {/* Contenido principal */}
        <main className="flex-grow flex flex-col items-center justify-center p-6">
          {user ? (
            <div className="bg-white p-8 rounded-2xl shadow-md w-96 text-center space-y-4">
              <h2 className="text-2xl font-bold mb-2 text-gray-800">
                ¡Bienvenido, {user.username}!
              </h2>
              <p className="text-gray-600 font-semibold">Rol: Administrador</p>

              {/* Links rápidos del panel con Button */}
              <div className="flex flex-col space-y-2 mt-4">
                <Button
                  onClick={() => navigate("/admin/asistencia")}
                  variant="primary"
                  size="md"
                >
                  Gestionar Asistencia
                </Button>
                <Button
                  onClick={() => navigate("/admin/usuarios")}
                  variant="primary"
                  size="md"
                >
                  Gestionar Usuarios
                </Button>
                <Button
                  onClick={() => navigate("/admin/empleados")}
                  variant="primary"
                  size="md"
                >
                  Gestionar Empleados
                </Button>
                <Button
                  onClick={() => navigate("/admin/puestos")}
                  variant="primary"
                  size="md"
                >
                  Gestionar Puestos
                </Button>
                <Button
                  onClick={() => navigate("/admin/planilla")}
                  variant="primary"
                  size="md"
                >
                  Planilla
                </Button>
                <Button
                  onClick={() => navigate("/admin/vacaciones")}
                  variant="primary"
                  size="md"
                >
                  Vacaciones
                </Button>
                <Button
                  onClick={() => navigate("/admin/prestamos")}
                  variant="primary"
                  size="md"
                >
                  Préstamos
                </Button>
                <Button
                  onClick={() => navigate("/admin/liquidaciones")}
                  variant="primary"
                  size="md"
                >
                  Liquidaciones
                </Button>
                <Button
                  onClick={() => navigate("/admin/aguinaldos")}
                  variant="primary"
                  size="md"
                >
                  Aguinaldos
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

export default DashboardAdmin;
