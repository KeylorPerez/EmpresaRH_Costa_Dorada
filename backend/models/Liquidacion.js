const { poolPromise, sql } = require('../db/db');

class Liquidacion {
  // Obtener todas las liquidaciones (admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT l.*, e.nombre, e.apellido
          FROM Liquidaciones l
          LEFT JOIN Empleados e ON l.id_empleado = e.id_empleado
          ORDER BY l.fecha_salida DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Obtener liquidaciones por empleado
  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT *
          FROM Liquidaciones
          WHERE id_empleado = @id_empleado
          ORDER BY fecha_salida DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Generar liquidación
  static async generar({ id_empleado, fecha_salida, motivo }) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('fecha_salida', sql.Date, fecha_salida)
        .input('motivo', sql.VarChar(255), motivo)
        .query(`
          INSERT INTO Liquidaciones (id_empleado, fecha_salida, motivo)
          VALUES (@id_empleado, @fecha_salida, @motivo);
          SELECT SCOPE_IDENTITY() AS id_liquidacion;
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Liquidacion;
