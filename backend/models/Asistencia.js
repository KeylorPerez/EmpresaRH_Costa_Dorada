const { poolPromise, sql } = require('../db/db');

class Asistencia {
  // Obtener todas las marcas (con información básica del empleado)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT a.*, e.nombre, e.apellido
          FROM Asistencia a
          INNER JOIN Empleados e ON a.id_empleado = e.id_empleado
          ORDER BY a.fecha DESC, a.hora DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Obtener por empleado
  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT * FROM Asistencia
          WHERE id_empleado = @id_empleado
          ORDER BY fecha DESC, hora DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Obtener por rango de fechas
  static async getByDateRange(startDate, endDate, id_empleado = null) {
    try {
      const pool = await poolPromise;
      const req = pool.request()
        .input('start', sql.Date, startDate)
        .input('end', sql.Date, endDate);

      let query = `SELECT a.*, e.nombre, e.apellido
                   FROM Asistencia a
                   LEFT JOIN Empleados e ON a.id_empleado = e.id_empleado
                   WHERE a.fecha BETWEEN @start AND @end`;

      if (id_empleado) {
        req.input('id_empleado', sql.Int, id_empleado);
        query += ` AND a.id_empleado = @id_empleado`;
      }

      query += ` ORDER BY a.fecha, a.hora`;

      const result = await req.query(query);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Crear marca de asistencia
  static async create({ id_empleado, fecha, hora, tipo_marca, observaciones }) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('fecha', sql.Date, fecha)
        .input('hora', sql.VarChar(8), hora)

        .input('tipo_marca', sql.VarChar(20), tipo_marca)
        .input('observaciones', sql.NVarChar(sql.MAX), observaciones || null)
        .query(`
          INSERT INTO Asistencia (id_empleado, fecha, hora, tipo_marca, observaciones)
          VALUES (@id_empleado, @fecha, @hora, @tipo_marca, @observaciones);
          SELECT SCOPE_IDENTITY() AS id_asistencia;
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // Actualizar observaciones o tipo_marca (admin)
  static async update(id_asistencia, { tipo_marca, observaciones }) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_asistencia', sql.Int, id_asistencia)
        .input('tipo_marca', sql.VarChar(20), tipo_marca)
        .input('observaciones', sql.NVarChar(sql.MAX), observaciones)
        .query(`
          UPDATE Asistencia
          SET tipo_marca = @tipo_marca,
              observaciones = @observaciones
          WHERE id_asistencia = @id_asistencia
        `);
      return { message: 'Actualizado' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Asistencia;
