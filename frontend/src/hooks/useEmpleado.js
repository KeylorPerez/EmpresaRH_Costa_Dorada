import { useState, useEffect } from "react";
import empleadoService from "../services/empleadoService";
import puestoService from "../services/puestoService";

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
  estado: "1",
};

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
  const [puestos, setPuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);

  useEffect(() => {
    fetchEmpleados();
    fetchPuestos();
  }, []);

  const fetchEmpleados = async () => {
    try {
      setLoading(true);
      const data = await empleadoService.getAll();
      setEmpleados(data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Error al cargar empleados");
    } finally {
      setLoading(false);
    }
  };

  const fetchPuestos = async () => {
    try {
      const data = await puestoService.getAll();
      setPuestos(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (
        !formData.nombre ||
        !formData.apellido ||
        !formData.id_puesto ||
        !formData.cedula ||
        !formData.fecha_ingreso ||
        !formData.salario_base
      ) {
        setError("Por favor completa los campos obligatorios");
        return;
      }

      const payload = {
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        id_puesto: Number(formData.id_puesto),
        cedula: formData.cedula.trim(),
        fecha_ingreso: formData.fecha_ingreso,
        salario_base: Number(formData.salario_base),
      };

      if (formData.fecha_nacimiento) {
        payload.fecha_nacimiento = formData.fecha_nacimiento;
      }

      if (formData.telefono) {
        payload.telefono = formData.telefono.trim();
      }

      if (formData.email) {
        payload.email = formData.email.trim();
      }

      if (editingEmpleado) {
        payload.estado = Number(formData.estado);
      }

      if (editingEmpleado) {
        await empleadoService.update(editingEmpleado.id_empleado, payload);
      } else {
        await empleadoService.create(payload);
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
      id_puesto: empleado.id_puesto ? String(empleado.id_puesto) : "",
      cedula: empleado.cedula || "",
      fecha_nacimiento: normalizeDate(empleado.fecha_nacimiento),
      telefono: empleado.telefono || "",
      email: empleado.email || "",
      fecha_ingreso: normalizeDate(empleado.fecha_ingreso),
      salario_base:
        empleado.salario_base !== undefined && empleado.salario_base !== null
          ? String(empleado.salario_base)
          : "",
      estado:
        empleado.estado !== undefined && empleado.estado !== null
          ? String(Number(empleado.estado))
          : "0",
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
    puestos,
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
    setError,
  };
};

const normalizeDate = (value) => {
  if (!value) return "";
  return value.split("T")[0];
};
