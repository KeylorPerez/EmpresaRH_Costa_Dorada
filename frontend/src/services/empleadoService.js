import api from '../api/axiosConfig';

const empleadoService = {
  getAll: async () => {
    const response = await api.get('/empleados');
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/empleados/${id}`);
    return response.data;
  },

  create: async (empleadoData) => {
    const response = await api.post('/empleados', empleadoData);
    return response.data;
  },

  update: async (id, empleadoData) => {
    const response = await api.put(`/empleados/${id}`, empleadoData);
    return response.data;
  },

  deactivate: async (id) => {
    const response = await api.patch(`/empleados/${id}/desactivar`);
    return response.data;
  },

  activate: async (id) => {
    const response = await api.patch(`/empleados/${id}/activar`);
    return response.data;
  }
};

export default empleadoService;
