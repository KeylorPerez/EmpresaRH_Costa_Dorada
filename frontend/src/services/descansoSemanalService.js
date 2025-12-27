import api from "../api/axiosConfig";

const descansoSemanalService = {
  getByEmpleado: async (idEmpleado) => {
    const response = await api.get(`/descansos/empleado/${idEmpleado}`);
    return response.data;
  },
};

export default descansoSemanalService;
