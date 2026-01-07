/**
 * Helper de descanso por empleado y fecha.
 * Determina el periodo (A/B) y si el día es descanso según la configuración vigente.
 */
const { poolPromise, sql } = require('../db/db');

const MS_POR_DIA = 1000 * 60 * 60 * 24;

const isTruthyBit = (value) => Number(value) === 1 || value === true;

const parseUtcDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const addDays = (date, days) => new Date(date.getTime() + days * MS_POR_DIA);

const getQuincenaIndex = (date) => {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const halfIndex = day <= 15 ? 0 : 1;
  return year * 24 + month * 2 + halfIndex;
};

const resolvePeriodoTipo = ({ ciclo, fechaBase, fecha }) => {
  if (ciclo === 'QUINCENAL') {
    const diffQuincenas = getQuincenaIndex(fecha) - getQuincenaIndex(fechaBase);
    const isEven = Math.abs(diffQuincenas) % 2 === 0;
    return isEven ? 'A' : 'B';
  }

  const diffDays = Math.floor((fecha.getTime() - fechaBase.getTime()) / MS_POR_DIA);
  const blockIndex = Math.floor(diffDays / 7);
  const isEven = Math.abs(blockIndex) % 2 === 0;
  return isEven ? 'A' : 'B';
};

const getDescansoConfigVigente = async ({ id_empleado, fecha, transaction }) => {
  const pool = await poolPromise;
  const request = transaction ? new sql.Request(transaction) : pool.request();
  const result = await request
    .input('id_empleado', sql.Int, id_empleado)
    .input('fecha', sql.Date, fecha)
    .query(`
      SELECT TOP 1
        id_config,
        ciclo,
        fecha_base,
        fecha_inicio_vigencia,
        fecha_fin_vigencia
      FROM DescansoConfig
      WHERE id_empleado = @id_empleado
        AND fecha_inicio_vigencia <= @fecha
        AND (fecha_fin_vigencia IS NULL OR fecha_fin_vigencia >= @fecha)
      ORDER BY fecha_inicio_vigencia DESC, id_config DESC;
    `);

  return result.recordset[0] || null;
};

const getDescansoDiaConfig = async ({ id_config, periodo_tipo, dia_semana, transaction }) => {
  const pool = await poolPromise;
  const request = transaction ? new sql.Request(transaction) : pool.request();
  const result = await request
    .input('id_config', sql.Int, id_config)
    .input('periodo_tipo', sql.Char(1), periodo_tipo)
    .input('dia_semana', sql.TinyInt, dia_semana)
    .query(`
      SELECT TOP 1
        es_descanso
      FROM DescansoDias
      WHERE id_config = @id_config
        AND periodo_tipo = @periodo_tipo
        AND dia_semana = @dia_semana;
    `);

  return result.recordset[0] || null;
};

const resolveDescansoDia = async (id_empleado, fecha, { transaction } = {}) => {
  const fechaEvaluada = parseUtcDate(fecha);
  if (!fechaEvaluada) {
    return { es_descanso: false, periodo_tipo: null, config_aplicada: false, id_config: null };
  }

  const config = await getDescansoConfigVigente({
    id_empleado,
    fecha: fechaEvaluada,
    transaction,
  });

  if (!config) {
    return { es_descanso: false, periodo_tipo: null, config_aplicada: false, id_config: null };
  }

  const fechaBase = parseUtcDate(config.fecha_base);
  if (!fechaBase) {
    return {
      es_descanso: false,
      periodo_tipo: null,
      config_aplicada: true,
      id_config: config.id_config,
    };
  }

  const ciclo = typeof config.ciclo === 'string' ? config.ciclo.trim().toUpperCase() : 'SEMANAL';
  const periodo_tipo = resolvePeriodoTipo({ ciclo, fechaBase, fecha: fechaEvaluada });
  const dia_semana = fechaEvaluada.getUTCDay();

  const descansoDia = await getDescansoDiaConfig({
    id_config: config.id_config,
    periodo_tipo,
    dia_semana,
    transaction,
  });

  return {
    es_descanso: descansoDia ? isTruthyBit(descansoDia.es_descanso) : false,
    periodo_tipo,
    config_aplicada: true,
    id_config: config.id_config,
  };
};

module.exports = {
  addDays,
  parseUtcDate,
  resolveDescansoDia,
};
