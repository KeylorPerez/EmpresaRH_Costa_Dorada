/**
 * Modelo de días dobles. Permite consultar y administrar los días configurados
 * con pago especial para que otros módulos puedan aplicar el cálculo
 * correspondiente en planilla.
 */
const { poolPromise, sql } = require('../db/db');

const mapRow = (row) => ({
  id_dia_doble: row.id_dia_doble,
  fecha: row.fecha,
  descripcion: row.descripcion,
  multiplicador: Number(row.multiplicador),
  activo: Boolean(row.activo),
  created_at: row.created_at,
});

const DiasDobles = {
  async getAll({ soloActivos = false } = {}) {
    const pool = await poolPromise;
    const request = pool.request();

    let query = `
      SELECT id_dia_doble, fecha, descripcion, multiplicador, activo, created_at
      FROM DiasDobles
    `;

    if (soloActivos) {
      query += ' WHERE activo = 1';
    }

    query += ' ORDER BY fecha DESC';

    const result = await request.query(query);
    return result.recordset.map(mapRow);
  },

  async getByFecha(fecha) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('fecha', sql.Date, fecha)
      .query(`
        SELECT TOP 1 id_dia_doble, fecha, descripcion, multiplicador, activo, created_at
        FROM DiasDobles
        WHERE fecha = @fecha
      `);

    if (!result.recordset.length) return null;
    return mapRow(result.recordset[0]);
  },

  async getById(idDiaDoble) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('id_dia_doble', sql.Int, idDiaDoble)
      .query(`
        SELECT TOP 1 id_dia_doble, fecha, descripcion, multiplicador, activo, created_at
        FROM DiasDobles
        WHERE id_dia_doble = @id_dia_doble
      `);

    if (!result.recordset.length) return null;
    return mapRow(result.recordset[0]);
  },

  async create({ fecha, descripcion, multiplicador = 2, activo = true }) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('fecha', sql.Date, fecha)
      .input('descripcion', sql.NVarChar(150), descripcion)
      .input('multiplicador', sql.Decimal(5, 2), multiplicador)
      .input('activo', sql.Bit, activo ? 1 : 0)
      .query(`
        INSERT INTO DiasDobles (fecha, descripcion, multiplicador, activo)
        OUTPUT INSERTED.id_dia_doble, INSERTED.fecha, INSERTED.descripcion, INSERTED.multiplicador, INSERTED.activo, INSERTED.created_at
        VALUES (@fecha, @descripcion, @multiplicador, @activo)
      `);

    return mapRow(result.recordset[0]);
  },

  async update(idDiaDoble, { fecha, descripcion, multiplicador, activo }) {
    const pool = await poolPromise;
    const request = pool
      .request()
      .input('id_dia_doble', sql.Int, idDiaDoble)
      .input('fecha', sql.Date, fecha)
      .input('descripcion', sql.NVarChar(150), descripcion)
      .input('multiplicador', sql.Decimal(5, 2), multiplicador)
      .input('activo', sql.Bit, activo ? 1 : 0);

    const result = await request.query(`
      UPDATE DiasDobles
      SET fecha = @fecha,
          descripcion = @descripcion,
          multiplicador = @multiplicador,
          activo = @activo
      OUTPUT INSERTED.id_dia_doble, INSERTED.fecha, INSERTED.descripcion, INSERTED.multiplicador, INSERTED.activo, INSERTED.created_at
      WHERE id_dia_doble = @id_dia_doble
    `);

    if (!result.recordset.length) return null;
    return mapRow(result.recordset[0]);
  },

  async remove(idDiaDoble) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('id_dia_doble', sql.Int, idDiaDoble)
      .query(`
        DELETE FROM DiasDobles
        WHERE id_dia_doble = @id_dia_doble
      `);

    return result.rowsAffected[0] > 0;
  },

  async getActivosEnRango(fechaInicio, fechaFin) {
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('fechaInicio', sql.Date, fechaInicio)
      .input('fechaFin', sql.Date, fechaFin)
      .query(`
        SELECT id_dia_doble, fecha, descripcion, multiplicador, activo, created_at
        FROM DiasDobles
        WHERE activo = 1
          AND fecha BETWEEN @fechaInicio AND @fechaFin
        ORDER BY fecha ASC
      `);

    return result.recordset.map(mapRow);
  },
};

module.exports = DiasDobles;
