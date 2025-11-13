import api from "../api/axiosConfig";

const liquidacionesService = {
  getAll: async () => {
    const response = await api.get("/liquidaciones");
    return response.data;
  },

  getById: async (id) => {
    const response = await api.get(`/liquidaciones/${id}`);
    return response.data;
  },

  preview: async (payload) => {
    const response = await api.post("/liquidaciones/previsualizar", payload);
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

  exportPdf: async (id) => {
    const response = await api.get(`/liquidaciones/${id}/export`);
    return response.data;
  },
};

export default liquidacionesService;
