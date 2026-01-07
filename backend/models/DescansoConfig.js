/**
 * Modelo de configuración de descanso (tipo de patrón, ciclo y vigencias).
 */
const { poolPromise, sql } = require('../db/db');

class DescansoConfig {
  static isMissingTableError(err) {
    return err && err.number === 208;
  }

  static async create(
    {
      id_empleado,
      tipo_patron,
      ciclo,
      fecha_inicio_vigencia,
      fecha_fin_vigencia = null,
      fecha_base,
    },
    { transaction } = {}
  ) {
    try {
      const pool = await poolPromise;
      const request = transaction ? new sql.Request(transaction) : pool.request();
      const result = await request
        .input('id_empleado', sql.Int, id_empleado)
        .input('tipo_patron', sql.VarChar(30), tipo_patron)
        .input('ciclo', sql.VarChar(10), ciclo)
        .input('fecha_inicio_vigencia', sql.Date, fecha_inicio_vigencia)
        .input('fecha_fin_vigencia', sql.Date, fecha_fin_vigencia)
        .input('fecha_base', sql.Date, fecha_base)
        .query(`
          INSERT INTO DescansoConfig
            (id_empleado, tipo_patron, ciclo, fecha_inicio_vigencia, fecha_fin_vigencia, fecha_base, created_at, updated_at)
          OUTPUT Inserted.id_config
          VALUES
            (@id_empleado, @tipo_patron, @ciclo, @fecha_inicio_vigencia, @fecha_fin_vigencia, @fecha_base, SYSUTCDATETIME(), SYSUTCDATETIME());
        `);

      return result.recordset[0]?.id_config;
    } catch (err) {
      if (DescansoConfig.isMissingTableError(err)) {
        return null;
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
          DELETE FROM DescansoConfig
          WHERE id_empleado = @id_empleado;
        `);
    } catch (err) {
      if (DescansoConfig.isMissingTableError(err)) {
        return;
      }
      throw err;
    }
  }
}

module.exports = DescansoConfig;
