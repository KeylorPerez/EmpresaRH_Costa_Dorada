import { useEffect, useState } from "react";
import puestoService from "../services/puestoService";

const createEmptyForm = () => ({
  nombre: "",
});

export const usePuesto = () => {
  const [puestos, setPuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPuesto, setEditingPuesto] = useState(null);
  const [formData, setFormData] = useState(() => createEmptyForm());

  useEffect(() => {
    fetchPuestos();
  }, []);

  const fetchPuestos = async () => {
    try {
      setLoading(true);
      const data = await puestoService.getAll();
      setPuestos(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Error al cargar los puestos");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
    setEditingPuesto(null);
    setFormData(createEmptyForm());
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.nombre.trim()) {
      setError("El nombre del puesto es obligatorio");
      return;
    }

    const payload = {
      nombre: formData.nombre.trim(),
    };

    try {
      if (editingPuesto) {
        await puestoService.update(editingPuesto.id_puesto, payload);
      } else {
        await puestoService.create(payload);
      }

      setModalOpen(false);
      setEditingPuesto(null);
      setFormData(createEmptyForm());
      setError("");
      fetchPuestos();
    } catch (err) {
      console.error(err);
      setError("Error al guardar el puesto");
    }
  };

  const handleEdit = (puesto) => {
    setEditingPuesto(puesto);
    setFormData({ nombre: puesto.nombre || "" });
    setError("");
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingPuesto(null);
    setFormData(createEmptyForm());
    setError("");
  };

  return {
    puestos,
    loading,
    error,
    modalOpen,
    setModalOpen,
    editingPuesto,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    openCreateModal,
    closeModal,
  };
};

export default usePuesto;
