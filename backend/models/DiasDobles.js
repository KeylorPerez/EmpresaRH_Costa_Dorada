/**
 * Modelo de configuración de días dobles. Administra feriados o días especiales
 * que deben aplicar multiplicadores automáticos en la planilla.
 */
const { poolPromise, sql } = require('../db/db');

class DiasDobles {
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT
            id_dia_doble,
            CONVERT(varchar(10), fecha, 23) AS fecha,
            descripcion,
            multiplicador,
            activo,
            created_at
          FROM DiasDobles
          ORDER BY fecha DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async getById(id_dia_doble) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_dia_doble', sql.Int, id_dia_doble)
        .query(`
          SELECT
            id_dia_doble,
            CONVERT(varchar(10), fecha, 23) AS fecha,
            descripcion,
            multiplicador,
            activo,
            created_at
          FROM DiasDobles
          WHERE id_dia_doble = @id_dia_doble
        `);
      return result.recordset[0] || null;
    } catch (err) {
      throw err;
    }
  }

  static async getActiveInRange(fecha_inicio, fecha_fin) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('fecha_inicio', sql.Date, fecha_inicio)
        .input('fecha_fin', sql.Date, fecha_fin)
        .query(`
          SELECT
            CONVERT(varchar(10), fecha, 23) AS fecha,
            descripcion,
            multiplicador
          FROM DiasDobles
          WHERE activo = 1
            AND fecha BETWEEN @fecha_inicio AND @fecha_fin
          ORDER BY fecha
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async create({ fecha, descripcion, multiplicador, activo = true }) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('fecha', sql.Date, fecha)
        .input('descripcion', sql.NVarChar(100), descripcion)
        .input('multiplicador', sql.Decimal(4, 2), multiplicador)
        .input('activo', sql.Bit, activo ? 1 : 0)
        .query(`
          INSERT INTO DiasDobles (fecha, descripcion, multiplicador, activo, created_at)
          VALUES (@fecha, @descripcion, @multiplicador, @activo, GETDATE());
          SELECT SCOPE_IDENTITY() AS id_dia_doble;
        `);
      return result.recordset[0] || null;
    } catch (err) {
      throw err;
    }
  }

  static async update(id_dia_doble, { fecha, descripcion, multiplicador, activo }) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_dia_doble', sql.Int, id_dia_doble)
        .input('fecha', sql.Date, fecha ?? null)
        .input('descripcion', sql.NVarChar(100), descripcion ?? null)
        .input('multiplicador', sql.Decimal(4, 2), multiplicador ?? null)
        .input('activo', sql.Bit, activo === undefined ? null : (activo ? 1 : 0))
        .query(`
          UPDATE DiasDobles
          SET fecha = COALESCE(@fecha, fecha),
              descripcion = COALESCE(@descripcion, descripcion),
              multiplicador = COALESCE(@multiplicador, multiplicador),
              activo = COALESCE(@activo, activo)
          WHERE id_dia_doble = @id_dia_doble
        `);
      return this.getById(id_dia_doble);
    } catch (err) {
      throw err;
    }
  }

  static async remove(id_dia_doble) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_dia_doble', sql.Int, id_dia_doble)
        .query('DELETE FROM DiasDobles WHERE id_dia_doble = @id_dia_doble');
    } catch (err) {
      throw err;
    }
  }
}

module.exports = DiasDobles;
