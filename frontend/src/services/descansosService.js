import api from "../api/axiosConfig";

const descansosService = {
  getSummary: async ({ id_empleado, periodo_inicio, periodo_fin }) => {
    const response = await api.get("/descansos", {
      params: { id_empleado, periodo_inicio, periodo_fin },
    });
    return response.data;
  },
};

export default descansosService;
