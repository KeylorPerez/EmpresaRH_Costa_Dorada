import { useState, useEffect } from "react";
import empleadoService from "../services/empleadoService";

const INITIAL_FORM_DATA = {
  nombre: "",
  apellido: "",
  id_puesto: "",
  cedula: "",
  fecha_nacimiento: "",
  telefono: "",
  email: "",
  fecha_ingreso: "",
  salario_base: "",
};

export const useEmpleado = () => {
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  useEffect(() => {
    fetchEmpleados();
  }, []);

  const fetchEmpleados = async () => {
    try {
      setLoading(true);
      const data = await empleadoService.getAll();
      setEmpleados(data || []);
    } catch (err) {
      console.error(err);
      setError("Error al cargar empleados");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      resetForm();
      fetchEmpleados();
    } catch (err) {
      console.error(err);
      setError("Error al guardar empleado");
    }
  };

  const handleEdit = (empleado) => {
    setEditingEmpleado(empleado);
    setFormData({
      nombre: empleado.nombre || "",
      apellido: empleado.apellido || "",
      id_puesto: empleado.id_puesto || "",
      cedula: empleado.cedula || "",
      fecha_nacimiento: empleado.fecha_nacimiento || "",
      telefono: empleado.telefono || "",
      email: empleado.email || "",
      fecha_ingreso: empleado.fecha_ingreso || "",
      salario_base: empleado.salario_base || "",
    });
    setModalOpen(true);
  };

  const resetForm = () => {
    setFormData(INITIAL_FORM_DATA);
    setEditingEmpleado(null);
    setError("");
  };

  const handleDeactivate = async (id) => {
    try {
      await empleadoService.deactivate(id);
      fetchEmpleados();
    } catch (err) {
      console.error(err);
      setError("Error al desactivar empleado");
    }
  };

  const handleActivate = async (id) => {
    try {
      await empleadoService.activate(id);
      fetchEmpleados();
    } catch (err) {
      console.error(err);
      setError("Error al activar empleado");
    }
  };

  return {
    empleados,
    loading,
    error,
    modalOpen,
    setModalOpen,
    editingEmpleado,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    handleDeactivate,
    handleActivate,
    resetForm,
    fetchEmpleados,
  };
};
