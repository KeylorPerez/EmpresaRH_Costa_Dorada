/**
 * Modelo de descansos semanales. Administra los días libres por semana
 * (ciclos A/B) y sus vigencias para cada colaborador.
 */
const { poolPromise, sql } = require('../db/db');

class DescansoSemanal {
  static async create(
    {
      id_empleado,
      semana_tipo,
      dia_semana,
      es_descanso = 1,
      fecha_inicio_vigencia,
      fecha_fin_vigencia = null,
    },
    { transaction } = {}
  ) {
    try {
      const pool = await poolPromise;
      const request = transaction ? new sql.Request(transaction) : pool.request();
      await request
        .input('id_empleado', sql.Int, id_empleado)
        .input('semana_tipo', sql.Char(1), semana_tipo)
        .input('dia_semana', sql.TinyInt, dia_semana)
        .input('es_descanso', sql.Bit, es_descanso)
        .input('fecha_inicio_vigencia', sql.Date, fecha_inicio_vigencia)
        .input('fecha_fin_vigencia', sql.Date, fecha_fin_vigencia)
        .query(`
          INSERT INTO DescansoSemanal
            (id_empleado, semana_tipo, dia_semana, es_descanso, fecha_inicio_vigencia, fecha_fin_vigencia, created_at, updated_at)
          VALUES
            (@id_empleado, @semana_tipo, @dia_semana, @es_descanso, @fecha_inicio_vigencia, @fecha_fin_vigencia, GETDATE(), GETDATE());
        `);
    } catch (err) {
      throw err;
    }
  }

  static async getByEmpleadoInRange(id_empleado, periodo_inicio, periodo_fin) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('periodo_inicio', sql.Date, periodo_inicio)
        .input('periodo_fin', sql.Date, periodo_fin)
        .query(`
          SELECT
            id_descanso,
            id_empleado,
            semana_tipo,
            dia_semana,
            es_descanso,
            CONVERT(varchar(10), fecha_inicio_vigencia, 23) AS fecha_inicio_vigencia,
            CONVERT(varchar(10), fecha_fin_vigencia, 23) AS fecha_fin_vigencia
          FROM DescansoSemanal
          WHERE id_empleado = @id_empleado
            AND es_descanso = 1
            AND fecha_inicio_vigencia <= @periodo_fin
            AND (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= @periodo_inicio)
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT
            id_descanso,
            id_empleado,
            semana_tipo,
            dia_semana,
            es_descanso,
            CONVERT(varchar(10), fecha_inicio_vigencia, 23) AS fecha_inicio_vigencia,
            CONVERT(varchar(10), fecha_fin_vigencia, 23) AS fecha_fin_vigencia
          FROM DescansoSemanal
          WHERE id_empleado = @id_empleado
            AND es_descanso = 1
          ORDER BY fecha_inicio_vigencia DESC, semana_tipo, dia_semana
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async deleteByEmpleado(id_empleado, { transaction } = {}) {
    try {
      const pool = await poolPromise;
      const request = transaction ? new sql.Request(transaction) : pool.request();
      await request
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          DELETE FROM DescansoSemanal
          WHERE id_empleado = @id_empleado
            AND es_descanso = 1
        `);
    } catch (err) {
      throw err;
    }
  }
}

module.exports = DescansoSemanal;
