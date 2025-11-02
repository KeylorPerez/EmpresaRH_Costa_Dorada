import api from "../api/axiosConfig";

const planillaService = {
  getAll: async () => {
    const response = await api.get("/planilla");
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post("/planilla", payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await api.put(`/planilla/${id}`, payload);
    return response.data;
  },
};

export default planillaService;
