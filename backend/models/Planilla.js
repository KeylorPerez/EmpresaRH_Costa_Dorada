const { poolPromise, sql } = require('../db/db');

class Planilla {
  // 🔹 Obtener todas las planillas (admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT pl.*, e.nombre, e.apellido, e.salario_monto
          FROM Planilla pl
          LEFT JOIN Empleados e ON pl.id_empleado = e.id_empleado
          ORDER BY pl.periodo_inicio DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Obtener planillas por empleado
  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT *
          FROM Planilla
          WHERE id_empleado = @id_empleado
          ORDER BY periodo_inicio DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Generar o calcular planilla
  static async calcularPlanilla({ id_empleado, periodo_inicio, periodo_fin, horas_extras = 0, bonificaciones = 0, deducciones = 0, fecha_pago = null }) {
    try {
      const pool = await poolPromise;

      // obtener salario_monto
      const empleadoRes = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query('SELECT salario_monto FROM Empleados WHERE id_empleado = @id_empleado');
      const salario_base = empleadoRes.recordset[0]?.salario_monto || 0;

      // calcular bruto y neto
      const salario_bruto = salario_base + bonificaciones + (horas_extras * (salario_base / 160)); // ejemplo: 160h/mes
      const pago_neto = salario_bruto - deducciones;

      // insertar planilla
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('periodo_inicio', sql.Date, periodo_inicio)
        .input('periodo_fin', sql.Date, periodo_fin)
        .input('salario_bruto', sql.Decimal(12,2), salario_bruto)
        .input('bonificaciones', sql.Decimal(12,2), bonificaciones)
        .input('deducciones', sql.Decimal(12,2), deducciones)
        .input('horas_extras', sql.Decimal(6,2), horas_extras)
        .input('pago_neto', sql.Decimal(12,2), pago_neto)
        .input('fecha_pago', sql.Date, fecha_pago)
        .query(`
          INSERT INTO Planilla (id_empleado, periodo_inicio, periodo_fin, salario_bruto, deducciones, horas_extras, bonificaciones, pago_neto, fecha_pago, created_at, updated_at)
          VALUES (@id_empleado, @periodo_inicio, @periodo_fin, @salario_bruto, @deducciones, @horas_extras, @bonificaciones, @pago_neto, @fecha_pago, GETDATE(), GETDATE());
          SELECT SCOPE_IDENTITY() AS id_planilla;
        `);

      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Actualizar planilla existente
  static async update(id_planilla, { horas_extras, bonificaciones, deducciones, pago_neto, fecha_pago }) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_planilla', sql.Int, id_planilla)
        .input('horas_extras', sql.Decimal(6,2), horas_extras)
        .input('bonificaciones', sql.Decimal(12,2), bonificaciones)
        .input('deducciones', sql.Decimal(12,2), deducciones)
        .input('pago_neto', sql.Decimal(12,2), pago_neto)
        .input('fecha_pago', sql.Date, fecha_pago)
        .query(`
          UPDATE Planilla
          SET horas_extras = @horas_extras,
              bonificaciones = @bonificaciones,
              deducciones = @deducciones,
              pago_neto = @pago_neto,
              fecha_pago = @fecha_pago,
              updated_at = GETDATE()
          WHERE id_planilla = @id_planilla
        `);
      return { message: 'Planilla actualizada correctamente' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Planilla;
