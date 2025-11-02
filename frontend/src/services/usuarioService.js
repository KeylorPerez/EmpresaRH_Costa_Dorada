import api from "../api/axiosConfig";

const usuarioService = {
  getAll: async () => {
    const response = await api.get("/usuarios");
    return response.data;
  },

  create: async (usuarioData) => {
    const response = await api.post("/usuarios", usuarioData);
    return response.data;
  },

  update: async (id, usuarioData) => {
    const response = await api.put(`/usuarios/${id}`, usuarioData);
    return response.data;
  },

  changeStatus: async (id, estado) => {
    const response = await api.patch(`/usuarios/${id}/estado`, { estado });
    return response.data;
  },
};

export default usuarioService;
