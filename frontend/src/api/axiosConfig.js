import axios from 'axios';

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
    if (error.response?.status === 401) {
      console.warn('Sesión expirada o token inválido');
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
