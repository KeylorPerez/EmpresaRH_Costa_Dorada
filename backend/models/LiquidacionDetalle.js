const { sql } = require('../db/db');

const toNumberOrZero = (value) => {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return 0;
  return Number(parsed.toFixed(2));
};

const sanitizeString = (value, maxLength) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) {
    return text.slice(0, maxLength);
  }
  return text;
};

const sanitizeDetalle = (detalle) => {
  if (!detalle) return null;
  const concepto = sanitizeString(detalle.concepto, 100);
  if (!concepto) return null;

  const tipo = detalle.tipo === 'DESCUENTO' ? 'DESCUENTO' : 'INGRESO';
  const montoCalculado = toNumberOrZero(
    detalle.monto_calculado !== undefined ? detalle.monto_calculado : 0
  );
  const montoFinal =
    detalle.monto_final !== undefined && detalle.monto_final !== null
      ? toNumberOrZero(detalle.monto_final)
      : null;

  const editable = detalle.editable === undefined ? 1 : detalle.editable ? 1 : 0;
  const formula_usada = sanitizeString(detalle.formula_usada, 255);
  const comentario = sanitizeString(detalle.comentario, 300);
  const idPrestamoRaw = Number(detalle.id_prestamo);
  const id_prestamo =
    Number.isInteger(idPrestamoRaw) && idPrestamoRaw > 0 ? idPrestamoRaw : null;

  return {
    concepto,
    tipo,
    monto_calculado: montoCalculado,
    monto_final: montoFinal,
    editable,
    formula_usada,
    comentario,
    id_prestamo,
  };
};

const sanitizeDetalles = (detalles) => {
  if (!Array.isArray(detalles)) return [];
  const cleaned = detalles
    .map(sanitizeDetalle)
    .filter((detalle) => detalle !== null);
  return cleaned;
};

const calcularTotales = (detalles) => {
  let totalIngresos = 0;
  let totalDescuentos = 0;

  detalles.forEach((detalle) => {
    const montoBase =
      detalle.monto_final !== null && detalle.monto_final !== undefined
        ? detalle.monto_final
        : detalle.monto_calculado;
    const monto = toNumberOrZero(montoBase);

    if (detalle.tipo === 'DESCUENTO') {
      totalDescuentos += monto;
    } else {
      totalIngresos += monto;
    }
  });

  const total_pagar = Number((totalIngresos - totalDescuentos).toFixed(2));

  return {
    totalIngresos: Number(totalIngresos.toFixed(2)),
    totalDescuentos: Number(totalDescuentos.toFixed(2)),
    total_pagar,
  };
};

const insertMany = async (transaction, id_liquidacion, detalles) => {
  if (!detalles.length) return;

  for (const detalle of detalles) {
    const request = new sql.Request(transaction);
    request
      .input('id_liquidacion', sql.Int, id_liquidacion)
      .input('concepto', sql.VarChar(100), detalle.concepto)
      .input('tipo', sql.VarChar(20), detalle.tipo)
      .input('monto_calculado', sql.Decimal(12, 2), detalle.monto_calculado)
      .input(
        'monto_final',
        sql.Decimal(12, 2),
        detalle.monto_final !== null && detalle.monto_final !== undefined
          ? detalle.monto_final
          : detalle.monto_calculado
      )
      .input('editable', sql.Bit, detalle.editable ? 1 : 0)
      .input('formula_usada', sql.VarChar(255), detalle.formula_usada)
      .input('comentario', sql.VarChar(300), detalle.comentario)
      .input('id_prestamo', sql.Int, detalle.id_prestamo);

    await request.query(`
      INSERT INTO Liquidacion_Detalles
      (id_liquidacion, concepto, tipo, monto_calculado, monto_final, editable, formula_usada, comentario, id_prestamo, created_at)
      VALUES (@id_liquidacion, @concepto, @tipo, @monto_calculado, @monto_final, @editable, @formula_usada, @comentario, @id_prestamo, GETDATE())
    `);
  }
};

const getByLiquidacion = async (pool, id_liquidacion) => {
  const request = pool.request();
  const result = await request
    .input('id_liquidacion', sql.Int, id_liquidacion)
    .query(`
      SELECT id_detalle, id_liquidacion, concepto, tipo, monto_calculado, monto_final, editable,
             formula_usada, comentario, id_prestamo, created_at
      FROM Liquidacion_Detalles
      WHERE id_liquidacion = @id_liquidacion
      ORDER BY id_detalle ASC
    `);

  return result.recordset || [];
};

const deleteByLiquidacion = async (transaction, id_liquidacion) => {
  const request = new sql.Request(transaction);
  await request
    .input('id_liquidacion', sql.Int, id_liquidacion)
    .query(`
      DELETE FROM Liquidacion_Detalles
      WHERE id_liquidacion = @id_liquidacion
    `);
};

module.exports = {
  sanitizeDetalle,
  sanitizeDetalles,
  calcularTotales,
  insertMany,
  getByLiquidacion,
  deleteByLiquidacion,
};
