import api from "../api/axiosConfig";

const liquidacionesService = {
  getAll: async () => {
    const response = await api.get("/liquidaciones");
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post("/liquidaciones", payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await api.put(`/liquidaciones/${id}`, payload);
    return response.data;
  },
};

export default liquidacionesService;
