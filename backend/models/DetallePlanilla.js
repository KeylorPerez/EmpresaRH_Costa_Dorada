const { poolPromise, sql } = require('../db/db');

class DetallePlanilla {
  static async createMany(transaction, id_planilla, detalles = []) {
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return;
    }

    for (const detalle of detalles) {
      const request = new sql.Request(transaction);
      request
        .input('id_planilla', sql.Int, id_planilla)
        .input('fecha', sql.Date, detalle.fecha)
        .input('dia_semana', sql.VarChar(15), detalle.dia_semana)
        .input('salario_dia', sql.Decimal(12, 2), detalle.salario_dia)
        .input('asistio', sql.Bit, detalle.asistio ? 1 : 0)
        .input('es_dia_doble', sql.Bit, detalle.es_dia_doble ? 1 : 0)
        .input('observacion', sql.NVarChar(150), detalle.observacion || null);

      await request.query(`
        INSERT INTO DetallePlanilla (id_planilla, fecha, dia_semana, salario_dia, asistio, es_dia_doble, observacion)
        VALUES (@id_planilla, @fecha, @dia_semana, @salario_dia, @asistio, @es_dia_doble, @observacion)
      `);
    }
  }

  static async getByPlanilla(id_planilla) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id_planilla', sql.Int, id_planilla)
      .query(`
        SELECT id_detalle, id_planilla, fecha, dia_semana, salario_dia, asistio, es_dia_doble, observacion
        FROM DetallePlanilla
        WHERE id_planilla = @id_planilla
        ORDER BY fecha ASC
      `);
    return result.recordset;
  }
}

module.exports = DetallePlanilla;
