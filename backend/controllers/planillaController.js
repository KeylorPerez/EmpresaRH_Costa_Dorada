const { poolPromise, sql } = require('../db/db');
const Planilla = require('../models/Planilla');
const Usuario = require('../models/Usuario');

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
    return res.status(500).json({ error: err.message });
  }
};

// 🔹 Crear / Calcular planilla (solo admin)
const calcularPlanilla = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede calcular planilla' });

    const { id_empleado, periodo_inicio, periodo_fin, horas_extras = 0, bonificaciones = 0, deducciones = 0, fecha_pago } = req.body;

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
      fecha_pago: fechaPagoFinal
    });

    return res.status(201).json({
      message: 'Planilla generada correctamente',
      id_planilla: planilla.id_planilla
    });
  } catch (err) {
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

    // 🔹 Obtener id_empleado de la planilla
    const pool = await poolPromise;
    const planillaRes = await pool.request()
      .input('id_planilla', sql.Int, id_planilla)
      .query('SELECT id_empleado FROM Planilla WHERE id_planilla = @id_planilla');

    if (!planillaRes.recordset[0]) return res.status(404).json({ error: 'Planilla no encontrada' });

    const id_empleado = planillaRes.recordset[0].id_empleado;

    // 🔹 Obtener salario_monto del empleado
    const empleadoRes = await pool.request()
      .input('id_empleado', sql.Int, id_empleado)
      .query('SELECT salario_monto FROM Empleados WHERE id_empleado = @id_empleado');

    const salario_base = empleadoRes.recordset[0]?.salario_monto || 0;

    // 🔹 Recalcular salario_bruto y pago_neto
    const salario_bruto = salario_base + bonificaciones + (horas_extras * (salario_base / 160));
    const pago_neto = salario_bruto - deducciones;

    // 🔹 Actualizar planilla
    await pool.request()
      .input('id_planilla', sql.Int, id_planilla)
      .input('horas_extras', sql.Decimal(6,2), horas_extras)
      .input('bonificaciones', sql.Decimal(12,2), bonificaciones)
      .input('deducciones', sql.Decimal(12,2), deducciones)
      .input('salario_bruto', sql.Decimal(12,2), salario_bruto)
      .input('pago_neto', sql.Decimal(12,2), pago_neto)
      .input('fecha_pago', sql.Date, fecha_pago)
      .query(`
        UPDATE Planilla
        SET horas_extras = @horas_extras,
            bonificaciones = @bonificaciones,
            deducciones = @deducciones,
            salario_bruto = @salario_bruto,
            pago_neto = @pago_neto,
            fecha_pago = @fecha_pago,
            updated_at = GETDATE()
        WHERE id_planilla = @id_planilla
      `);

    return res.json({ message: 'Planilla actualizada correctamente' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = { getPlanilla, calcularPlanilla, updatePlanilla };
