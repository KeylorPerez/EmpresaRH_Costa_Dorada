import api from "../api/axiosConfig";

const prestamosService = {
  getAll: async () => {
    const response = await api.get("/prestamos");
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post("/prestamos", payload);
    return response.data;
  },

  updateEstado: async (id, estado) => {
    const response = await api.put(`/prestamos/${id}/estado`, estado);
    return response.data;
  },

  pagar: async (id, monto_pago) => {
    const response = await api.put(`/prestamos/${id}/pagar`, { monto_pago });
    return response.data;
  },

  exportPdf: async (id) => {
    const response = await api.get(`/prestamos/${id}/export`);
    return response.data;
  },
};

export default prestamosService;
