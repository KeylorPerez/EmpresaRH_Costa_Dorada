import api from "../api/axiosConfig";

const aguinaldoService = {
  getAll: async () => {
    const response = await api.get("/aguinaldos");
    return response.data;
  },
  previsualizar: async (payload) => {
    const response = await api.post("/aguinaldos/previsualizar", payload);
    return response.data;
  },
  calcular: async (payload) => {
    const response = await api.post("/aguinaldos/calcular", payload);
    return response.data;
  },
  actualizar: async (id, payload) => {
    const response = await api.put(`/aguinaldos/${id}`, payload);
    return response.data;
  },
  actualizarPago: async (id, pagado) => {
    const response = await api.put(`/aguinaldos/${id}/pago`, { pagado });
    return response.data;
  },
  exportPdf: async (id) => {
    const response = await api.get(`/aguinaldos/${id}/export`);
    return response.data;
  },
};

export default aguinaldoService;
