const Asistencia = require('../models/Asistencia');
const Usuario = require('../models/Usuario'); // para resolver id_empleado del usuario
const Empleado = require('../models/Empleado');
const allowedTypes = ['entrada', 'salida', 'almuerzo_inicio', 'almuerzo_fin'];

const parseEnvFloat = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const geofenceLatitude = parseEnvFloat(process.env.OFFICE_LATITUDE);
const geofenceLongitude = parseEnvFloat(process.env.OFFICE_LONGITUDE);
const geofenceRadius = parseEnvFloat(process.env.OFFICE_RADIUS_METERS || process.env.OFFICE_RADIUS_MTS || 0);

const geofenceConfigured =
  Number.isFinite(geofenceLatitude) &&
  Number.isFinite(geofenceLongitude) &&
  Number.isFinite(geofenceRadius) &&
  geofenceRadius > 0;

const toRadians = (value) => (value * Math.PI) / 180;

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const earthRadius = 6371000; // metros
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const parseCoordinate = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isTruthy = (value) => value === true || value === 1 || value === '1';

// helpers para fecha/hora
function formatDateToSql(dateInput) {
  const ensureDate = (value) => {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }

      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/');
        return `${year}-${month}-${day}`;
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }

      throw new Error('Formato de fecha inválido');
    }

    return null;
  };

  if (!dateInput) {
    const now = new Date();
    return formatDateToSql(now);
  }

  if (typeof dateInput === 'string') {
    const normalized = ensureDate(dateInput);
    if (typeof normalized === 'string') {
      return normalized;
    }
    if (normalized instanceof Date) {
      return formatDateToSql(normalized);
    }
    if (normalized === null) {
      const now = new Date();
      return formatDateToSql(now);
    }
    throw new Error('Formato de fecha inválido');
  }

  if (dateInput instanceof Date) {
    const yyyy = dateInput.getUTCFullYear();
    const mm = String(dateInput.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dateInput.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  throw new Error('Formato de fecha inválido');
}

function parseTimeForSqlServer(timeInput) {
  if (!timeInput) return null;

  const buildFromParts = (hours, minutes, seconds) => {
    const h = String(Number(hours) || 0).padStart(2, '0');
    const m = String(Number(minutes) || 0).padStart(2, '0');
    const s = String(Number(seconds) || 0).padStart(2, '0');
    return `${h}:${m}:${s}.000`;
  };

  if (timeInput instanceof Date) {
    return buildFromParts(timeInput.getHours(), timeInput.getMinutes(), timeInput.getSeconds());
  }

  if (typeof timeInput === 'string') {
    const trimmed = timeInput.trim();
    if (!trimmed) return null;

    const [h = '0', m = '0', rest = '0'] = trimmed.split(':');
    const s = rest.includes('.') ? rest.split('.')[0] : rest;
    return buildFromParts(h, m, s);
  }

  throw new Error('Formato de hora inválido');
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
    const {
      id_empleado: idEmpleadoBody,
      tipo_marca,
      fecha: fechaBody,
      hora: horaBody,
      observaciones,
      latitud: latitudBody,
      longitud: longitudBody,
    } = req.body;
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
    const hora = horaBody
      ? parseTimeForSqlServer(horaBody)
      : parseTimeForSqlServer(now);

    const empleado = await Empleado.getById(id_empleado_final);
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado o inactivo' });
    }

    const latitud = parseCoordinate(latitudBody);
    const longitud = parseCoordinate(longitudBody);
    const requiereUbicacion = userToken.id_rol !== 1;

    if (requiereUbicacion && (latitud === null || longitud === null)) {
      return res.status(400).json({ error: 'No se pudo obtener la ubicación para registrar la marca' });
    }

    if (geofenceConfigured && latitud !== null && longitud !== null) {
      const distancia = calculateDistanceMeters(latitud, longitud, geofenceLatitude, geofenceLongitude);
      const permitirFuera = isTruthy(empleado.permitir_marcacion_fuera);
      if (!permitirFuera && userToken.id_rol !== 1 && distancia > geofenceRadius) {
        return res.status(403).json({ error: 'La ubicación se encuentra fuera del rango permitido para este colaborador' });
      }
    }

    const existingMarca = await Asistencia.findByEmpleadoFechaTipo(id_empleado_final, fechaSql, tipo_marca);
    if (existingMarca) {
      return res.status(409).json({ error: 'Esta marca ya fue registrada para la fecha seleccionada' });
    }

    const created = await Asistencia.create({
      id_empleado: id_empleado_final,
      fecha: fechaSql,
      hora: hora,
      tipo_marca,
      observaciones,
      latitud,
      longitud,
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
