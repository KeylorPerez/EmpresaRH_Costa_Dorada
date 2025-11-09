import axios from "../api/axiosConfig";
import { decodeJwtPayload } from "../utils/jwt";

// Función para iniciar sesión
export const login = async (username, password) => {
  try {
    const response = await axios.post("/auth/login", { username, password });

    const token = response.data.token;
    if (!token) throw new Error("Token no recibido del servidor");

    // Guardar token en localStorage
    localStorage.setItem("token", token);

    // Decodificar payload del token (id_usuario, username, id_rol)
    const user = decodeJwtPayload(token);

    // Retornamos ambos
    return { user, token };
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error || "Error en el inicio de sesión");
    } else {
      throw new Error("No se pudo conectar con el servidor");
    }
  }
};

// Cerrar sesión
export const logout = () => {
  localStorage.removeItem("token");
};

// Obtener token guardado
export const getToken = () => localStorage.getItem("token");

// Verificar si el usuario está autenticado
export const isAuthenticated = () => !!getToken();
