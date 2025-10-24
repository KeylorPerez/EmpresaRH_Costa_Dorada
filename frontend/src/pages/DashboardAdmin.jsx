import React, { useContext } from "react";
import { useNavigate, Link } from "react-router-dom";
import AuthContext from "../context/AuthContext";

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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <nav className="bg-blue-600 text-white p-4 flex justify-between items-center shadow-md">
        <h1 className="text-xl font-semibold">Panel de Administración</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-lg text-sm font-semibold transition"
        >
          Cerrar sesión
        </button>
      </nav>

      <main className="flex-grow flex flex-col items-center justify-center space-y-6">
        {user ? (
          <div className="bg-white p-8 rounded-2xl shadow-md w-96 text-center space-y-4">
            <h2 className="text-2xl font-bold mb-2 text-gray-800">
              ¡Bienvenido, {user.username}!
            </h2>
            <p className="text-gray-600 font-semibold">Rol: Administrador</p>

            {/* Links rápidos del panel */}
            <div className="flex flex-col space-y-2 mt-4">
              <Link
                to="/admin/empleados"
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
              >
                Gestionar Empleados
              </Link>
              {/* Podés agregar más botones aquí, por ejemplo Planilla, Vacaciones, etc. */}
            </div>
          </div>
        ) : (
          <p className="text-gray-600 text-lg">Cargando...</p>
        )}
      </main>

      <footer className="text-center py-4 text-gray-500 text-sm">
        © 2025 EmpresaRH - Todos los derechos reservados
      </footer>
    </div>
  );
};

export default DashboardAdmin;
