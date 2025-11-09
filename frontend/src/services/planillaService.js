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

  getDetalle: async (id) => {
    const response = await api.get(`/planilla/${id}/detalle`);
    return response.data;
  },

  getAttendanceSummary: async ({ id_empleado, periodo_inicio, periodo_fin }) => {
    const response = await api.get("/planilla/asistencia", {
      params: { id_empleado, periodo_inicio, periodo_fin },
    });
    return response.data;
  },

  update: async (id, payload) => {
    const response = await api.put(`/planilla/${id}`, payload);
    return response.data;
  },

  exportFile: async (id, format = 'pdf') => {
    const response = await api.get(`/planilla/${id}/export`, {
      params: { format },
    });
    return response.data;
  },
};

export default planillaService;
