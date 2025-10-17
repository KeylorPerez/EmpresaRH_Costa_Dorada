import api from '../api/axiosConfig';

export const getEmpleados = async () => {
  const response = await api.get('/empleados');
  return response.data;
};

export const createEmpleado = async (data) => {
  const response = await api.post('/empleados', data);
  return response.data;
};
