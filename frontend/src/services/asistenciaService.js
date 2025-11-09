import api from "../api/axiosConfig";

const asistenciaService = {
  getAll: async () => {
    const response = await api.get("/asistencia");
    return response.data;
  },

  getByRange: async (start, end, id_empleado) => {
    const params = { start, end };
    if (id_empleado) {
      params.id_empleado = id_empleado;
    }
    const response = await api.get("/asistencia/range", { params });
    return response.data;
  },

  exportByRange: async ({ start, end, id_empleado, format }) => {
    const params = { start, end };
    if (id_empleado) {
      params.id_empleado = id_empleado;
    }
    if (format) {
      params.format = format;
    }

    const response = await api.get("/asistencia/export", {
      params,
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

  createJustificacionSolicitud: async (id_asistencia, payload) => {
    const response = await api.post(`/asistencia/${id_asistencia}/justificaciones`, payload);
    return response.data;
  },

  resolverJustificacionSolicitud: async (id_solicitud, payload) => {
    const response = await api.patch(`/asistencia/justificaciones/${id_solicitud}`, payload);
    return response.data;
  },
};

export default asistenciaService;
