const { poolPromise, sql } = require('../db/db');

class Planilla {
  // Obtener todas las planillas (admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT pl.*, e.nombre, e.apellido, e.salario_base
          FROM Planilla pl
          LEFT JOIN Empleados e ON pl.id_empleado = e.id_empleado
          ORDER BY pl.mes DESC, pl.anio DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Obtener planilla por empleado
  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT *
          FROM Planilla
          WHERE id_empleado = @id_empleado
          ORDER BY anio DESC, mes DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Calcular y generar planilla
  static async calcularPlanilla({ id_empleado, mes, anio, horas_extras = 0, bonificaciones = 0, deducciones = 0 }) {
    try {
      const pool = await poolPromise;

      // obtener salario_base
      const empleadoRes = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query('SELECT salario_base FROM Empleados WHERE id_empleado = @id_empleado');
      const salario_base = empleadoRes.recordset[0]?.salario_base || 0;

      // calcular bruto
      const salario_bruto = salario_base + bonificaciones + (horas_extras * (salario_base / 160)); // ejemplo: 160h/mes
      const salario_neto = salario_bruto - deducciones;

      // insertar planilla
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('mes', sql.Int, mes)
        .input('anio', sql.Int, anio)
        .input('salario_bruto', sql.Decimal(18,2), salario_bruto)
        .input('bonificaciones', sql.Decimal(18,2), bonificaciones)
        .input('deducciones', sql.Decimal(18,2), deducciones)
        .input('horas_extras', sql.Decimal(18,2), horas_extras)
        .input('salario_neto', sql.Decimal(18,2), salario_neto)
        .query(`
          INSERT INTO Planilla (id_empleado, mes, anio, salario_bruto, bonificaciones, deducciones, horas_extras, salario_neto)
          VALUES (@id_empleado, @mes, @anio, @salario_bruto, @bonificaciones, @deducciones, @horas_extras, @salario_neto);
          SELECT SCOPE_IDENTITY() AS id_planilla;
        `);

      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Planilla;
