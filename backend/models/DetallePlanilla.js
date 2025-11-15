const { poolPromise, sql } = require('../db/db');

const schemaState = {
  checked: false,
  hasEstadoColumn: false,
  hasAsistenciaColumn: false,
  hasTipoColumn: false,
  hasJustificacionColumn: false,
  hasJustificadoColumn: false,
};

const ENSURE_DETALLE_PLANILLA_SCHEMA_QUERY = `
IF OBJECT_ID('dbo.DetallePlanilla', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.DetallePlanilla', 'estado') IS NULL
  BEGIN
    ALTER TABLE dbo.DetallePlanilla
      ADD estado NVARCHAR(50) NULL;
  END;

  IF COL_LENGTH('dbo.DetallePlanilla', 'asistencia') IS NULL
  BEGIN
    ALTER TABLE dbo.DetallePlanilla
      ADD asistencia NVARCHAR(50) NULL;
  END;

  IF COL_LENGTH('dbo.DetallePlanilla', 'tipo') IS NULL
  BEGIN
    ALTER TABLE dbo.DetallePlanilla
      ADD tipo NVARCHAR(50) NULL;
  END;

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
      AND COLUMN_NAME IN ('estado', 'asistencia', 'tipo', 'justificado', 'justificacion')
  `);

  const columnas = new Set(result.recordset.map((row) => row.COLUMN_NAME));

  schemaState.checked = true;
  schemaState.hasEstadoColumn = columnas.has('estado');
  schemaState.hasAsistenciaColumn = columnas.has('asistencia');
  schemaState.hasTipoColumn = columnas.has('tipo');
  schemaState.hasJustificacionColumn = columnas.has('justificacion');
  schemaState.hasJustificadoColumn = columnas.has('justificado');

  return schemaState;
}

class DetallePlanilla {
  static async createMany(transaction, id_planilla, detalles = []) {
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return;
    }

    const {
      hasEstadoColumn,
      hasAsistenciaColumn,
      hasTipoColumn,
      hasJustificacionColumn,
      hasJustificadoColumn,
    } = await resolveSchemaState(
      () => new sql.Request(transaction),
    );

    for (const detalle of detalles) {
      const request = new sql.Request(transaction);
      const asistenciaTexto = (() => {
        if (typeof detalle.asistencia === 'string') {
          const texto = detalle.asistencia.trim();
          if (texto.length > 0) {
            return texto.length > 50 ? texto.slice(0, 50) : texto;
          }
        }
        const base = detalle.asistio ? 'Asistió' : 'Faltó';
        return base;
      })();

      const tipoTexto = (() => {
        if (typeof detalle.tipo === 'string') {
          const texto = detalle.tipo.trim();
          if (texto.length > 0) {
            return texto.length > 50 ? texto.slice(0, 50) : texto;
          }
        }
        const base = detalle.es_dia_doble ? 'Día doble' : 'Normal';
        return base;
      })();

      const estadoTexto = (() => {
        if (typeof detalle.estado === 'string') {
          const texto = detalle.estado.trim();
          if (texto.length > 0) {
            return texto.length > 50 ? texto.slice(0, 50) : texto;
          }
        }
        return detalle.asistio ? 'Presente' : 'Ausente';
      })();

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
        .input('observacion', sql.NVarChar(150), observacionFinal);

      if (hasEstadoColumn) {
        request.input('estado', sql.NVarChar(50), estadoTexto);
      }

      if (hasAsistenciaColumn) {
        request.input('asistencia', sql.NVarChar(50), asistenciaTexto);
      }

      if (hasTipoColumn) {
        request.input('tipo', sql.NVarChar(50), tipoTexto);
      }

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
      ];

      const valores = [
        '@id_planilla',
        '@fecha',
        '@dia_semana',
        '@salario_dia',
        '@asistio',
        '@es_dia_doble',
      ];

      if (hasEstadoColumn) {
        columnas.push('estado');
        valores.push('@estado');
      }

      if (hasAsistenciaColumn) {
        columnas.push('asistencia');
        valores.push('@asistencia');
      }

      if (hasTipoColumn) {
        columnas.push('tipo');
        valores.push('@tipo');
      }

      if (hasJustificadoColumn) {
        columnas.push('justificado');
        valores.push('@justificado');
      }

      if (hasJustificacionColumn) {
        columnas.push('justificacion');
        valores.push('@justificacion');
      }

      columnas.push('observacion');
      valores.push('@observacion');

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
    const {
      hasEstadoColumn,
      hasAsistenciaColumn,
      hasTipoColumn,
      hasJustificacionColumn,
      hasJustificadoColumn,
    } = await resolveSchemaState();

    const justificacionSelect = hasJustificacionColumn
      ? 'justificacion'
      : 'NULL AS justificacion';

    const justificadoSelect = hasJustificadoColumn ? 'justificado' : 'NULL AS justificado';

    const estadoSelect = hasEstadoColumn
      ? 'estado'
      : "CASE WHEN asistio = 1 THEN 'Presente' ELSE 'Ausente' END AS estado";

    const asistenciaSelect = hasAsistenciaColumn
      ? 'asistencia'
      : "CASE WHEN asistio = 1 THEN 'Asistió' ELSE 'Faltó' END AS asistencia";

    const tipoSelect = hasTipoColumn
      ? 'tipo'
      : "CASE WHEN es_dia_doble = 1 THEN 'Día doble' ELSE 'Normal' END AS tipo";

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
          ${asistenciaSelect},
          ${tipoSelect},
          ${estadoSelect},
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
