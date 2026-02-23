/**
 * Controlador de descansos por empleado. Expone operaciones CRUD para
 * administración y una verificación puntual de si una fecha es descanso.
 */
const EmpleadoDescansos = require('../models/EmpleadoDescansos');

const normalizeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const parseNullableDay = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const day = Number(value);
  if (!Number.isInteger(day) || day < 1 || day > 7) return null;
  return day;
};

const normalizePayload = (body = {}) => {
  const tipo_descanso = String(body.tipo_descanso || '').trim().toUpperCase();
  const id_empleado = Number(body.id_empleado);
  const fecha_inicio = normalizeDate(body.fecha_inicio);
  const fecha_fin = normalizeDate(body.fecha_fin);
  const dia_semana = parseNullableDay(body.dia_semana);
  const dia_semana_alterno = parseNullableDay(body.dia_semana_alterno);
  const estado = body.estado === undefined ? true : Boolean(body.estado);
  const observacion = body.observacion ? String(body.observacion).trim().slice(0, 200) : null;

  return {
    id_empleado,
    tipo_descanso,
    fecha_inicio,
    fecha_fin,
    dia_semana,
    dia_semana_alterno,
    estado,
    observacion,
  };
};

const validatePayload = (payload) => {
  if (!Number.isInteger(payload.id_empleado) || payload.id_empleado <= 0) {
    return 'El id_empleado es obligatorio y debe ser válido';
  }

  if (!EmpleadoDescansos.TIPOS_DESCANSO.includes(payload.tipo_descanso)) {
    return 'tipo_descanso inválido';
  }

  if (!payload.fecha_inicio) {
    return 'fecha_inicio es obligatoria';
  }

  if (payload.fecha_fin && payload.fecha_fin < payload.fecha_inicio) {
    return 'fecha_fin no puede ser menor a fecha_inicio';
  }

  if (payload.tipo_descanso === 'FIJO_SEMANAL') {
    if (!payload.dia_semana || payload.dia_semana_alterno) return 'FIJO_SEMANAL requiere solo dia_semana';
  }

  if (payload.tipo_descanso === 'ALTERNADO_SEMANAL') {
    if (!payload.dia_semana || !payload.dia_semana_alterno) return 'ALTERNADO_SEMANAL requiere ambos días';
    if (payload.dia_semana === payload.dia_semana_alterno) return 'Los días alternados deben ser distintos';
  }

  if (payload.tipo_descanso === 'FECHA_UNICA') {
    if (payload.dia_semana || payload.dia_semana_alterno || payload.fecha_fin) {
      return 'FECHA_UNICA no permite días de semana ni fecha_fin';
    }
  }

  if (payload.tipo_descanso === 'RANGO_FECHAS') {
    if (payload.dia_semana || payload.dia_semana_alterno || !payload.fecha_fin) {
      return 'RANGO_FECHAS requiere fecha_fin y no permite días de semana';
    }
  }

  return null;
};

const getDescansos = async (req, res) => {
  try {
    const idEmpleado = req.query.id_empleado ? Number(req.query.id_empleado) : null;
    const estado = req.query.estado === undefined
      ? null
      : req.query.estado === '1' || req.query.estado === 'true';

    const data = await EmpleadoDescansos.getAll({
      idEmpleado: Number.isInteger(idEmpleado) && idEmpleado > 0 ? idEmpleado : null,
      estado,
    });

    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createDescanso = async (req, res) => {
  try {
    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });

    const created = await EmpleadoDescansos.create(payload);
    return res.status(201).json(created);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const updateDescanso = async (req, res) => {
  try {
    const idDescanso = Number(req.params.id);
    if (!Number.isInteger(idDescanso) || idDescanso <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const payload = normalizePayload(req.body);
    const validationError = validatePayload(payload);
    if (validationError) return res.status(400).json({ error: validationError });

    const updated = await EmpleadoDescansos.update(idDescanso, payload);
    if (!updated) return res.status(404).json({ error: 'Descanso no encontrado' });

    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const deleteDescanso = async (req, res) => {
  try {
    const idDescanso = Number(req.params.id);
    if (!Number.isInteger(idDescanso) || idDescanso <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const deleted = await EmpleadoDescansos.remove(idDescanso);
    if (!deleted) return res.status(404).json({ error: 'Descanso no encontrado' });

    return res.json({ message: 'Descanso eliminado correctamente' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const validarFechaDescanso = async (req, res) => {
  try {
    const idEmpleado = Number(req.params.idEmpleado);
    const fecha = normalizeDate(req.params.fecha);

    if (!Number.isInteger(idEmpleado) || idEmpleado <= 0) {
      return res.status(400).json({ error: 'idEmpleado inválido' });
    }

    if (!fecha) {
      return res.status(400).json({ error: 'fecha inválida' });
    }

    const es_descanso = await EmpleadoDescansos.esDescanso(idEmpleado, fecha);
    return res.json({ id_empleado: idEmpleado, fecha, es_descanso });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getDescansos,
  createDescanso,
  updateDescanso,
  deleteDescanso,
  validarFechaDescanso,
};
