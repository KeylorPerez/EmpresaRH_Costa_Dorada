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

const resolvePeriodoTipo = ({ ciclo, fechaBase, fecha }) => {
  if (ciclo === 'QUINCENAL') {
    const diffDays = Math.floor((fecha.getTime() - fechaBase.getTime()) / MS_POR_DIA);
    const blockIndex = Math.floor(diffDays / 15);
    const isEven = Math.abs(blockIndex) % 2 === 0;
    return isEven ? 'A' : 'B';
  }

  const diffDays = Math.floor((fecha.getTime() - fechaBase.getTime()) / MS_POR_DIA);
  const blockIndex = Math.floor(diffDays / 7);
  const isEven = Math.abs(blockIndex) % 2 === 0;
  return isEven ? 'A' : 'B';
};

const normalizePeriodoTipo = (value) => {
  if (!value) return null;
  const normalized = String(value).trim().toUpperCase();
  return normalized ? normalized : null;
};

const getDescansoConfigDiasInRange = async ({
  id_empleado,
  periodo_inicio,
  periodo_fin,
  transaction,
}) => {
  const pool = await poolPromise;
  const request = transaction ? new sql.Request(transaction) : pool.request();
  const result = await request
    .input('id_empleado', sql.Int, id_empleado)
    .input('periodo_inicio', sql.Date, periodo_inicio)
    .input('periodo_fin', sql.Date, periodo_fin)
    .query(`
      SELECT
        c.id_config,
        c.ciclo,
        c.fecha_base,
        c.fecha_inicio_vigencia,
        c.fecha_fin_vigencia,
        d.periodo_tipo,
        d.dia_semana,
        d.es_descanso
      FROM DescansoConfig c
      LEFT JOIN DescansoDias d ON d.id_config = c.id_config
      WHERE c.id_empleado = @id_empleado
        AND c.fecha_inicio_vigencia <= @periodo_fin
        AND (c.fecha_fin_vigencia IS NULL OR c.fecha_fin_vigencia >= @periodo_inicio)
      ORDER BY c.fecha_inicio_vigencia DESC, c.id_config DESC;
    `);

  return result.recordset;
};

const buildDescansoConfigMap = (rows = []) => {
  const configMap = new Map();

  rows.forEach((row) => {
    if (!row?.id_config) return;
    const idConfig = Number(row.id_config);
    if (!configMap.has(idConfig)) {
      configMap.set(idConfig, {
        id_config: idConfig,
        ciclo: typeof row.ciclo === 'string' ? row.ciclo.trim().toUpperCase() : 'SEMANAL',
        fecha_base: parseUtcDate(row.fecha_base),
        fecha_inicio_vigencia: parseUtcDate(row.fecha_inicio_vigencia),
        fecha_fin_vigencia: parseUtcDate(row.fecha_fin_vigencia),
        dias: {},
      });
    }

    const periodoTipo = normalizePeriodoTipo(row.periodo_tipo);
    const diaSemana =
      row.dia_semana === 0 || row.dia_semana ? Number(row.dia_semana) : Number.NaN;
    if (!periodoTipo || Number.isNaN(diaSemana)) return;

    const config = configMap.get(idConfig);
    if (!config.dias[periodoTipo]) {
      config.dias[periodoTipo] = {};
    }
    config.dias[periodoTipo][diaSemana] = isTruthyBit(row.es_descanso);
  });

  return Array.from(configMap.values()).sort((a, b) => {
    const startA = a.fecha_inicio_vigencia ? a.fecha_inicio_vigencia.getTime() : 0;
    const startB = b.fecha_inicio_vigencia ? b.fecha_inicio_vigencia.getTime() : 0;
    if (startA !== startB) return startB - startA;
    return (b.id_config || 0) - (a.id_config || 0);
  });
};

const pickDescansoConfigForDate = (configs, fecha) =>
  configs.find((config) => {
    if (!config?.fecha_inicio_vigencia) return false;
    if (fecha < config.fecha_inicio_vigencia) return false;
    if (config.fecha_fin_vigencia && fecha > config.fecha_fin_vigencia) return false;
    return true;
  }) || null;

const resolveDescansoDiaFromConfigs = (configs, fecha) => {
  const fechaEvaluada = parseUtcDate(fecha);
  if (!fechaEvaluada) {
    return { es_descanso: false, periodo_tipo: null, config_aplicada: false, id_config: null };
  }

  const config = pickDescansoConfigForDate(configs, fechaEvaluada);
  if (!config) {
    return { es_descanso: false, periodo_tipo: null, config_aplicada: false, id_config: null };
  }

  if (!config.fecha_base) {
    return { es_descanso: false, periodo_tipo: null, config_aplicada: true, id_config: config.id_config };
  }

  const ciclo = config.ciclo || 'SEMANAL';
  const periodo_tipo = resolvePeriodoTipo({ ciclo, fechaBase: config.fecha_base, fecha: fechaEvaluada });
  const dia_semana = fechaEvaluada.getUTCDay();
  const periodosDisponibles = config.dias ? Object.keys(config.dias) : [];
  let descansoValue = config.dias?.[periodo_tipo]?.[dia_semana];

  if (descansoValue === undefined && periodosDisponibles.length === 1) {
    descansoValue = config.dias?.[periodosDisponibles[0]]?.[dia_semana];
  }

  return {
    es_descanso: isTruthyBit(descansoValue),
    periodo_tipo,
    config_aplicada: true,
    id_config: config.id_config,
  };
};

const buildDescansoResolver = async (id_empleado, periodo_inicio, periodo_fin, { transaction } = {}) => {
  const inicio = parseUtcDate(periodo_inicio);
  const fin = parseUtcDate(periodo_fin);
  if (!inicio || !fin || fin < inicio) return null;

  const rows = await getDescansoConfigDiasInRange({
    id_empleado,
    periodo_inicio: inicio,
    periodo_fin: fin,
    transaction,
  });

  const configs = buildDescansoConfigMap(rows);
  if (configs.length === 0) return null;

  return (fecha) => resolveDescansoDiaFromConfigs(configs, fecha);
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
  buildDescansoResolver,
  resolveDescansoDia,
};
