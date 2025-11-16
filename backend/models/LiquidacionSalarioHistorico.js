/**
 * Modelo de historial salarial. Guarda los valores base usados para
 * el cálculo de liquidaciones en fechas anteriores.
 */
const { sql } = require('../db/db');

const toDecimalOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(2));
};

const formatPeriodo = (value) => {
  if (!value) return null;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      return `${year}-${month}`;
    }
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const sanitizeHistorico = (items) => {
  if (!Array.isArray(items) || items.length === 0) return [];

  const orden = [];
  const acumulado = new Map();

  items.forEach((item) => {
    const periodo =
      formatPeriodo(item?.periodo) ||
      formatPeriodo(item?.periodo_fin) ||
      formatPeriodo(item?.fecha);

    const montoFuente = (() => {
      if (item?.monto !== undefined && item?.monto !== null) return item.monto;
      if (item?.pago_neto !== undefined && item?.pago_neto !== null) return item.pago_neto;
      if (item?.salario_bruto !== undefined && item?.salario_bruto !== null) return item.salario_bruto;
      return null;
    })();

    const monto = toDecimalOrNull(montoFuente);
    if (!periodo || monto === null) return;

    if (!acumulado.has(periodo)) {
      acumulado.set(periodo, 0);
      orden.push(periodo);
    }

    const nuevoTotal = acumulado.get(periodo) + monto;
    acumulado.set(periodo, Number(nuevoTotal.toFixed(2)));
  });

  return orden.map((periodo) => ({ periodo, monto: acumulado.get(periodo) }));
};

const insertMany = async (transaction, id_liquidacion, historicos) => {
  if (!Array.isArray(historicos) || historicos.length === 0) return;

  for (const registro of historicos) {
    const request = new sql.Request(transaction);
    await request
      .input('id_liquidacion', sql.Int, id_liquidacion)
      .input('periodo', sql.Char(7), registro.periodo)
      .input('monto', sql.Decimal(18, 2), registro.monto)
      .query(`
        INSERT INTO Liquidacion_Salarios_Historicos (id_liquidacion, periodo, monto)
        VALUES (@id_liquidacion, @periodo, @monto)
      `);
  }
};

const getByLiquidacion = async (pool, id_liquidacion) => {
  const request = pool.request();
  const result = await request
    .input('id_liquidacion', sql.Int, id_liquidacion)
    .query(`
      SELECT id_historial, id_liquidacion, periodo, monto
      FROM Liquidacion_Salarios_Historicos
      WHERE id_liquidacion = @id_liquidacion
      ORDER BY periodo DESC, id_historial DESC
    `);

  return result.recordset || [];
};

const deleteByLiquidacion = async (transaction, id_liquidacion) => {
  const request = new sql.Request(transaction);
  await request
    .input('id_liquidacion', sql.Int, id_liquidacion)
    .query(`
      DELETE FROM Liquidacion_Salarios_Historicos
      WHERE id_liquidacion = @id_liquidacion
    `);
};

module.exports = {
  sanitizeHistorico,
  insertMany,
  getByLiquidacion,
  deleteByLiquidacion,
};
