import { useCallback, useEffect, useMemo, useState } from "react";
import aguinaldoService from "../services/aguinaldoService";
import empleadoService from "../services/empleadoService";
import { formatDateValue } from "../utils/dateUtils";
import { useAuth } from "./useAuth";

const currentYear = () => new Date().getFullYear().toString();

const createInitialForm = () => ({
  id_empleado: "",
  anio: currentYear(),
});

export const formatearMontoCRC = (value) => {
  if (value === undefined || value === null || value === "") {
    return "₡0.00";
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }
  return numeric.toLocaleString("es-CR", {
    style: "currency",
    currency: "CRC",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 2,
  });
};

export const formatearFechaCorta = (value) => formatDateValue(value);

export const useAguinaldos = ({ autoFetch = true } = {}) => {
  const { user } = useAuth();
  const isAdmin = user?.id_rol === 1;

  const [aguinaldos, setAguinaldos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [empleadosLoading, setEmpleadosLoading] = useState(false);
  const [loading, setLoading] = useState(autoFetch);
  const [submitting, setSubmitting] = useState(false);
  const [actionLoading, setActionLoading] = useState({});
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formData, setFormData] = useState(() => createInitialForm());

  const fetchAguinaldos = useCallback(async () => {
    try {
      setLoading(true);
      const data = await aguinaldoService.getAll();
      setAguinaldos(Array.isArray(data) ? data : []);
      setError("");
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible cargar los aguinaldos";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFetch) {
      fetchAguinaldos();
    }
  }, [autoFetch, fetchAguinaldos]);

  const fetchEmpleados = useCallback(async () => {
    if (!isAdmin) return;
    try {
      setEmpleadosLoading(true);
      const data = await empleadoService.getAll();
      setEmpleados(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible cargar los empleados";
      setError((prev) => prev || message);
    } finally {
      setEmpleadosLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchEmpleados();
    }
  }, [isAdmin, fetchEmpleados]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const resetForm = (anioValue) => {
    setFormData({ id_empleado: "", anio: anioValue ?? currentYear() });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccessMessage("");

    const empleadoId = Number(formData.id_empleado);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      setError("Selecciona el colaborador");
      return;
    }

    const anioNumero = Number(formData.anio);
    if (!Number.isInteger(anioNumero) || anioNumero < 2000) {
      setError("Ingresa un año válido");
      return;
    }

    try {
      setSubmitting(true);
      const response = await aguinaldoService.calcular({
        id_empleado: empleadoId,
        anio: anioNumero,
      });
      const message = response?.message || "Aguinaldo calculado correctamente";
      setSuccessMessage(message);
      const anioPersistir = formData.anio;
      resetForm(anioPersistir);
      await fetchAguinaldos();
    } catch (err) {
      console.error(err);
      const message = err.response?.data?.error || "No fue posible calcular el aguinaldo";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const markAsPaid = useCallback(
    async (id, pagado) => {
      setActionLoading((prev) => ({ ...prev, [id]: true }));
      setError("");
      setSuccessMessage("");
      try {
        const response = await aguinaldoService.actualizarPago(id, pagado);
        const message = response?.message || "Estado de pago actualizado";
        setSuccessMessage(message);
        await fetchAguinaldos();
      } catch (err) {
        console.error(err);
        const message = err.response?.data?.error || "No fue posible actualizar el estado de pago";
        setError(message);
        throw err;
      } finally {
        setActionLoading((prev) => ({ ...prev, [id]: false }));
      }
    },
    [fetchAguinaldos]
  );

  const sortedAguinaldos = useMemo(() => {
    return [...aguinaldos].sort((a, b) => {
      const anioA = Number(a.anio) || 0;
      const anioB = Number(b.anio) || 0;
      if (anioA !== anioB) {
        return anioB - anioA;
      }
      const nombreA = `${a.nombre || ""} ${a.apellido || ""}`.trim().toLowerCase();
      const nombreB = `${b.nombre || ""} ${b.apellido || ""}`.trim().toLowerCase();
      if (nombreA < nombreB) return -1;
      if (nombreA > nombreB) return 1;
      return 0;
    });
  }, [aguinaldos]);

  return {
    aguinaldos: sortedAguinaldos,
    empleados,
    empleadosLoading,
    loading,
    submitting,
    actionLoading,
    error,
    successMessage,
    formData,
    handleChange,
    handleSubmit,
    resetForm,
    markAsPaid,
    isAdmin,
    setError,
    setSuccessMessage,
  };
};
