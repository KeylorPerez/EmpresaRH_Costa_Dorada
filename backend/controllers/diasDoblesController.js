/**
 * Controlador de días dobles. Administra la configuración de feriados y días
 * especiales aplicados automáticamente en planillas.
 */
const DiasDobles = require('../models/DiasDobles');

const parseMultiplicador = (valor, { required = false } = {}) => {
  if (valor === undefined || valor === null || valor === '') {
    return required ? null : null;
  }
  const numero = Number(valor);
  if (!Number.isFinite(numero) || numero < 1) {
    return null;
  }
  return Number(numero.toFixed(2));
};

const getDiasDobles = async (req, res) => {
  try {
    const dias = await DiasDobles.getAll();
    return res.json(dias);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getDiaDobleById = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const dia = await DiasDobles.getById(id);
    if (!dia) {
      return res.status(404).json({ error: 'Día doble no encontrado' });
    }

    return res.json(dia);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createDiaDoble = async (req, res) => {
  try {
    const { fecha, descripcion, multiplicador, activo } = req.body;

    if (!fecha || !descripcion) {
      return res.status(400).json({ error: 'fecha y descripcion son requeridos' });
    }

    const multiplicadorFinal = parseMultiplicador(multiplicador, { required: false }) ?? 2;
    if (multiplicadorFinal === null) {
      return res.status(400).json({ error: 'multiplicador debe ser un número mayor o igual a 1' });
    }

    const dia = await DiasDobles.create({
      fecha,
      descripcion: String(descripcion).trim(),
      multiplicador: multiplicadorFinal,
      activo: activo !== undefined ? Boolean(activo) : true,
    });

    return res.status(201).json({
      message: 'Día doble creado correctamente',
      id_dia_doble: dia?.id_dia_doble,
    });
  } catch (err) {
    if (String(err.message).includes('UQ_DiasDobles_Fecha')) {
      return res.status(409).json({ error: 'Ya existe un día doble registrado para esa fecha' });
    }
    if (String(err.message).includes('CK_DiasDobles_Multiplicador')) {
      return res.status(400).json({ error: 'El multiplicador debe ser mayor o igual a 1' });
    }
    return res.status(500).json({ error: err.message });
  }
};

const updateDiaDoble = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { fecha, descripcion, multiplicador, activo } = req.body;
    const multiplicadorFinal = multiplicador !== undefined
      ? parseMultiplicador(multiplicador, { required: false })
      : null;

    if (multiplicador !== undefined && multiplicadorFinal === null) {
      return res.status(400).json({ error: 'multiplicador debe ser un número mayor o igual a 1' });
    }

    const updated = await DiasDobles.update(id, {
      fecha: fecha || null,
      descripcion: descripcion !== undefined ? String(descripcion).trim() : null,
      multiplicador: multiplicadorFinal,
      activo,
    });

    if (!updated) {
      return res.status(404).json({ error: 'Día doble no encontrado' });
    }

    return res.json({ message: 'Día doble actualizado correctamente' });
  } catch (err) {
    if (String(err.message).includes('UQ_DiasDobles_Fecha')) {
      return res.status(409).json({ error: 'Ya existe un día doble registrado para esa fecha' });
    }
    if (String(err.message).includes('CK_DiasDobles_Multiplicador')) {
      return res.status(400).json({ error: 'El multiplicador debe ser mayor o igual a 1' });
    }
    return res.status(500).json({ error: err.message });
  }
};

const deleteDiaDoble = async (req, res) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    await DiasDobles.remove(id);
    return res.json({ message: 'Día doble eliminado correctamente' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getDiasDobles,
  getDiaDobleById,
  createDiaDoble,
  updateDiaDoble,
  deleteDiaDoble,
};
