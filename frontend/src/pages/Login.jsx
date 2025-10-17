import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../api/authService";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await login(username, password);

      if (res.token) {
        navigate("/dashboard"); // Redirige al panel principal o donde prefieras
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-2xl shadow-md w-96"
      >
        <h2 className="text-2xl font-semibold text-center mb-6">
          Iniciar Sesión
        </h2>

        {error && (
          <div className="bg-red-100 text-red-600 p-2 mb-4 rounded-md text-center">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block mb-1 font-medium">Usuario</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring focus:ring-blue-300 outline-none"
            placeholder="Ingrese su usuario"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block mb-1 font-medium">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring focus:ring-blue-300 outline-none"
            placeholder="Ingrese su contraseña"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
        >
          Entrar
        </button>
      </form>
    </div>
  );
};

export default Login;
