const Planilla = require('../models/Planilla');
const Usuario = require('../models/Usuario');
const Asistencia = require('../models/Asistencia');
const Empleado = require('../models/Empleado');

// 🔹 Obtener planillas
const getPlanilla = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    if (user.id_rol === 1) {
      // Admin: todas las planillas
      const rows = await Planilla.getAll();
      return res.json(rows);
    } else {
      // Empleado: solo sus planillas
      const usuario = await Usuario.getById(user.id_usuario);
      if (!usuario || !usuario.id_empleado)
        return res.status(400).json({ error: 'Usuario no vinculado a empleado' });

      const rows = await Planilla.getByEmpleado(usuario.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    if (err.message === 'Planilla no encontrada') {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

// 🔹 Crear / Calcular planilla (solo admin)
const calcularPlanilla = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede calcular planilla' });

    const {
      id_empleado,
      periodo_inicio,
      periodo_fin,
      horas_extras = 0,
      bonificaciones = 0,
      deducciones = 0,
      fecha_pago,
      prestamos = [],
      dias_trabajados = null,
      dias_descuento = 0,
      monto_descuento_dias = null,
    } = req.body;

    if (!id_empleado || !periodo_inicio || !periodo_fin) {
      return res.status(400).json({ error: 'Faltan datos requeridos: id_empleado, periodo_inicio y periodo_fin' });
    }

    const fechaPagoFinal = fecha_pago || periodo_fin;

    const planilla = await Planilla.calcularPlanilla({
      id_empleado,
      periodo_inicio,
      periodo_fin,
      horas_extras,
      bonificaciones,
      deducciones,
      fecha_pago: fechaPagoFinal,
      prestamos,
      dias_trabajados,
      dias_descuento,
      monto_descuento_dias,
    });

    return res.status(201).json({
      message: 'Planilla generada correctamente',
      id_planilla: planilla.id_planilla
    });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

// 🔹 Actualizar planilla (solo admin)
const updatePlanilla = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede actualizar planillas' });

    const id_planilla = parseInt(req.params.id, 10);
    if (isNaN(id_planilla)) return res.status(400).json({ error: 'ID inválido' });

    const { horas_extras = 0, bonificaciones = 0, deducciones = 0, fecha_pago } = req.body;

    await Planilla.update(id_planilla, {
      horas_extras,
      bonificaciones,
      deducciones,
      fecha_pago,
    });

    return res.json({ message: 'Planilla actualizada correctamente' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getPlanillaAttendance = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo admin puede consultar asistencia para planilla' });
    }

    const { id_empleado, periodo_inicio, periodo_fin } = req.query;

    const empleadoId = Number(id_empleado);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      return res.status(400).json({ error: 'id_empleado inválido' });
    }

    if (!periodo_inicio || !periodo_fin) {
      return res.status(400).json({ error: 'periodo_inicio y periodo_fin son requeridos' });
    }

    const inicio = new Date(periodo_inicio);
    const fin = new Date(periodo_fin);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      return res.status(400).json({ error: 'Las fechas proporcionadas no son válidas' });
    }

    if (fin < inicio) {
      return res.status(400).json({ error: 'El periodo es inválido: la fecha fin debe ser mayor o igual a la fecha inicio' });
    }

    const empleado = await Empleado.getById(empleadoId);
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    if (empleado.tipo_pago !== 'Diario') {
      return res.json({ dias: 0 });
    }

    const dias = await Asistencia.countDistinctDays(empleadoId, periodo_inicio, periodo_fin);

    return res.json({ dias });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getPlanilla, calcularPlanilla, updatePlanilla, getPlanillaAttendance };
