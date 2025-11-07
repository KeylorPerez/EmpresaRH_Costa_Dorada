const Asistencia = require('../models/Asistencia');
const Usuario = require('../models/Usuario'); // para resolver id_empleado del usuario
const allowedTypes = ['entrada', 'salida', 'almuerzo_inicio', 'almuerzo_fin'];

// helpers para fecha/hora
function formatDateToSql(dateInput) {
  if (!dateInput) {
    const now = new Date();
    return formatDateToSql(now);
  }

  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) {
      const now = new Date();
      return formatDateToSql(now);
    }

    const dateOnlyMatch = trimmed.match(/^\d{4}-\d{2}-\d{2}$/);
    if (dateOnlyMatch) {
      return trimmed;
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateToSql(parsed);
    }

    throw new Error('Formato de fecha inválido');
  }

  if (dateInput instanceof Date) {
    const yyyy = dateInput.getFullYear();
    const mm = String(dateInput.getMonth() + 1).padStart(2, '0');
    const dd = String(dateInput.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  throw new Error('Formato de fecha inválido');
}

function parseTimeForSqlServer(timeInput) {
  if (!timeInput) return null;

  let date;
  if (timeInput instanceof Date) {
    date = timeInput;
  } else if (typeof timeInput === 'string') {
    const parts = timeInput.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1] || '0', 10);
    const s = parseInt(parts[2] || '0', 10);
    date = new Date();
    date.setHours(h, m, s, 0);
  } else {
    throw new Error('Formato de hora inválido');
  }

  // SQL Server TIME -> formato HH:MM:SS.mmm
  return date.toTimeString().split(' ')[0] + '.000';
}

// GET /api/asistencia
const getAsistencia = async (req, res) => {
  try {
    const userToken = req.user;
    if (userToken.id_rol === 1) {
      const rows = await Asistencia.getAll();
      return res.json(rows);
    } else {
      const user = await Usuario.getById(userToken.id_usuario);
      if (!user || !user.id_empleado) return res.status(400).json({ error: 'Usuario no vinculado a empleado' });
      const rows = await Asistencia.getByEmpleado(user.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/asistencia/range?start=YYYY-MM-DD&end=YYYY-MM-DD
const getByRange = async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos (YYYY-MM-DD)' });

    const userToken = req.user;
    if (userToken.id_rol === 1) {
      const rows = await Asistencia.getByDateRange(start, end);
      return res.json(rows);
    } else {
      const user = await Usuario.getById(userToken.id_usuario);
      if (!user || !user.id_empleado) return res.status(400).json({ error: 'Usuario no vinculado a empleado' });
      const rows = await Asistencia.getByDateRange(start, end, user.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/asistencia
// body: { id_empleado? , tipo_marca, fecha? , hora? , observaciones? }
const createMarca = async (req, res) => {
  try {
    const { id_empleado: idEmpleadoBody, tipo_marca, fecha: fechaBody, hora: horaBody, observaciones } = req.body;
    const userToken = req.user;

    if (!tipo_marca || !allowedTypes.includes(tipo_marca)) {
      return res.status(400).json({ error: `tipo_marca inválido. Debe ser uno de: ${allowedTypes.join(', ')}` });
    }

    const usuario = await Usuario.getById(userToken.id_usuario);
    const actorEmpleadoId = usuario ? usuario.id_empleado : null;

    let id_empleado_final = idEmpleadoBody || actorEmpleadoId;
    if (!id_empleado_final) return res.status(400).json({ error: 'id_empleado requerido (o vincular usuario a empleado)' });

    if (idEmpleadoBody && userToken.id_rol !== 1 && idEmpleadoBody !== actorEmpleadoId) {
      return res.status(403).json({ error: 'No autorizado para marcar asistencia de otro empleado' });
    }

const now = new Date();
const fecha = fechaBody ? new Date(fechaBody) : now;
const fechaSql = formatDateToSql(fecha);
const hora = horaBody ? parseTimeForSqlServer(horaBody) : parseTimeForSqlServer(now);

    const existingMarca = await Asistencia.findByEmpleadoFechaTipo(id_empleado_final, fechaSql, tipo_marca);
    if (existingMarca) {
      return res.status(409).json({ error: 'Esta marca ya fue registrada para la fecha seleccionada' });
    }

    const created = await Asistencia.create({
      id_empleado: id_empleado_final,
      fecha: fechaSql,
      hora: hora,
      tipo_marca,
      observaciones
    });

    return res.status(201).json({ message: 'Marca registrada', id_asistencia: created.id_asistencia });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/asistencia/:id
const updateMarca = async (req, res) => {
  try {
    const id_asistencia = parseInt(req.params.id, 10);
    const { tipo_marca, observaciones } = req.body;

    if (!tipo_marca || !allowedTypes.includes(tipo_marca)) {
      return res.status(400).json({ error: `tipo_marca inválido. Debe ser uno de: ${allowedTypes.join(', ')}` });
    }

    await Asistencia.update(id_asistencia, { tipo_marca, observaciones });
    res.json({ message: 'Marca actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAsistencia, getByRange, createMarca, updateMarca };
