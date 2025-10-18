import axios from "../api/axiosConfig";

// Función para iniciar sesión
export const login = async (username, password) => {
  try {
    const response = await axios.post("/auth/login", { username, password });

    // Si el backend devuelve el token, lo guardamos en localStorage
    if (response.data.token) {
      localStorage.setItem("token", response.data.token);

      // Decodificar payload del token (id_usuario, username, id_rol)
      const payload = JSON.parse(atob(response.data.token.split(".")[1]));

      return payload; // Retornamos payload para usarlo en AuthForm
    }

    throw new Error("Token no recibido del servidor");
  } catch (error) {
    // Captura errores del servidor o de red
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
export const getToken = () => {
  return localStorage.getItem("token");
};

// Verificar si el usuario está autenticado
export const isAuthenticated = () => {
  const token = getToken();
  return !!token; // Devuelve true si existe token
};
