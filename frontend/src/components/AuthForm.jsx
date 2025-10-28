import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService";
import AuthContext from "../context/AuthContext";
import Button from "../components/Button"; // Opcional: si ya tenés componente Button

const AuthForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { loginUser } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const { user, token } = await login(username, password);
      loginUser(user, token);

      // Limpiar inputs
      setUsername("");
      setPassword("");

      // Redirigir según rol
      if (user.id_rol === 1) {
        navigate("/admin");
      } else if (user.id_rol === 2) {
        navigate("/empleado");
      } else {
        setError("Rol de usuario no autorizado");
      }
    } catch (err) {
      setError(err.message || "Error al iniciar sesión");
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <form
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-md"
        onSubmit={handleSubmit}
      >
        <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
          Inicio de Sesión
        </h2>

        {error && (
          <p className="text-red-600 font-semibold mb-4 text-center">{error}</p>
        )}

        <label htmlFor="username" className="block mb-1 font-medium text-gray-700">
          Usuario
        </label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Ingrese su usuario"
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        <label htmlFor="password" className="block mb-1 font-medium text-gray-700">
          Contraseña
        </label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Ingrese su contraseña"
          className="w-full border border-gray-300 rounded px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />

        {/* Botón con Tailwind o tu componente Button */}
        <Button variant="primary" type="submit" className="w-full py-2">
          Ingresar
        </Button>
      </form>
    </div>
  );
};

export default AuthForm;
