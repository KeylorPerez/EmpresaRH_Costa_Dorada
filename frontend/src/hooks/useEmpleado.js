import { useState, useEffect } from "react";
import empleadoService from "../services/empleadoService";
import puestoService from "../services/puestoService";

const createEmptyFormData = () => ({
  nombre: "",
  apellido: "",
  id_puesto: "",
  cedula: "",
  fecha_nacimiento: "",
  telefono: "",
  email: "",
  fecha_ingreso: "",
  salario_monto: "",
  tipo_pago: "Diario",
  bonificacion_fija: "0",
  porcentaje_ccss: "9.34",
  usa_deduccion_fija: "0",
  deduccion_fija: "0",
  permitir_marcacion_fuera: "0",
  estado: "1", // 👈 por defecto activo
});

export const useEmpleado = () => {
  const [empleados, setEmpleados] = useState([]);
  const [puestos, setPuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmpleado, setEditingEmpleado] = useState(null);
  const [formData, setFormData] = useState(() => createEmptyFormData());

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
    setFormData((prev) => {
      if (name === "usa_deduccion_fija" && value !== "1") {
        return { ...prev, [name]: value, deduccion_fija: "0" };
      }
      return { ...prev, [name]: value };
    });
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
        !formData.salario_monto ||
        !formData.tipo_pago
      ) {
        setError("Por favor completa los campos obligatorios");
        return;
      }

      const bonificacionValue = Number(formData.bonificacion_fija || 0);
      if (Number.isNaN(bonificacionValue)) {
        setError("La bonificación fija debe ser un número válido");
        return;
      }

      const porcentajeValue = Number(
        formData.porcentaje_ccss === ""
          ? 9.34
          : formData.porcentaje_ccss
      );
      if (Number.isNaN(porcentajeValue) || porcentajeValue < 0) {
        setError("El porcentaje de CCSS debe ser un número válido");
        return;
      }

      const usaDeduccionFija = formData.usa_deduccion_fija === "1";
      const deduccionFijaValue = Number(formData.deduccion_fija || 0);
      if (Number.isNaN(deduccionFijaValue) || deduccionFijaValue < 0) {
        setError("La deducción fija debe ser un número válido");
        return;
      }

      const payload = {
        nombre: formData.nombre.trim(),
        apellido: formData.apellido.trim(),
        id_puesto: Number(formData.id_puesto),
        cedula: formData.cedula.trim(),
        fecha_ingreso: formData.fecha_ingreso,
        salario_monto: Number(formData.salario_monto),
        tipo_pago: formData.tipo_pago,
        bonificacion_fija: bonificacionValue,
        porcentaje_ccss: porcentajeValue,
        usa_deduccion_fija: usaDeduccionFija ? 1 : 0,
        deduccion_fija: usaDeduccionFija ? deduccionFijaValue : 0,
        permitir_marcacion_fuera: formData.permitir_marcacion_fuera === "1" ? 1 : 0,
      };

      if (formData.fecha_nacimiento) payload.fecha_nacimiento = formData.fecha_nacimiento;
      if (formData.telefono) payload.telefono = formData.telefono.trim();
      if (formData.email) payload.email = formData.email.trim();
      if (editingEmpleado) payload.estado = Number(formData.estado);

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
      salario_monto:
        empleado.salario_monto !== undefined && empleado.salario_monto !== null
          ? String(empleado.salario_monto)
          : "",
      tipo_pago: empleado.tipo_pago || "Diario",
      bonificacion_fija:
        empleado.bonificacion_fija !== undefined && empleado.bonificacion_fija !== null
          ? String(empleado.bonificacion_fija)
          : "0",
      porcentaje_ccss:
        empleado.porcentaje_ccss !== undefined && empleado.porcentaje_ccss !== null
          ? String(empleado.porcentaje_ccss)
          : "9.34",
      usa_deduccion_fija:
        empleado.usa_deduccion_fija !== undefined && empleado.usa_deduccion_fija !== null
          ? String(Number(Boolean(empleado.usa_deduccion_fija)))
          : "0",
      deduccion_fija:
        empleado.deduccion_fija !== undefined && empleado.deduccion_fija !== null
          ? String(empleado.deduccion_fija)
          : "0",
      permitir_marcacion_fuera:
        empleado.permitir_marcacion_fuera !== undefined && empleado.permitir_marcacion_fuera !== null
          ? String(Number(Boolean(empleado.permitir_marcacion_fuera)))
          : "0",
      estado:
        empleado.estado !== undefined && empleado.estado !== null
          ? String(Number(empleado.estado))
          : "0",
    });
    setModalOpen(true);
  };

  const resetForm = () => {
    setFormData(createEmptyFormData());
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

