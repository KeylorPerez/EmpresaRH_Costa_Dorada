import api from "../api/axiosConfig";

const diasDoblesService = {
  getAll: async ({ activo } = {}) => {
    const response = await api.get("/dias-dobles", {
      params: activo === undefined ? undefined : { activo: activo ? 1 : 0 },
    });
    return response.data;
  },

  create: async (payload) => {
    const response = await api.post("/dias-dobles", payload);
    return response.data;
  },

  update: async (id, payload) => {
    const response = await api.put(`/dias-dobles/${id}`, payload);
    return response.data;
  },

  remove: async (id) => {
    const response = await api.delete(`/dias-dobles/${id}`);
    return response.data;
  },
};

export default diasDoblesService;
