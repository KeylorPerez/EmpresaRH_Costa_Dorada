/**
 * Modelo de días dobles. Permite consultar los días configurados
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
