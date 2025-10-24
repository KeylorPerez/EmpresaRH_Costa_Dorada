import React, { useEffect, useState } from 'react';
import empleadoService from '../services/empleadoService';
import { useAuth } from '../context/useAuth';


const Empleados = () => {
  const { user } = useAuth(); // Datos del usuario logueado
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState(null);
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    id_puesto: '',
    cedula: '',
    fecha_nacimiento: '',
    telefono: '',
    email: '',
    fecha_ingreso: '',
    salario_base: ''
  });

  useEffect(() => {
    console.log('Usuario logueado:', user);
    fetchEmpleados();
  }, []);

  const fetchEmpleados = async () => {
    try {
      setLoading(true);
      const data = await empleadoService.getAll();
      console.log('Empleados recibidos:', data);
      setEmpleados(data || []);
    } catch (err) {
      console.error(err);
      setError('Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmpleado) {
        await empleadoService.update(editingEmpleado.id_empleado, formData);
      } else {
        await empleadoService.create(formData);
      }
      setModalOpen(false);
      setEditingEmpleado(null);
      setFormData({
        nombre: '',
        apellido: '',
        id_puesto: '',
        cedula: '',
        fecha_nacimiento: '',
        telefono: '',
        email: '',
        fecha_ingreso: '',
        salario_base: ''
      });
      fetchEmpleados();
    } catch (err) {
      console.error(err);
      setError('Error al guardar empleado');
    }
  };

  const handleEdit = (empleado) => {
    setEditingEmpleado(empleado);
    setFormData({
      nombre: empleado.nombre || '',
      apellido: empleado.apellido || '',
      id_puesto: empleado.id_puesto || '',
      cedula: empleado.cedula || '',
      fecha_nacimiento: empleado.fecha_nacimiento || '',
      telefono: empleado.telefono || '',
      email: empleado.email || '',
      fecha_ingreso: empleado.fecha_ingreso || '',
      salario_base: empleado.salario_base || ''
    });
    setModalOpen(true);
  };

  const handleDeactivate = async (id) => {
    try {
      await empleadoService.deactivate(id);
      fetchEmpleados();
    } catch (err) {
      console.error(err);
      setError('Error al desactivar empleado');
    }
  };

  const handleActivate = async (id) => {
    try {
      await empleadoService.activate(id);
      fetchEmpleados();
    } catch (err) {
      console.error(err);
      setError('Error al activar empleado');
    }
  };

  // Verificación de rol más flexible
  if (!user) return <p>Cargando usuario...</p>;
  if (user.id_rol !== 1) return <p>No tienes permisos para ver esta página.</p>;

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Empleados</h1>

      {error && <p className="text-red-500">{error}</p>}

      <button
        onClick={() => { setModalOpen(true); setEditingEmpleado(null); }}
        className="bg-blue-500 text-white px-4 py-2 rounded mb-4"
      >
        Agregar Empleado
      </button>

      {loading ? (
        <p>Cargando empleados...</p>
      ) : (
        <table className="w-full border-collapse border">
          <thead>
            <tr className="bg-gray-200">
              <th className="border px-2 py-1">Nombre</th>
              <th className="border px-2 py-1">Apellido</th>
              <th className="border px-2 py-1">Cédula</th>
              <th className="border px-2 py-1">Puesto</th>
              <th className="border px-2 py-1">Salario Base</th>
              <th className="border px-2 py-1">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {empleados.map(emp => (
              <tr key={emp.id_empleado}>
                <td className="border px-2 py-1">{emp.nombre}</td>
                <td className="border px-2 py-1">{emp.apellido}</td>
                <td className="border px-2 py-1">{emp.cedula}</td>
                <td className="border px-2 py-1">{emp.id_puesto}</td>
                <td className="border px-2 py-1">{emp.salario_base}</td>
                <td className="border px-2 py-1 space-x-1">
                  <button
                    onClick={() => handleEdit(emp)}
                    className="bg-yellow-500 text-white px-2 py-1 rounded"
                  >
                    Editar
                  </button>
                  {emp.estado ? (
                    <button
                      onClick={() => handleDeactivate(emp.id_empleado)}
                      className="bg-red-500 text-white px-2 py-1 rounded"
                    >
                      Desactivar
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivate(emp.id_empleado)}
                      className="bg-green-500 text-white px-2 py-1 rounded"
                    >
                      Activar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {empleados.length === 0 && (
              <tr>
                <td colSpan="6" className="text-center p-2">No hay empleados disponibles</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-30 flex justify-center items-center">
          <div className="bg-white p-6 rounded w-96">
            <h2 className="text-lg font-bold mb-4">
              {editingEmpleado ? 'Editar Empleado' : 'Agregar Empleado'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-2">
              <input type="text" name="nombre" value={formData.nombre} onChange={handleChange} placeholder="Nombre" className="w-full border px-2 py-1 rounded" required />
              <input type="text" name="apellido" value={formData.apellido} onChange={handleChange} placeholder="Apellido" className="w-full border px-2 py-1 rounded" required />
              <input type="text" name="id_puesto" value={formData.id_puesto} onChange={handleChange} placeholder="ID Puesto" className="w-full border px-2 py-1 rounded" required />
              <input type="text" name="cedula" value={formData.cedula} onChange={handleChange} placeholder="Cédula" className="w-full border px-2 py-1 rounded" required />
              <input type="date" name="fecha_nacimiento" value={formData.fecha_nacimiento || ''} onChange={handleChange} className="w-full border px-2 py-1 rounded" />
              <input type="text" name="telefono" value={formData.telefono || ''} onChange={handleChange} placeholder="Teléfono" className="w-full border px-2 py-1 rounded" />
              <input type="email" name="email" value={formData.email || ''} onChange={handleChange} placeholder="Email" className="w-full border px-2 py-1 rounded" />
              <input type="date" name="fecha_ingreso" value={formData.fecha_ingreso || ''} onChange={handleChange} className="w-full border px-2 py-1 rounded" required />
              <input type="number" step="0.01" name="salario_base" value={formData.salario_base || ''} onChange={handleChange} placeholder="Salario Base" className="w-full border px-2 py-1 rounded" required />
              <div className="flex justify-end space-x-2 mt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 rounded border">Cancelar</button>
                <button type="submit" className="px-4 py-2 rounded bg-blue-500 text-white">{editingEmpleado ? 'Actualizar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Empleados;
