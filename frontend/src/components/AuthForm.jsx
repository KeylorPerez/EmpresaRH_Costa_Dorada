import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../services/authService";
import "../assets/styles/global.css";

const AuthForm = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      // Llamada al backend para login
      const user = await login(username, password);

      // Redirigir según rol
      if (user.id_rol === 1) {
        navigate("/admin"); // Administrador
      } else if (user.id_rol === 2) {
        navigate("/empleado"); // Empleado
      } else {
        setError("Rol de usuario no autorizado");
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <form className="login-form" onSubmit={handleSubmit}>
        <h2>Inicio de Sesión</h2>

        <label htmlFor="username">Usuario</label>
        <input
          type="text"
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Ingrese su usuario"
          required
        />

        <label htmlFor="password">Contraseña</label>
        <input
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Ingrese su contraseña"
          required
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" className="btn-login">
          Ingresar
        </button>
      </form>
    </div>
  );
};

export default AuthForm;
