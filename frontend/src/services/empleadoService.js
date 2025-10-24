import api from '../api/axiosConfig';


// Servicio para Empleados
const empleadoService = {
  // Obtener todos los empleados
  getAll: async () => {
    const response = await api.get('/empleados');
    return response.data;
  },

  // Obtener un empleado por ID
  getById: async (id) => {
    const response = await api.get(`/empleados/${id}`);
    return response.data;
  },

  // Crear un nuevo empleado
  create: async (empleadoData) => {
    const response = await api.post('/empleados', empleadoData);
    return response.data;
  },

  // Actualizar un empleado
  update: async (id, empleadoData) => {
    const response = await api.put(`/empleados/${id}`, empleadoData);
    return response.data;
  },

  // Desactivar un empleado
  deactivate: async (id) => {
    const response = await api.patch(`/empleados/${id}/desactivar`);
    return response.data;
  },

  // Activar un empleado
  activate: async (id) => {
    const response = await api.patch(`/empleados/${id}/activar`);
    return response.data;
  }
};

export default empleadoService;
