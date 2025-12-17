import api from "../api/axiosConfig";

const puestoService = {
  getAll: async () => {
    const response = await api.get("/puestos");
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post("/puestos", payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await api.put(`/puestos/${id}`, payload);
    return response.data;
  },
};

export default puestoService;
