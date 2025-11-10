import api from "../api/axiosConfig";

const aguinaldoService = {
  getAll: async () => {
    const response = await api.get("/aguinaldos");
    return response.data;
  },
  calcular: async (payload) => {
    const response = await api.post("/aguinaldos/calcular", payload);
    return response.data;
  },
  actualizarPago: async (id, pagado) => {
    const response = await api.put(`/aguinaldos/${id}/pago`, { pagado });
    return response.data;
  },
};

export default aguinaldoService;
