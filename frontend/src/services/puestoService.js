import api from "../api/axiosConfig";

const puestoService = {
  getAll: async () => {
    const response = await api.get("/puestos");
    return response.data;
  },
};

export default puestoService;
