const Asistencia = require('../models/Asistencia');
const Usuario = require('../models/Usuario'); // para resolver id_empleado del usuario
const allowedTypes = ['entrada', 'salida', 'almuerzo_inicio', 'almuerzo_fin'];

// helpers para fecha/hora
function formatDateToSql(date) {
  // date: JS Date -> convertimos a YYYY-MM-DD (Date object también funciona con mssql sql.Date)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
function formatTimeToHHMMSS(date) {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}.0000000`; // 🔹 formato exacto para SQL TIME(7)
}

// GET /api/asistencia
// Si es admin (id_rol = 1) devuelve todo, si es empleado devuelve solo sus marcas
const getAsistencia = async (req, res) => {
  try {
    const userToken = req.user; // viene del middleware
    if (userToken.id_rol === 1) {
      const rows = await Asistencia.getAll();
      return res.json(rows);
    } else {
      // obtener id_empleado asociado al usuario
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
// Si el usuario no es admin y no envía id_empleado, se usa el id_empleado del usuario.
// Si envía id_empleado distinto y no es admin -> 403
const createMarca = async (req, res) => {
  try {
    const { id_empleado: idEmpleadoBody, tipo_marca, fecha: fechaBody, hora: horaBody, observaciones } = req.body;
    const userToken = req.user;

    // Validar tipo_marca
    if (!tipo_marca || !allowedTypes.includes(tipo_marca)) {
      return res.status(400).json({ error: `tipo_marca inválido. Debe ser uno de: ${allowedTypes.join(', ')}` });
    }

    // resolver id_empleado del actor
    const usuario = await Usuario.getById(userToken.id_usuario);
    const actorEmpleadoId = usuario ? usuario.id_empleado : null;

    // Determinar id_empleado final
    let id_empleado_final = idEmpleadoBody || actorEmpleadoId;
    if (!id_empleado_final) return res.status(400).json({ error: 'id_empleado requerido (o vincular usuario a empleado)' });

    // Si el request especifica otro empleado y el actor no es admin -> prohibido
    if (idEmpleadoBody && userToken.id_rol !== 1 && idEmpleadoBody !== actorEmpleadoId) {
      return res.status(403).json({ error: 'No autorizado para marcar asistencia de otro empleado' });
    }

    // Fecha y hora por defecto = ahora si no vienen
    const now = new Date();
    const fecha = fechaBody ? new Date(fechaBody) : now;
    const hora = horaBody ? horaBody : formatTimeToHHMMSS(now);

    // Llamar al modelo
    const created = await Asistencia.create({
      id_empleado: id_empleado_final,
      fecha: formatDateToSql(fecha),
      hora: hora,
      tipo_marca,
      observaciones
    });

    return res.status(201).json({ message: 'Marca registrada', id_asistencia: created.id_asistencia });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/asistencia/:id  (solo admin) actualizar tipo/observaciones
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
