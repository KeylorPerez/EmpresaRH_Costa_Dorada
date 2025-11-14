const { poolPromise, sql } = require('../db/db');

const schemaState = {
  checked: false,
  hasJustificacionColumn: false,
};

async function resolveSchemaState(requestFactory) {
  if (schemaState.checked) {
    return schemaState;
  }

  let request = null;
  if (typeof requestFactory === 'function') {
    request = requestFactory();
  }

  if (!request) {
    const pool = await poolPromise;
    request = pool.request();
  }

  const result = await request.query(`
    SELECT 1 AS existe
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'DetallePlanilla'
      AND COLUMN_NAME = 'justificacion'
  `);

  schemaState.checked = true;
  schemaState.hasJustificacionColumn = result.recordset.length > 0;

  return schemaState;
}

class DetallePlanilla {
  static async createMany(transaction, id_planilla, detalles = []) {
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return;
    }

    const { hasJustificacionColumn } = await resolveSchemaState(() => new sql.Request(transaction));

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
        .input('justificado', sql.Bit, justificado)
        .input('observacion', sql.NVarChar(150), observacionFinal);

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
        'justificado',
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
        '@justificado',
        '@observacion',
      ];

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
    const { hasJustificacionColumn } = await resolveSchemaState();

    const justificacionSelect = hasJustificacionColumn
      ? 'justificacion'
      : 'NULL AS justificacion';

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
          justificado,
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
