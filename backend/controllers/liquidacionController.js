const Liquidacion = require('../models/Liquidacion');
const Usuario = require('../models/Usuario');

// GET /api/liquidaciones
// Admin -> todas las liquidaciones
// Empleado -> solo las suyas
const getLiquidaciones = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    if (user.id_rol === 1) {
      const rows = await Liquidacion.getAll();
      return res.json(rows);
    } else {
      const usuario = await Usuario.getById(user.id_usuario);
      if (!usuario || !usuario.id_empleado)
        return res.status(400).json({ error: 'Usuario no vinculado a empleado' });

      const rows = await Liquidacion.getByEmpleado(usuario.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/liquidaciones
// Admin genera liquidación para un empleado
const generarLiquidacion = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede generar liquidaciones' });

    const { id_empleado, fecha_salida, motivo } = req.body;
    if (!id_empleado || !fecha_salida || !motivo) {
      return res.status(400).json({ error: 'id_empleado, fecha_salida y motivo son requeridos' });
    }

    const liquidacion = await Liquidacion.generar({
      id_empleado,
      fecha_salida,
      motivo
    });

    return res.status(201).json({
      message: 'Liquidación generada correctamente',
      id_liquidacion: liquidacion.id_liquidacion
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getLiquidaciones,
  generarLiquidacion
};
