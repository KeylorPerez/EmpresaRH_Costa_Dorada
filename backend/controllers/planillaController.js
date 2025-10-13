const Planilla = require('../models/Planilla');
const Usuario = require('../models/Usuario');

// GET /api/planilla
// Admin -> todas las planillas
// Empleado -> solo sus planillas
const getPlanilla = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    if (user.id_rol === 1) {
      const rows = await Planilla.getAll();
      return res.json(rows);
    } else {
      const usuario = await Usuario.getById(user.id_usuario);
      if (!usuario || !usuario.id_empleado) return res.status(400).json({ error: 'Usuario no vinculado a empleado' });

      const rows = await Planilla.getByEmpleado(usuario.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/planilla
// Crear o calcular planilla (solo admin)
const calcularPlanilla = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede calcular planilla' });

    const { id_empleado, mes, anio, horas_extras, bonificaciones, deducciones } = req.body;
    if (!id_empleado || !mes || !anio) {
      return res.status(400).json({ error: 'id_empleado, mes y anio son requeridos' });
    }

    const planilla = await Planilla.calcularPlanilla({
      id_empleado,
      mes,
      anio,
      horas_extras: horas_extras || 0,
      bonificaciones: bonificaciones || 0,
      deducciones: deducciones || 0
    });

    return res.status(201).json({ message: 'Planilla generada', id_planilla: planilla.id_planilla });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getPlanilla,
  calcularPlanilla
};
