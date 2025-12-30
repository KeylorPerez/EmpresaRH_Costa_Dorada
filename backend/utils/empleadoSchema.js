const { poolPromise } = require('../db/db');

let cachedPlanillaAutomaticaColumn;

const resolvePlanillaAutomaticaColumn = async (pool) => {
  if (cachedPlanillaAutomaticaColumn !== undefined) {
    return cachedPlanillaAutomaticaColumn;
  }

  const activePool = pool || (await poolPromise);
  const result = await activePool.request().query(`
    SELECT TOP 1 COLUMN_NAME AS column_name
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Empleados'
      AND COLUMN_NAME IN ('planilla_automatica', 'es_automatica')
    ORDER BY CASE WHEN COLUMN_NAME = 'planilla_automatica' THEN 0 ELSE 1 END
  `);

  cachedPlanillaAutomaticaColumn = result.recordset?.[0]?.column_name ?? null;
  return cachedPlanillaAutomaticaColumn;
};

module.exports = {
  resolvePlanillaAutomaticaColumn,
};
