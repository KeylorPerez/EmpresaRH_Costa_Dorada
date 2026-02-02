/**
 * Modelo de detalle de planilla. Separa la información diaria y
 * facilita los cálculos de asistencia asociados a cada pago.
 */
const { poolPromise, sql } = require('../db/db');
const DescansoConfig = require('./DescansoConfig');

const MS_POR_DIA = 1000 * 60 * 60 * 24;
const ESTADOS_ASISTENCIA = ['Presente', 'Ausente', 'Permiso', 'Vacaciones', 'Incapacidad', 'Descanso'];

const parseUtcDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const normalizeDiaSemana = (value) => {
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    const map = {
      domingo: 0,
      lunes: 1,
      martes: 2,
      miércoles: 3,
      miercoles: 3,
      jueves: 4,
      viernes: 5,
      sábado: 6,
      sabado: 6,
    };
    if (Object.prototype.hasOwnProperty.call(map, trimmed)) {
      return map[trimmed];
    }
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric === 7) return 0;
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
  return null;
};

const resolveDescansoPeriod = (fecha, config) => {
  if (!fecha || !config) return null;
  const tipoPatron = String(config.tipo_patron || '').trim().toUpperCase();
  if (tipoPatron !== 'ALTERNADO') {
    return 'A';
  }

  const fechaBase = parseUtcDate(config.fecha_base);
  if (!fechaBase) return 'A';

  const ciclo = String(config.ciclo || '').trim().toUpperCase();
  const cicloDias = ciclo === 'QUINCENAL' ? 15 : 7;
  if (!Number.isFinite(cicloDias) || cicloDias <= 0) {
    return 'A';
  }

  const diffDays = Math.floor((fecha.getTime() - fechaBase.getTime()) / MS_POR_DIA);
  const periodIndex = Math.floor(diffDays / cicloDias);
  const parity = ((periodIndex % 2) + 2) % 2;
  return parity === 0 ? 'A' : 'B';
};

const buildDescansoFechaSet = async ({ id_empleado, periodo_inicio, periodo_fin }) => {
  if (!id_empleado || !periodo_inicio || !periodo_fin) {
    return new Set();
  }

  const descansoConfig = await DescansoConfig.getByEmpleadoIdForFecha(
    id_empleado,
    periodo_inicio
  );
  if (!descansoConfig) {
    return new Set();
  }

  const descansoDias = await DescansoConfig.getDiasByConfigId(descansoConfig.id_config);
  const diasA = new Set();
  const diasB = new Set();

  if (Array.isArray(descansoDias)) {
    descansoDias.forEach((dia) => {
      if (!dia || !dia.es_descanso) return;
      const periodo = String(dia.periodo_tipo || '').trim().toUpperCase();
      const diaSemana = normalizeDiaSemana(dia.dia_semana);
      if (diaSemana === null) return;
      if (periodo === 'B') {
        diasB.add(diaSemana);
      } else {
        diasA.add(diaSemana);
      }
    });
  }

  if (diasA.size === 0 && diasB.size === 0) {
    return new Set();
  }

  const inicioVigencia = parseUtcDate(descansoConfig.fecha_inicio_vigencia);
  const finVigencia = parseUtcDate(descansoConfig.fecha_fin_vigencia);
  const fechaInicio = parseUtcDate(periodo_inicio);
  const fechaFin = parseUtcDate(periodo_fin);

  if (!inicioVigencia || !fechaInicio || !fechaFin) {
    return new Set();
  }

  let cursor = fechaInicio > inicioVigencia ? fechaInicio : inicioVigencia;
  const limite = finVigencia && finVigencia < fechaFin ? finVigencia : fechaFin;

  if (cursor > limite) {
    return new Set();
  }

  const descansos = new Set();
  const alternado = String(descansoConfig.tipo_patron || '').trim().toUpperCase() === 'ALTERNADO'
    && diasB.size > 0;

  while (cursor <= limite) {
    const periodo = alternado ? resolveDescansoPeriod(cursor, descansoConfig) : 'A';
    const set = periodo === 'B' ? diasB : diasA;
    if (set.has(cursor.getUTCDay())) {
      descansos.add(cursor.toISOString().split('T')[0]);
    }
    cursor = new Date(cursor.getTime() + MS_POR_DIA);
  }

  return descansos;
};

const applyDescansoMetadata = (detalles, descansoFechas) => {
  if (!Array.isArray(detalles) || detalles.length === 0 || !descansoFechas || descansoFechas.size === 0) {
    return detalles;
  }

  return detalles.map((detalle) => {
    if (!detalle || !detalle.fecha) return detalle;

    const fechaKey = parseUtcDate(detalle.fecha)?.toISOString().split('T')[0];
    if (!fechaKey || !descansoFechas.has(fechaKey)) {
      return { ...detalle, es_descanso: false };
    }

    const estadoTexto = typeof detalle.estado === 'string' ? detalle.estado.trim() : '';
    const estadoNormalizado = ESTADOS_ASISTENCIA.includes(estadoTexto) ? estadoTexto : '';

    if (detalle.asistio) {
      return { ...detalle, es_descanso: true };
    }

    if (estadoNormalizado && estadoNormalizado !== 'Presente' && estadoNormalizado !== 'Ausente') {
      return { ...detalle, es_descanso: true };
    }

    return {
      ...detalle,
      asistio: false,
      es_descanso: true,
      estado: 'Descanso',
      asistencia: 'Descanso',
      justificado: true,
      justificacion: detalle.justificacion || 'Descanso programado',
    };
  });
};

const schemaState = {
  checked: false,
  hasEstadoColumn: false,
  hasAsistenciaColumn: false,
  hasTipoColumn: false,
  hasJustificacionColumn: false,
  hasJustificadoColumn: false,
};

const ENSURE_DETALLE_PLANILLA_SCHEMA_QUERY = `
IF NOT EXISTS (
  SELECT *
  FROM sys.objects
  WHERE object_id = OBJECT_ID(N'[dbo].[DetallePlanilla]')
    AND type in (N'U')
)
BEGIN
  CREATE TABLE [dbo].[DetallePlanilla](
    [id_detalle] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [id_planilla] INT NOT NULL,
    [fecha] DATE NOT NULL,
    [dia_semana] INT NOT NULL,
    [salario_dia] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_DetallePlanilla_SalarioDia DEFAULT (0),
    [asistio] BIT NOT NULL CONSTRAINT DF_DetallePlanilla_Asistio DEFAULT (1),
    [es_dia_doble] BIT NOT NULL CONSTRAINT DF_DetallePlanilla_EsDiaDoble DEFAULT (0),
    [observacion] NVARCHAR(150) NULL,
    [estado] NVARCHAR(50) NULL,
    [asistencia] NVARCHAR(50) NULL,
    [tipo] NVARCHAR(50) NULL,
    [justificado] BIT NOT NULL CONSTRAINT DF_DetallePlanilla_Justificado DEFAULT (0),
    [justificacion] NVARCHAR(MAX) NULL,
    CONSTRAINT FK_DetallePlanilla_Planilla FOREIGN KEY (id_planilla) REFERENCES dbo.Planilla(id_planilla)
  );
END;

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
  static async ensureSchema() {
    const pool = await poolPromise;

    // Garantizamos que la tabla Planilla exista antes de agregar la clave
    // foránea. Esto evita errores cuando la base de datos está vacía y el
    // esquema aún no ha sido creado.
    try {
      const Planilla = require('./Planilla');
      if (Planilla?.ensureSchema) {
        await Planilla.ensureSchema();
      }
    } catch (err) {
      // Si por algún motivo no podemos importar o asegurar la tabla, no
      // interrumpimos la creación del detalle. El error se registrará más
      // adelante al intentar crear la clave foránea.
      console.error('[Planilla] No se pudo asegurar el esquema de planilla:', err.message);
    }

    await resolveSchemaState(() => pool.request());
  }

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
        INSERT INTO dbo.DetallePlanilla (
          ${columnas.join(',\n          ')}
        )
        VALUES (
          ${valores.join(',\n          ')}
        )
      `);
    }
  }

  static async deleteByPlanilla(transactionOrId, maybeId) {
    let request;
    let id_planilla;

    if (transactionOrId && typeof transactionOrId.input === 'function' && maybeId !== undefined) {
      request = transactionOrId;
      id_planilla = maybeId;
    } else if (transactionOrId && transactionOrId instanceof sql.Transaction) {
      request = new sql.Request(transactionOrId);
      id_planilla = maybeId;
    } else {
      const pool = await poolPromise;
      request = pool.request();
      id_planilla = transactionOrId;
    }

    if (!Number.isInteger(Number(id_planilla))) {
      return;
    }

    await resolveSchemaState(() => request);

    await request
      .input('id_planilla', sql.Int, Number(id_planilla))
      .query('DELETE FROM dbo.DetallePlanilla WHERE id_planilla = @id_planilla');
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
      ? 'dp.justificacion'
      : 'NULL AS justificacion';

    const justificadoSelect = hasJustificadoColumn ? 'dp.justificado' : 'NULL AS justificado';

    const estadoSelect = hasEstadoColumn
      ? 'dp.estado'
      : "CASE WHEN dp.asistio = 1 THEN 'Presente' ELSE 'Ausente' END AS estado";

    const asistenciaSelect = hasAsistenciaColumn
      ? 'dp.asistencia'
      : "CASE WHEN dp.asistio = 1 THEN 'Asistió' ELSE 'Faltó' END AS asistencia";

    const tipoSelect = hasTipoColumn
      ? 'dp.tipo'
      : "CASE WHEN dp.es_dia_doble = 1 THEN 'Día doble' ELSE 'Normal' END AS tipo";

    const result = await pool
      .request()
      .input('id_planilla', sql.Int, id_planilla)
      .query(`
        SELECT
          dp.id_detalle,
          dp.id_planilla,
          dp.fecha,
          dp.dia_semana,
          dp.salario_dia,
          dp.asistio,
          dp.es_dia_doble,
          ${asistenciaSelect},
          ${tipoSelect},
          ${estadoSelect},
          ${justificadoSelect},
          ${justificacionSelect},
          dp.observacion,
          p.id_empleado,
          p.periodo_inicio,
          p.periodo_fin,
          marcas.hora_entrada,
          marcas.hora_salida
        FROM dbo.DetallePlanilla dp
        INNER JOIN dbo.Planilla p ON p.id_planilla = dp.id_planilla
        LEFT JOIN (
          SELECT
            CONVERT(date, a.fecha) AS fecha,
            a.id_empleado,
            MIN(CASE WHEN a.tipo_marca = 'entrada' THEN CONVERT(varchar(8), a.hora, 108) END) AS hora_entrada,
            MAX(CASE WHEN a.tipo_marca = 'salida' THEN CONVERT(varchar(8), a.hora, 108) END) AS hora_salida
          FROM Asistencia a
          WHERE a.tipo_marca IN ('entrada', 'salida')
          GROUP BY CONVERT(date, a.fecha), a.id_empleado
        ) AS marcas ON marcas.fecha = CONVERT(date, dp.fecha) AND marcas.id_empleado = p.id_empleado
        WHERE dp.id_planilla = @id_planilla
        ORDER BY dp.fecha ASC
      `);
    const detalles = result.recordset || [];
    if (detalles.length === 0) {
      return detalles;
    }

    const { id_empleado, periodo_inicio, periodo_fin } = detalles[0];
    const descansoFechas = await buildDescansoFechaSet({
      id_empleado,
      periodo_inicio,
      periodo_fin,
    });

    const detallesConDescanso = applyDescansoMetadata(detalles, descansoFechas);
    return detallesConDescanso.map((detalle) => {
      const {
        id_empleado: unusedEmpleado,
        periodo_inicio: unusedInicio,
        periodo_fin: unusedFin,
        ...rest
      } = detalle;
      return rest;
    });
  }
}

module.exports = DetallePlanilla;
