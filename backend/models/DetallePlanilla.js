const { poolPromise, sql } = require('../db/db');

const schemaState = {
  checked: false,
  hasJustificacionColumn: false,
  hasJustificadoColumn: false,
};

const ENSURE_DETALLE_PLANILLA_SCHEMA_QUERY = `
IF OBJECT_ID('dbo.DetallePlanilla', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.DetallePlanilla', 'justificado') IS NULL
  BEGIN
    ALTER TABLE dbo.DetallePlanilla
      ADD justificado BIT NOT NULL CONSTRAINT DF_DetallePlanilla_Justificado DEFAULT (0);
  END;

  IF COL_LENGTH('dbo.DetallePlanilla', 'justificacion') IS NULL
  BEGIN
    ALTER TABLE dbo.DetallePlanilla
      ADD justificacion NVARCHAR(MAX) NULL;
  END;
END;
`;

async function resolveSchemaState(requestFactory) {
  if (schemaState.checked) {
    return schemaState;
  }

  const getRequest = async () => {
    if (typeof requestFactory === 'function') {
      return requestFactory();
    }

    const pool = await poolPromise;
    return pool.request();
  };

  const ensureRequest = await getRequest();
  await ensureRequest.query(ENSURE_DETALLE_PLANILLA_SCHEMA_QUERY);

  const checkRequest = await getRequest();
  const result = await checkRequest.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'DetallePlanilla'
      AND COLUMN_NAME IN ('justificado', 'justificacion')
  `);

  const columnas = new Set(result.recordset.map((row) => row.COLUMN_NAME));

  schemaState.checked = true;
  schemaState.hasJustificacionColumn = columnas.has('justificacion');
  schemaState.hasJustificadoColumn = columnas.has('justificado');

  return schemaState;
}

class DetallePlanilla {
  static async createMany(transaction, id_planilla, detalles = []) {
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return;
    }

    const { hasJustificacionColumn, hasJustificadoColumn } = await resolveSchemaState(
      () => new sql.Request(transaction),
    );

    for (const detalle of detalles) {
      const request = new sql.Request(transaction);
      const estado =
        typeof detalle.estado === 'string' && detalle.estado.trim().length > 0
          ? detalle.estado.trim()
          : 'Presente';
      const justificado = detalle.justificado ? 1 : 0;
      const justificacion = (() => {
        if (!justificado) return null;
        if (detalle.justificacion === undefined || detalle.justificacion === null) {
          return null;
        }
        const texto = String(detalle.justificacion).trim();
        return texto.length > 0 ? texto : null;
      })();

      const observacionOriginal =
        detalle.observacion !== undefined && detalle.observacion !== null
          ? String(detalle.observacion)
          : null;

      const trimmedObservacion =
        observacionOriginal && observacionOriginal.trim().length > 0
          ? observacionOriginal.trim().slice(0, 150)
          : null;

      let observacionFinal = trimmedObservacion;

      if (!hasJustificacionColumn && justificacion) {
        const textoJustificacion = justificacion.length > 150 ? justificacion.slice(0, 150) : justificacion;
        const etiquetaJustificacion = `Justificación: ${textoJustificacion}`;
        if (observacionFinal) {
          const combinado = `${observacionFinal} | ${etiquetaJustificacion}`;
          observacionFinal = combinado.length > 150 ? combinado.slice(0, 150) : combinado;
        } else {
          observacionFinal = etiquetaJustificacion;
        }
      }

      request
        .input('id_planilla', sql.Int, id_planilla)
        .input('fecha', sql.Date, detalle.fecha)
        .input('dia_semana', sql.VarChar(15), detalle.dia_semana)
        .input('salario_dia', sql.Decimal(12, 2), detalle.salario_dia)
        .input('asistio', sql.Bit, detalle.asistio ? 1 : 0)
        .input('es_dia_doble', sql.Bit, detalle.es_dia_doble ? 1 : 0)
        .input('estado', sql.NVarChar(20), estado)
        .input('observacion', sql.NVarChar(150), observacionFinal);

      if (hasJustificadoColumn) {
        request.input('justificado', sql.Bit, justificado);
      }

      if (hasJustificacionColumn) {
        request.input('justificacion', sql.NVarChar(sql.MAX), justificacion);
      }

      const columnas = [
        'id_planilla',
        'fecha',
        'dia_semana',
        'salario_dia',
        'asistio',
        'es_dia_doble',
        'estado',
        'observacion',
      ];

      const valores = [
        '@id_planilla',
        '@fecha',
        '@dia_semana',
        '@salario_dia',
        '@asistio',
        '@es_dia_doble',
        '@estado',
        '@observacion',
      ];

      if (hasJustificadoColumn) {
        columnas.splice(columnas.length - 1, 0, 'justificado');
        valores.splice(valores.length - 1, 0, '@justificado');
      }

      if (hasJustificacionColumn) {
        columnas.splice(columnas.length - 1, 0, 'justificacion');
        valores.splice(valores.length - 1, 0, '@justificacion');
      }

      await request.query(`
        INSERT INTO DetallePlanilla (
          ${columnas.join(',\n          ')}
        )
        VALUES (
          ${valores.join(',\n          ')}
        )
      `);
    }
  }

  static async getByPlanilla(id_planilla) {
    const pool = await poolPromise;
    const { hasJustificacionColumn, hasJustificadoColumn } = await resolveSchemaState();

    const justificacionSelect = hasJustificacionColumn
      ? 'justificacion'
      : 'NULL AS justificacion';

    const justificadoSelect = hasJustificadoColumn ? 'justificado' : 'NULL AS justificado';

    const result = await pool
      .request()
      .input('id_planilla', sql.Int, id_planilla)
      .query(`
        SELECT
          id_detalle,
          id_planilla,
          fecha,
          dia_semana,
          salario_dia,
          asistio,
          es_dia_doble,
          estado,
          ${justificadoSelect},
          ${justificacionSelect},
          observacion
        FROM DetallePlanilla
        WHERE id_planilla = @id_planilla
        ORDER BY fecha ASC
      `);
    return result.recordset;
  }
}

module.exports = DetallePlanilla;
