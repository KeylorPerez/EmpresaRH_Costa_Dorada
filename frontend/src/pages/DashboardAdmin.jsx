import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const DashboardAdmin = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setUser(payload);
      if (payload.id_rol !== 1) {
        // Si no es admin, redirige al dashboard de empleado
        navigate("/dashboard-empleado");
      }
    } catch (error) {
      console.error("Token inválido:", error);
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
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

      <main className="flex-grow flex flex-col items-center justify-center">
        {user ? (
          <div className="bg-white p-8 rounded-2xl shadow-md w-96 text-center">
            <h2 className="text-2xl font-bold mb-4 text-gray-800">
              ¡Bienvenido, {user.username}!
            </h2>
            <p className="text-gray-600 font-semibold">Rol: Administrador</p>
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
