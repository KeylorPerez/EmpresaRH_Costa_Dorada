import axios from 'axios';
import { redirectToLogin } from '../utils/navigation';

// Crear la instancia base de Axios con la URL del backend
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL, // http://localhost:3000/api
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor para incluir el token JWT automáticamente si existe
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // o sessionStorage si prefieres
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor para manejar errores globales
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const message = error.response?.data?.error?.toLowerCase?.() || '';

    const shouldLogout =
      status === 401 ||
      (status === 403 && message.includes('inactivo'));

    if (shouldLogout) {
      console.warn('Sesión expirada o usuario inactivo');
      localStorage.removeItem('token');
      redirectToLogin();
    }

    return Promise.reject(error);
  }
);

export default api;
