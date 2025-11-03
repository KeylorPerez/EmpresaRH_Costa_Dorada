import api from "../api/axiosConfig";

const asistenciaService = {
  getAll: async () => {
    const response = await api.get("/asistencia");
    return response.data;
  },

  getByRange: async (start, end) => {
    const response = await api.get("/asistencia/range", {
      params: { start, end },
    });
    return response.data;
  },

  createMarca: async (payload) => {
    const response = await api.post("/asistencia", payload);
    return response.data;
  },

  updateMarca: async (id, payload) => {
    const response = await api.put(`/asistencia/${id}`, payload);
    return response.data;
  },
};

export default asistenciaService;
