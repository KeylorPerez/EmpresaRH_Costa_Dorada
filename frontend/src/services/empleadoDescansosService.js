import api from "../api/axiosConfig";

const empleadoDescansosService = {
  getAll: async ({ id_empleado, estado } = {}) => {
    const response = await api.get("/empleado-descansos", {
      params: {
        ...(id_empleado ? { id_empleado } : {}),
        ...(estado === undefined ? {} : { estado: estado ? 1 : 0 }),
      },
    });
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post("/empleado-descansos", payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await api.put(`/empleado-descansos/${id}`, payload);
    return response.data;
  },

  remove: async (id) => {
    const response = await api.delete(`/empleado-descansos/${id}`);
    return response.data;
  },

  validarFecha: async (idEmpleado, fecha) => {
    const response = await api.get(`/empleado-descansos/validar/${idEmpleado}/${fecha}`);
    return response.data;
  },
};

export default empleadoDescansosService;
