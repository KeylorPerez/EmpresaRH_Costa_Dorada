const { poolPromise } = require('../db/db');

let cachedPlanillaAutomaticaColumn;

const resolvePlanillaAutomaticaColumn = async (pool) => {
  if (cachedPlanillaAutomaticaColumn !== undefined) {
    return cachedPlanillaAutomaticaColumn;
  }

  const activePool = pool || (await poolPromise);
  const result = await activePool.request().query(`
    SELECT
      CASE
        WHEN COL_LENGTH('Empleados', 'es_automatica') IS NOT NULL THEN 'es_automatica'
        WHEN COL_LENGTH('Empleados', 'planilla_automatica') IS NOT NULL THEN 'planilla_automatica'
        ELSE NULL
      END AS column_name
  `);

  cachedPlanillaAutomaticaColumn = result.recordset[0]?.column_name ?? null;
  return cachedPlanillaAutomaticaColumn;
};

module.exports = {
  resolvePlanillaAutomaticaColumn,
};
