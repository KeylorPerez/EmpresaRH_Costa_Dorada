/**
 * Controlador de días dobles. Expone consultas y administración del catálogo
 * de fechas con multiplicador especial para uso administrativo y operativo.
 */
const DiasDobles = require('../models/DiasDobles');

const isAdmin = (user) => Boolean(user && Number(user.id_rol) === 1);

const parseDateInput = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const parseMultiplicador = (value) => {
  const multiplicador = Number(value);
  if (!Number.isFinite(multiplicador) || multiplicador < 1) return null;
  return Number(multiplicador.toFixed(2));
};

const getDiasDobles = async (req, res) => {
  try {
    const soloActivos = req.query.activo === '1' || req.query.activo === 'true';
    const diasDobles = await DiasDobles.getAll({ soloActivos });
    res.json(diasDobles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDiaDobleByFecha = async (req, res) => {
  try {
    const { fecha } = req.params;
    if (!fecha) return res.status(400).json({ error: 'Fecha inválida' });

    const diaDoble = await DiasDobles.getByFecha(fecha);
    if (!diaDoble) {
      return res.status(404).json({ error: 'No existe día doble para la fecha indicada' });
    }

    res.json(diaDoble);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createDiaDoble = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Solo admin puede configurar días dobles' });
    }

    const fecha = parseDateInput(req.body?.fecha);
    const descripcion = (req.body?.descripcion || '').trim();
    const multiplicador = parseMultiplicador(req.body?.multiplicador ?? 2);
    const activo = req.body?.activo === undefined ? true : Boolean(req.body?.activo);

    if (!fecha) {
      return res.status(400).json({ error: 'La fecha es obligatoria y debe ser válida' });
    }

    if (!descripcion) {
      return res.status(400).json({ error: 'La descripción es obligatoria' });
    }

    if (multiplicador === null) {
      return res.status(400).json({ error: 'El multiplicador debe ser un número mayor o igual a 1' });
    }

    const existente = await DiasDobles.getByFecha(fecha);
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un día doble configurado para esa fecha' });
    }

    const creado = await DiasDobles.create({ fecha, descripcion, multiplicador, activo });
    return res.status(201).json(creado);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateDiaDoble = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Solo admin puede configurar días dobles' });
    }

    const idDiaDoble = Number(req.params.id);
    if (!Number.isInteger(idDiaDoble) || idDiaDoble <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const existenteById = await DiasDobles.getById(idDiaDoble);
    if (!existenteById) {
      return res.status(404).json({ error: 'Día doble no encontrado' });
    }

    const fecha = parseDateInput(req.body?.fecha);
    const descripcion = (req.body?.descripcion || '').trim();
    const multiplicador = parseMultiplicador(req.body?.multiplicador);
    const activo = Boolean(req.body?.activo);

    if (!fecha) {
      return res.status(400).json({ error: 'La fecha es obligatoria y debe ser válida' });
    }

    if (!descripcion) {
      return res.status(400).json({ error: 'La descripción es obligatoria' });
    }

    if (multiplicador === null) {
      return res.status(400).json({ error: 'El multiplicador debe ser un número mayor o igual a 1' });
    }

    const existenteByFecha = await DiasDobles.getByFecha(fecha);
    if (existenteByFecha && existenteByFecha.id_dia_doble !== idDiaDoble) {
      return res.status(409).json({ error: 'Ya existe otro día doble configurado para esa fecha' });
    }

    const actualizado = await DiasDobles.update(idDiaDoble, {
      fecha,
      descripcion,
      multiplicador,
      activo,
    });

    return res.json(actualizado);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteDiaDoble = async (req, res) => {
  try {
    if (!isAdmin(req.user)) {
      return res.status(403).json({ error: 'Solo admin puede configurar días dobles' });
    }

    const idDiaDoble = Number(req.params.id);
    if (!Number.isInteger(idDiaDoble) || idDiaDoble <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const deleted = await DiasDobles.remove(idDiaDoble);
    if (!deleted) {
      return res.status(404).json({ error: 'Día doble no encontrado' });
    }

    return res.json({ message: 'Día doble eliminado correctamente' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getDiasDobles,
  getDiaDobleByFecha,
  createDiaDoble,
  updateDiaDoble,
  deleteDiaDoble,
};
