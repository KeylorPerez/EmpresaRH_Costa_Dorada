/**
 * Modelo de configuración de descansos. Maneja la vigencia del patrón
 * y sus días asociados para cada empleado.
 */
const { poolPromise, sql } = require('../db/db');

class DescansoConfig {
  static async getByEmpleadoId(id_empleado, { transaction } = {}) {
    const pool = await poolPromise;
    const request = transaction ? new sql.Request(transaction) : pool.request();
    const result = await request
      .input('id_empleado', sql.Int, id_empleado)
      .query(`
        SELECT TOP 1
          id_config,
          id_empleado,
          tipo_patron,
          ciclo,
          fecha_inicio_vigencia,
          fecha_fin_vigencia,
          fecha_base,
          created_at,
          updated_at
        FROM dbo.DescansoConfig
        WHERE id_empleado = @id_empleado
        ORDER BY fecha_inicio_vigencia DESC, id_config DESC
      `);
    return result.recordset[0] || null;
  }

  static async getByEmpleadoIdForFecha(id_empleado, fechaReferencia, { transaction } = {}) {
    if (!fechaReferencia) {
      return DescansoConfig.getByEmpleadoId(id_empleado, { transaction });
    }

    const pool = await poolPromise;
    const request = transaction ? new sql.Request(transaction) : pool.request();
    const result = await request
      .input('id_empleado', sql.Int, id_empleado)
      .input('fecha_referencia', sql.Date, fechaReferencia)
      .query(`
        SELECT TOP 1
          id_config,
          id_empleado,
          tipo_patron,
          ciclo,
          fecha_inicio_vigencia,
          fecha_fin_vigencia,
          fecha_base,
          created_at,
          updated_at
        FROM dbo.DescansoConfig
        WHERE id_empleado = @id_empleado
          AND fecha_inicio_vigencia <= @fecha_referencia
          AND (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= @fecha_referencia)
        ORDER BY fecha_inicio_vigencia DESC, id_config DESC
      `);
    return result.recordset[0] || null;
  }

  static async getDiasByConfigId(id_config, { transaction } = {}) {
    const pool = await poolPromise;
    const request = transaction ? new sql.Request(transaction) : pool.request();
    const result = await request
      .input('id_config', sql.Int, id_config)
      .query(`
        SELECT
          periodo_tipo,
          dia_semana,
          es_descanso
        FROM dbo.DescansoDias
        WHERE id_config = @id_config
      `);
    return result.recordset || [];
  }

  static async create(
    {
      id_empleado,
      tipo_patron,
      ciclo,
      fecha_inicio_vigencia,
      fecha_fin_vigencia,
      fecha_base,
    },
    { transaction } = {}
  ) {
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
        INSERT INTO dbo.DescansoConfig
          (id_empleado, tipo_patron, ciclo, fecha_inicio_vigencia, fecha_fin_vigencia, fecha_base)
        VALUES
          (@id_empleado, @tipo_patron, @ciclo, @fecha_inicio_vigencia, @fecha_fin_vigencia, @fecha_base);

        SELECT SCOPE_IDENTITY() AS id_config;
      `);
    return result.recordset[0];
  }

  static async update(
    id_config,
    {
      tipo_patron,
      ciclo,
      fecha_inicio_vigencia,
      fecha_fin_vigencia,
      fecha_base,
    },
    { transaction } = {}
  ) {
    const pool = await poolPromise;
    const request = transaction ? new sql.Request(transaction) : pool.request();
    await request
      .input('id_config', sql.Int, id_config)
      .input('tipo_patron', sql.VarChar(30), tipo_patron)
      .input('ciclo', sql.VarChar(10), ciclo)
      .input('fecha_inicio_vigencia', sql.Date, fecha_inicio_vigencia)
      .input('fecha_fin_vigencia', sql.Date, fecha_fin_vigencia)
      .input('fecha_base', sql.Date, fecha_base)
      .query(`
        UPDATE dbo.DescansoConfig
        SET
          tipo_patron = @tipo_patron,
          ciclo = @ciclo,
          fecha_inicio_vigencia = @fecha_inicio_vigencia,
          fecha_fin_vigencia = @fecha_fin_vigencia,
          fecha_base = @fecha_base,
          updated_at = SYSUTCDATETIME()
        WHERE id_config = @id_config
      `);
  }

  static async replaceDias(id_config, dias, { transaction } = {}) {
    const pool = await poolPromise;
    const request = transaction ? new sql.Request(transaction) : pool.request();
    await request
      .input('id_config', sql.Int, id_config)
      .query(`
        DELETE FROM dbo.DescansoDias WHERE id_config = @id_config;
      `);

    if (!Array.isArray(dias) || dias.length === 0) {
      return;
    }

    const insertRequest = transaction ? new sql.Request(transaction) : pool.request();
    insertRequest.input('id_config', sql.Int, id_config);
    const values = dias.map((dia, index) => {
      insertRequest
        .input(`periodo_${index}`, sql.Char(1), dia.periodo_tipo)
        .input(`dia_${index}`, sql.TinyInt, dia.dia_semana)
        .input(`descanso_${index}`, sql.Bit, dia.es_descanso ? 1 : 0);
      return `(@id_config, @periodo_${index}, @dia_${index}, @descanso_${index})`;
    });

    await insertRequest.query(`
      INSERT INTO dbo.DescansoDias (id_config, periodo_tipo, dia_semana, es_descanso)
      VALUES ${values.join(',\n      ')};
    `);
  }
}

module.exports = DescansoConfig;
