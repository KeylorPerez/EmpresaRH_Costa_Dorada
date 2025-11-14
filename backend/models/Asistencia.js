const { poolPromise, sql } = require('../db/db');
const JustificacionAsistencia = require('./JustificacionAsistencia');

const TIPOS_MARCA = ['entrada', 'salida', 'almuerzo_inicio', 'almuerzo_fin'];
const ESTADOS_ASISTENCIA = ['Presente', 'Ausente', 'Permiso', 'Vacaciones', 'Incapacidad'];

const schemaState = {
  checked: false,
  hasJustificadoColumn: false,
  hasJustificacionColumn: false,
};

const SELECT_FALLBACKS = {
  justificado: 'CAST(0 AS BIT) AS justificado',
  justificacion: 'CAST(NULL AS NVARCHAR(MAX)) AS justificacion',
};

const buildSelectFragments = ({ hasJustificadoColumn, hasJustificacionColumn }) => ({
  justificado: hasJustificadoColumn ? 'a.justificado AS justificado' : SELECT_FALLBACKS.justificado,
  justificacion: hasJustificacionColumn
    ? 'a.justificacion AS justificacion'
    : SELECT_FALLBACKS.justificacion,
});

const ENSURE_ASISTENCIA_SCHEMA_QUERY = `
IF OBJECT_ID('dbo.Asistencia', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Asistencia', 'justificado') IS NULL
  BEGIN
    ALTER TABLE dbo.Asistencia
      ADD justificado BIT NOT NULL CONSTRAINT DF_Asistencia_Justificado DEFAULT (0);
  END;

  IF COL_LENGTH('dbo.Asistencia', 'justificacion') IS NULL
  BEGIN
    ALTER TABLE dbo.Asistencia
      ADD justificacion NVARCHAR(MAX) NULL;
  END;
END;
`;

const JUSTIFICACION_SELECT = `
          , js.id_solicitud AS justificacion_solicitud_id
          , js.tipo AS justificacion_solicitud_tipo
          , js.descripcion AS justificacion_solicitud_descripcion
          , js.estado AS justificacion_solicitud_estado
          , js.respuesta AS justificacion_solicitud_respuesta
          , CONVERT(varchar(19), js.created_at, 120) AS justificacion_solicitud_creada
          , CONVERT(varchar(19), js.updated_at, 120) AS justificacion_solicitud_actualizada
`;

const JUSTIFICACION_JOIN = `
  LEFT JOIN (
    SELECT
      ja.id_asistencia,
      ja.id_solicitud,
      ja.tipo,
      ja.descripcion,
      ja.estado,
      ja.respuesta,
      ja.created_at,
      ja.updated_at,
      ROW_NUMBER() OVER (PARTITION BY ja.id_asistencia ORDER BY ja.created_at DESC, ja.id_solicitud DESC) AS rn
    FROM JustificacionAsistencia ja
  ) AS js ON js.id_asistencia = a.id_asistencia AND js.rn = 1
`;

class Asistencia {
  static async ensureSchema({ force = false } = {}) {
    if (schemaState.checked && !force) {
      return schemaState;
    }

    const pool = await poolPromise;
    await pool.request().query(ENSURE_ASISTENCIA_SCHEMA_QUERY);

    const result = await pool
      .request()
      .query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Asistencia'
          AND COLUMN_NAME IN ('justificado', 'justificacion')
      `);

    const columns = new Set(result.recordset.map((row) => row.COLUMN_NAME));
    schemaState.hasJustificadoColumn = columns.has('justificado');
    schemaState.hasJustificacionColumn = columns.has('justificacion');
    schemaState.checked = schemaState.hasJustificadoColumn && schemaState.hasJustificacionColumn;

    return schemaState;
  }

  // Obtener todas las marcas (con información básica del empleado)
  static async getAll() {
    try {
      await this.ensureSchema();
      await JustificacionAsistencia.ensureTable();
      const pool = await poolPromise;
      const { justificado, justificacion } = buildSelectFragments(state);
      const result = await pool.request()
        .query(`
          SELECT
            a.id_asistencia,
            CONVERT(varchar(10), a.fecha, 23) AS fecha,
            CONVERT(varchar(8), a.hora, 108) AS hora,
            a.id_empleado,
            a.tipo_marca,
            a.estado,
            ${justificado},
            ${justificacion},
            a.observaciones,
            a.latitud,
            a.longitud,
            e.nombre,
            e.apellido
${JUSTIFICACION_SELECT}
          FROM Asistencia a
          INNER JOIN Empleados e ON a.id_empleado = e.id_empleado
          ${JUSTIFICACION_JOIN}
          ORDER BY a.fecha DESC, a.hora DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async countDistinctDays(id_empleado, startDate, endDate) {
    try {
      await this.ensureSchema();
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('start', sql.VarChar(10), startDate)
        .input('end', sql.VarChar(10), endDate)
        .query(`
          SELECT COUNT(DISTINCT fecha) AS dias
          FROM Asistencia
          WHERE id_empleado = @id_empleado
            AND fecha BETWEEN CONVERT(date, @start, 23) AND CONVERT(date, @end, 23)
        `);

      const dias = Number(result.recordset[0]?.dias);
      if (!Number.isFinite(dias) || dias < 0) {
        return 0;
      }

      return dias;
    } catch (err) {
      throw err;
    }
  }

  static async getDistinctAttendanceDays(id_empleado, startDate, endDate) {
    try {
      await this.ensureSchema();
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('start', sql.VarChar(10), startDate)
        .input('end', sql.VarChar(10), endDate)
        .query(`
          SELECT CONVERT(varchar(10), fecha, 23) AS fecha
          FROM Asistencia
          WHERE id_empleado = @id_empleado
            AND fecha BETWEEN CONVERT(date, @start, 23) AND CONVERT(date, @end, 23)
          GROUP BY fecha
          ORDER BY fecha
        `);

      return result.recordset
        .map((row) => row.fecha)
        .filter((fecha) => typeof fecha === 'string' && fecha.length > 0);
    } catch (err) {
      throw err;
    }
  }

  // Obtener marcas por empleado
  static async getByEmpleado(id_empleado) {
    try {
      const state = await this.ensureSchema();
      await JustificacionAsistencia.ensureTable();
      const pool = await poolPromise;
      const { justificado, justificacion } = buildSelectFragments(state);
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT
            id_asistencia,
            CONVERT(varchar(10), fecha, 23) AS fecha,
            CONVERT(varchar(8), hora, 108) AS hora,
            id_empleado,
            tipo_marca,
            estado,
            ${justificado},
            ${justificacion},
            observaciones,
            latitud,
            longitud
          ${JUSTIFICACION_SELECT}
          FROM Asistencia a
          ${JUSTIFICACION_JOIN}
          WHERE id_empleado = @id_empleado
          ORDER BY a.fecha DESC, a.hora DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Obtener por rango de fechas (opcional por empleado)
  static async getByDateRange(startDate, endDate, id_empleado = null) {
    try {
      const state = await this.ensureSchema();
      await JustificacionAsistencia.ensureTable();
      const pool = await poolPromise;
      const req = pool.request()
        .input('start', sql.VarChar(10), startDate)
        .input('end', sql.VarChar(10), endDate);

      const { justificado, justificacion } = buildSelectFragments(state);

      let query = `
        SELECT
          a.id_asistencia,
          CONVERT(varchar(10), a.fecha, 23) AS fecha,
          CONVERT(varchar(8), a.hora, 108) AS hora,
          a.id_empleado,
          a.tipo_marca,
          a.estado,
          ${justificado},
          ${justificacion},
          a.observaciones,
          a.latitud,
          a.longitud,
          e.nombre,
          e.apellido
${JUSTIFICACION_SELECT}
        FROM Asistencia a
        LEFT JOIN Empleados e ON a.id_empleado = e.id_empleado
        ${JUSTIFICACION_JOIN}
        WHERE a.fecha BETWEEN CONVERT(date, @start, 23) AND CONVERT(date, @end, 23)
      `;

      if (id_empleado) {
        req.input('id_empleado', sql.Int, id_empleado);
        query += ` AND a.id_empleado = @id_empleado`;
      }

      query += ` ORDER BY a.fecha, a.hora`;

      const result = await req.query(query);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async findById(id_asistencia) {
    try {
      const state = await this.ensureSchema();
      const pool = await poolPromise;
      const { justificado, justificacion } = buildSelectFragments(state);
      const result = await pool.request()
        .input('id_asistencia', sql.Int, id_asistencia)
        .query(`
          SELECT
            id_asistencia,
            CONVERT(varchar(10), fecha, 23) AS fecha,
            CONVERT(varchar(8), hora, 108) AS hora,
            id_empleado,
            tipo_marca,
            estado,
            ${justificado},
            ${justificacion},
            observaciones,
            latitud,
            longitud
          FROM Asistencia
          WHERE id_asistencia = @id_asistencia
        `);
      return result.recordset[0] || null;
    } catch (err) {
      throw err;
    }
  }

  static async findByEmpleadoFechaTipo(id_empleado, fecha, tipo_marca) {
    try {
      await this.ensureSchema();
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('fecha', sql.VarChar(10), fecha)
        .input('tipo_marca', sql.VarChar(20), tipo_marca)
        .query(`
          SELECT TOP 1 *
          FROM Asistencia
          WHERE id_empleado = @id_empleado
            AND fecha = CONVERT(date, @fecha, 23)
            AND tipo_marca = @tipo_marca
        `);
      return result.recordset[0] || null;
    } catch (err) {
      throw err;
    }
  }

  // Crear nueva marca de asistencia
  static async create({
    id_empleado,
    fecha = null,
    hora,
    tipo_marca,
    estado = 'Presente',
    justificado = false,
    justificacion = null,
    observaciones = null,
    latitud = null,
    longitud = null,
  }) {
    try {
      const state = await this.ensureSchema();
      if (!TIPOS_MARCA.includes(tipo_marca)) {
        throw new Error(`tipo_marca inválido. Debe ser uno de: ${TIPOS_MARCA.join(', ')}`);
      }

      const estadoNormalizado =
        typeof estado === 'string' && ESTADOS_ASISTENCIA.includes(estado.trim())
          ? estado.trim()
          : 'Presente';
      const justificadoValor = justificado === true || justificado === 1 || justificado === '1';
      const justificacionValor =
        justificacion === undefined || justificacion === null
          ? null
          : String(justificacion).trim() || null;

      // 🔹 Formatear hora para SQL Server
      let horaSql;
      if (hora instanceof Date) {
        horaSql = hora.toTimeString().split(' ')[0] + '.000';
      } else if (typeof hora === 'string') {
        const parts = hora.split(':');
        const h = parts[0] || '00';
        const m = parts[1] || '00';
        const s = parts[2] || '00';
        horaSql = `${h.padStart(2,'0')}:${m.padStart(2,'0')}:${s.padStart(2,'0')}.000`;
      } else {
        // Si no viene hora, usar ahora
        const now = new Date();
        horaSql = now.toTimeString().split(' ')[0] + '.000';
      }

      const pool = await poolPromise;
      const request = pool
        .request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('fecha', sql.VarChar(10), fecha)
        .input('hora', sql.Time, horaSql)
        .input('tipo_marca', sql.VarChar(20), tipo_marca)
        .input('estado', sql.NVarChar(20), estadoNormalizado)
        .input('observaciones', sql.NVarChar(sql.MAX), observaciones)
        .input('latitud', sql.Decimal(9, 6), latitud)
        .input('longitud', sql.Decimal(9, 6), longitud);

      const columns = [
        'id_empleado',
        'fecha',
        'hora',
        'tipo_marca',
        'estado',
      ];
      const values = [
        '@id_empleado',
        "COALESCE(CONVERT(date, @fecha, 23), CAST(GETDATE() AS date))",
        '@hora',
        '@tipo_marca',
        '@estado',
      ];

      if (state.hasJustificadoColumn) {
        request.input('justificado', sql.Bit, justificadoValor ? 1 : 0);
        columns.push('justificado');
        values.push('@justificado');
      }

      if (state.hasJustificacionColumn) {
        request.input('justificacion', sql.NVarChar(sql.MAX), justificacionValor);
        columns.push('justificacion');
        values.push('@justificacion');
      }

      columns.push('observaciones', 'latitud', 'longitud');
      values.push('@observaciones', '@latitud', '@longitud');

      const insertQuery = `
        INSERT INTO Asistencia (
          ${columns.join(',\n          ')}
        )
        VALUES (
          ${values.join(',\n          ')}
        );
        SELECT SCOPE_IDENTITY() AS id_asistencia;
      `;

      const result = await request.query(insertQuery);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // Actualizar tipo_marca u observaciones
  static async update(id_asistencia, { tipo_marca, observaciones = null, estado, justificado, justificacion }) {
    try {
      const state = await this.ensureSchema();
      if (tipo_marca && !TIPOS_MARCA.includes(tipo_marca)) {
        throw new Error(`tipo_marca inválido. Debe ser uno de: ${TIPOS_MARCA.join(', ')}`);
      }

      let estadoNormalizado = null;
      if (estado !== undefined) {
        if (estado === null) {
          throw new Error(`estado inválido. Debe ser uno de: ${ESTADOS_ASISTENCIA.join(', ')}`);
        }
        if (typeof estado !== 'string') {
          throw new Error(`estado inválido. Debe ser uno de: ${ESTADOS_ASISTENCIA.join(', ')}`);
        }
        const trimmed = estado.trim();
        if (!ESTADOS_ASISTENCIA.includes(trimmed)) {
          throw new Error(`estado inválido. Debe ser uno de: ${ESTADOS_ASISTENCIA.join(', ')}`);
        }
        estadoNormalizado = trimmed;
      }

      let justificadoValor = null;
      if (justificado !== undefined && justificado !== null) {
        justificadoValor = justificado === true || justificado === 1 || justificado === '1';
      }

      let justificacionValor = null;
      let actualizarJustificacion = 0;
      if (justificacion !== undefined) {
        actualizarJustificacion = 1;
        if (justificacion === null) {
          justificacionValor = null;
        } else {
          const trimmed = String(justificacion).trim();
          justificacionValor = trimmed || null;
        }
      }

      const pool = await poolPromise;
      const request = pool
        .request()
        .input('id_asistencia', sql.Int, id_asistencia)
        .input('tipo_marca', sql.VarChar(20), tipo_marca)
        .input('observaciones', sql.NVarChar(sql.MAX), observaciones)
        .input('estado', sql.NVarChar(20), estadoNormalizado);

      const setClauses = [
        'tipo_marca = @tipo_marca',
        'observaciones = @observaciones',
        'estado = COALESCE(@estado, estado)',
      ];

      if (state.hasJustificadoColumn) {
        request.input('justificado', sql.Bit, justificadoValor !== null ? (justificadoValor ? 1 : 0) : null);
        setClauses.push('justificado = COALESCE(@justificado, justificado)');
      }

      if (state.hasJustificacionColumn) {
        request
          .input('justificacion', sql.NVarChar(sql.MAX), justificacionValor)
          .input('actualizarJustificacion', sql.Bit, actualizarJustificacion);
        setClauses.push(
          'justificacion = CASE WHEN @actualizarJustificacion = 1 THEN @justificacion ELSE justificacion END',
        );
      }

      await request.query(`
        UPDATE Asistencia
        SET ${setClauses.join(',\n            ')}
        WHERE id_asistencia = @id_asistencia
      `);
      return { message: 'Asistencia actualizada' };
    } catch (err) {
      throw err;
    }
  }

  static async updateJustificacion(id_asistencia, { justificado, justificacion }) {
    try {
      const state = await this.ensureSchema();
      const pool = await poolPromise;
      const request = pool.request().input('id_asistencia', sql.Int, id_asistencia);

      const setClauses = [];

      if (state.hasJustificadoColumn) {
        request.input('justificado', sql.Bit, justificado ? 1 : 0);
        setClauses.push('justificado = @justificado');
      }

      if (state.hasJustificacionColumn) {
        request.input(
          'justificacion',
          sql.NVarChar(sql.MAX),
          justificacion !== undefined ? justificacion || null : null,
        );
        setClauses.push('justificacion = @justificacion');
      }

      if (setClauses.length === 0) {
        return { message: 'Justificación no disponible en este esquema' };
      }

      await request.query(`
        UPDATE Asistencia
        SET ${setClauses.join(',\n            ')}
        WHERE id_asistencia = @id_asistencia
      `);
      return { message: 'Justificación actualizada' };
    } catch (err) {
      throw err;
    }
  }

  // Opcional: eliminar marca (hard delete)
  static async delete(id_asistencia) {
    try {
      await this.ensureSchema();
      const pool = await poolPromise;
      await pool.request()
        .input('id_asistencia', sql.Int, id_asistencia)
        .query(`DELETE FROM Asistencia WHERE id_asistencia = @id_asistencia`);
      return { message: 'Asistencia eliminada' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Asistencia;
