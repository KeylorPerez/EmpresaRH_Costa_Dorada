import { useEffect, useMemo, useState } from "react";
import planillaService from "../services/planillaService";
import empleadoService from "../services/empleadoService";

const createEmptyForm = (defaults = {}) => ({
  id_empleado: "",
  periodo_inicio: "",
  periodo_fin: "",
  horas_extras: "0",
  bonificaciones: "0",
  deducciones: "0",
  fecha_pago: "",
  ...defaults,
});

export const usePlanilla = () => {
  const [planillas, setPlanillas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlanilla, setEditingPlanilla] = useState(null);
  const [formData, setFormData] = useState(() => createEmptyForm(calculateQuincenaDefaults()));

  useEffect(() => {
    fetchPlanillas();
    fetchEmpleados();
  }, []);

  const fetchPlanillas = async () => {
    try {
      setLoading(true);
      const data = await planillaService.getAll();
      setPlanillas(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Error al cargar planillas");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmpleados = async () => {
    try {
      const data = await empleadoService.getAll();
      setEmpleados(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = () => {
    setFormData(createEmptyForm(calculateQuincenaDefaults()));
    setEditingPlanilla(null);
    setError("");
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const handleEdit = (planilla) => {
    setEditingPlanilla(planilla);
    setFormData({
      id_empleado: planilla.id_empleado ? String(planilla.id_empleado) : "",
      periodo_inicio: normalizeDate(planilla.periodo_inicio),
      periodo_fin: normalizeDate(planilla.periodo_fin),
      horas_extras: normalizeNumber(planilla.horas_extras),
      bonificaciones: normalizeNumber(planilla.bonificaciones),
      deducciones: normalizeNumber(planilla.deducciones),
      fecha_pago: normalizeDate(planilla.fecha_pago),
    });
    setError("");
    setModalOpen(true);
  };

  useEffect(() => {
    if (!modalOpen || editingPlanilla) return;
    if (!formData.id_empleado) return;

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === formData.id_empleado
    );

    if (!empleadoSeleccionado) return;

    const bonificacionDefault = empleadoSeleccionado.bonificacion_fija;

    if (bonificacionDefault === undefined || bonificacionDefault === null) return;

    const valorNormalizado = normalizeNumber(bonificacionDefault);

    setFormData((prev) => {
      if (prev.bonificaciones === valorNormalizado) {
        return prev;
      }

      return {
        ...prev,
        bonificaciones: valorNormalizado,
      };
    });
  }, [modalOpen, editingPlanilla, formData.id_empleado, empleados]);

  const buildNumber = (value) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setError("");

      if (!editingPlanilla) {
        if (!formData.id_empleado || !formData.periodo_inicio || !formData.periodo_fin) {
          setError("Selecciona empleado y periodo de pago");
          return;
        }

        if (new Date(formData.periodo_fin) < new Date(formData.periodo_inicio)) {
          setError("La fecha fin debe ser mayor o igual a la fecha inicio");
          return;
        }

        const payload = {
          id_empleado: Number(formData.id_empleado),
          periodo_inicio: formData.periodo_inicio,
          periodo_fin: formData.periodo_fin,
          horas_extras: buildNumber(formData.horas_extras),
          bonificaciones: buildNumber(formData.bonificaciones),
          deducciones: buildNumber(formData.deducciones),
          fecha_pago: formData.fecha_pago || null,
        };

        await planillaService.create(payload);
      } else {
        const payload = {
          horas_extras: buildNumber(formData.horas_extras),
          bonificaciones: buildNumber(formData.bonificaciones),
          deducciones: buildNumber(formData.deducciones),
          fecha_pago: formData.fecha_pago || null,
        };

        await planillaService.update(editingPlanilla.id_planilla, payload);
      }

      setModalOpen(false);
      resetForm();
      await fetchPlanillas();
    } catch (err) {
      console.error(err);
      setError("Error al guardar la planilla");
    }
  };

  const totals = useMemo(() => {
    const formatter = new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      minimumFractionDigits: 2,
    });

    const totalPago = planillas.reduce((sum, planilla) => sum + (Number(planilla.pago_neto) || 0), 0);

    return {
      totalPago: formatter.format(totalPago),
      cantidad: planillas.length,
    };
  }, [planillas]);

  return {
    planillas,
    empleados,
    loading,
    error,
    modalOpen,
    setModalOpen,
    editingPlanilla,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    openCreateModal,
    resetForm,
    fetchPlanillas,
    setError,
    totals,
  };
};

const normalizeDate = (value) => {
  if (!value) return "";
  return value.split("T")[0];
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined) return "0";
  return String(value);
};

const calculateQuincenaDefaults = () => {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();
  const dia = hoy.getDate();

  if (dia <= 15) {
    const inicio = new Date(anio, mes, 1);
    const fin = new Date(anio, mes, 15);
    const pago = new Date(anio, mes, 15);

    return {
      periodo_inicio: formatDateInput(inicio),
      periodo_fin: formatDateInput(fin),
      fecha_pago: formatDateInput(pago),
    };
  }

  const inicio = new Date(anio, mes, 16);
  const fin = new Date(anio, mes + 1, 0);

  return {
    periodo_inicio: formatDateInput(inicio),
    periodo_fin: formatDateInput(fin),
    fecha_pago: formatDateInput(fin),
  };
};

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};
