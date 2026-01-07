/**
 * Modelo de días de descanso asociados a una configuración.
 */
const { poolPromise, sql } = require('../db/db');

class DescansoDias {
  static isMissingTableError(err) {
    return err && err.number === 208;
  }

  static async createMany(id_config, dias, { transaction } = {}) {
    if (!Array.isArray(dias) || dias.length === 0) {
      return;
    }

    try {
      const pool = await poolPromise;

      for (const dia of dias) {
        const request = transaction ? new sql.Request(transaction) : pool.request();
        await request
          .input('id_config', sql.Int, id_config)
          .input('periodo_tipo', sql.Char(1), dia.periodo_tipo)
          .input('dia_semana', sql.TinyInt, dia.dia_semana)
          .input('es_descanso', sql.Bit, dia.es_descanso)
          .query(`
            INSERT INTO DescansoDias
              (id_config, periodo_tipo, dia_semana, es_descanso)
            VALUES
              (@id_config, @periodo_tipo, @dia_semana, @es_descanso);
          `);
      }
    } catch (err) {
      if (DescansoDias.isMissingTableError(err)) {
        return;
      }
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
          DELETE FROM DescansoDias
          WHERE id_config IN (
            SELECT id_config
            FROM DescansoConfig
            WHERE id_empleado = @id_empleado
          );
        `);
    } catch (err) {
      if (DescansoDias.isMissingTableError(err)) {
        return;
      }
      throw err;
    }
  }
}

module.exports = DescansoDias;
