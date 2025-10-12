const Vacaciones = require('../models/Vacaciones');
const Usuario = require('../models/Usuario'); // para obtener el id_empleado vinculado al usuario

// =======================
// GET /api/vacaciones
// Admin → ve todas las solicitudes
// Empleado → ve solo las suyas
// =======================
const getVacaciones = async (req, res) => {
  try {
    const user = req.user; // { id_usuario, id_rol }

    if (!user) return res.status(401).json({ error: 'No autenticado' });

    if (user.id_rol === 1) {
      // Admin
      const rows = await Vacaciones.getAll();
      return res.json(rows);
    } else {
      // Empleado normal
      const usuario = await Usuario.getById(user.id_usuario);
      if (!usuario || !usuario.id_empleado)
        return res.status(400).json({ error: 'Usuario no vinculado a empleado' });

      const rows = await Vacaciones.getByEmpleado(usuario.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// =======================
// POST /api/vacaciones
// Crear solicitud de vacaciones
// =======================
const createSolicitud = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const { id_empleado: idEmpleadoBody, fecha_inicio, fecha_fin, motivo } = req.body;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: 'fecha_inicio y fecha_fin son requeridos' });
    }

    const start = new Date(fecha_inicio);
    const end = new Date(fecha_fin);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'fecha_inicio o fecha_fin inválidas (usa YYYY-MM-DD)' });
    }
    if (end < start) {
      return res.status(400).json({ error: 'fecha_fin no puede ser anterior a fecha_inicio' });
    }

    // Calcular días solicitados automáticamente
    const dias_solicitados = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Resolver id_empleado (si es empleado normal, se obtiene del usuario)
    const usuario = await Usuario.getById(user.id_usuario);
    const actorEmpleadoId = usuario ? usuario.id_empleado : null;

    let id_empleado_final = idEmpleadoBody || actorEmpleadoId;
    if (!id_empleado_final) {
      return res.status(400).json({ error: 'id_empleado requerido (o vincular usuario a empleado)' });
    }

    // Si no es admin, no puede crear para otro empleado
    if (idEmpleadoBody && user.id_rol !== 1 && idEmpleadoBody !== actorEmpleadoId) {
      return res.status(403).json({ error: 'No autorizado para crear solicitud para otro empleado' });
    }

    // Crear solicitud (estado = Pendiente por defecto)
    const created = await Vacaciones.createSolicitud({
      id_empleado: id_empleado_final,
      fecha_inicio: start,
      fecha_fin: end,
      dias_solicitados,
      motivo
    });

    return res.status(201).json({
      message: 'Solicitud de vacaciones creada correctamente',
      solicitud: created
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// =======================
// PUT /api/vacaciones/:id/aprobar (solo admin)
// =======================
const aprobarSolicitud = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede aprobar' });

    const id_vacacion = parseInt(req.params.id, 10);
    if (isNaN(id_vacacion)) return res.status(400).json({ error: 'id inválido' });

    await Vacaciones.aprobar(id_vacacion, user.id_usuario);
    return res.json({ message: 'Solicitud aprobada correctamente' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// =======================
// PUT /api/vacaciones/:id/rechazar (solo admin)
// =======================
const rechazarSolicitud = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede rechazar' });

    const id_vacacion = parseInt(req.params.id, 10);
    if (isNaN(id_vacacion)) return res.status(400).json({ error: 'id inválido' });

    await Vacaciones.rechazar(id_vacacion, user.id_usuario);
    return res.json({ message: 'Solicitud rechazada correctamente' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getVacaciones,
  createSolicitud,
  aprobarSolicitud,
  rechazarSolicitud
};
