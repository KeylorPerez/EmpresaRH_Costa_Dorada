import { useEffect, useMemo, useState } from "react";
import usuarioService from "../services/usuarioService";
import empleadoService from "../services/empleadoService";

const createInitialFormState = () => ({
  username: "",
  password: "",
  id_rol: "",
  id_empleado: "",
  estado: "1",
});

export const useUsuario = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState(null);
  const [formData, setFormData] = useState(() => createInitialFormState());

  useEffect(() => {
    fetchUsuarios();
    fetchEmpleados();
  }, []);

  const fetchUsuarios = async () => {
    try {
      setLoading(true);
      const data = await usuarioService.getAll();
      setUsuarios(data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpleados = async () => {
    try {
      const data = await empleadoService.getAll();
      setEmpleados(data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(createInitialFormState());
    setEditingUsuario(null);
    setError("");
  };

  const buildPayload = () => {
    const payload = {
      username: formData.username,
      id_rol: formData.id_rol ? Number(formData.id_rol) : undefined,
      id_empleado: formData.id_empleado ? Number(formData.id_empleado) : undefined,
      estado: Number(formData.estado),
    };

    if (formData.password) {
      payload.password = formData.password;
    }

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!formData.username || !formData.id_rol || !formData.id_empleado) {
        setError("Por favor completa todos los campos obligatorios");
        return;
      }

      const payload = buildPayload();

      if (!editingUsuario && !payload.password) {
        setError("La contraseña es requerida para crear un usuario");
        return;
      }

      if (editingUsuario) {
        await usuarioService.update(editingUsuario.id_usuario, payload);
      } else {
        await usuarioService.create(payload);
      }

      setModalOpen(false);
      resetForm();
      await fetchUsuarios();
    } catch (err) {
      console.error(err);
      setError("Error al guardar usuario");
    }
  };

  const handleEdit = (usuario) => {
    setEditingUsuario(usuario);
    setError("");
    setFormData({
      username: usuario.username || "",
      password: "",
      id_rol: usuario.id_rol ? String(usuario.id_rol) : "",
      id_empleado: usuario.id_empleado ? String(usuario.id_empleado) : "",
      estado:
        usuario.estado === undefined || usuario.estado === null
          ? "1"
          : String(Number(usuario.estado)),
    });
    setModalOpen(true);
  };

  const handleChangeStatus = async (id, estado) => {
    try {
      await usuarioService.changeStatus(id, estado);
      await fetchUsuarios();
    } catch (err) {
      console.error(err);
      setError("Error al actualizar estado del usuario");
    }
  };

  const rolesOptions = useMemo(
    () => [
      { value: "1", label: "Administrador" },
      { value: "2", label: "Empleado" },
    ],
    []
  );

  return {
    usuarios,
    empleados,
    rolesOptions,
    loading,
    error,
    modalOpen,
    setModalOpen,
    editingUsuario,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    handleChangeStatus,
    resetForm,
    setError,
  };
};
