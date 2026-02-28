import api from "../api/axiosConfig";

const vacacionesService = {
  getAll: async () => {
    const response = await api.get("/vacaciones");
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post("/vacaciones", payload);
    return response.data;
  },

  approve: async (id, dias_aprobados) => {
    const response = await api.put(`/vacaciones/${id}/aprobar`, { dias_aprobados });
    return response.data;
  },

  reject: async (id) => {
    const response = await api.put(`/vacaciones/${id}/rechazar`);
    return response.data;
  },

  remove: async (id) => {
    const response = await api.delete(`/vacaciones/${id}`);
    return response.data;
  },

  exportPdf: async (id) => {
    const response = await api.get(`/vacaciones/${id}/export`);
    return response.data;
  },
};

export default vacacionesService;
