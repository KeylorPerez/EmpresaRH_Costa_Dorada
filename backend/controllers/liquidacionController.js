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

    const {
      id_empleado,
      salario_acumulado,
      vacaciones_no_gozadas = 0,
      cesantia = 0,
      preaviso = 0,
      antiguedad = 0,
      id_estado,
      aprobado_por = null,
      fecha_liquidacion = null
    } = req.body;

    if (!id_empleado || salario_acumulado == null || !id_estado) {
      return res.status(400).json({ error: 'Faltan datos requeridos: id_empleado, salario_acumulado, id_estado' });
    }

    const liquidacion = await Liquidacion.generar({
      id_empleado,
      salario_acumulado,
      vacaciones_no_gozadas,
      cesantia,
      preaviso,
      antiguedad,
      id_estado,
      aprobado_por,
      fecha_liquidacion
    });

    return res.status(201).json({
      message: 'Liquidación generada correctamente',
      id_liquidacion: liquidacion.id_liquidacion
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PUT /api/liquidaciones/:id
// Admin actualiza liquidación
const updateLiquidacion = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede actualizar liquidaciones' });

    const id_liquidacion = parseInt(req.params.id, 10);
    if (isNaN(id_liquidacion)) return res.status(400).json({ error: 'ID inválido' });

    const {
      salario_acumulado,
      vacaciones_no_gozadas,
      cesantia,
      preaviso,
      antiguedad,
      id_estado,
      aprobado_por,
      fecha_liquidacion
    } = req.body;

    const result = await Liquidacion.update(id_liquidacion, {
      salario_acumulado,
      vacaciones_no_gozadas,
      cesantia,
      preaviso,
      antiguedad,
      id_estado,
      aprobado_por,
      fecha_liquidacion
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getLiquidaciones,
  generarLiquidacion,
  updateLiquidacion
};
