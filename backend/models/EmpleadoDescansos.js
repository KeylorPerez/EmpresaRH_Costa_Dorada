/**
 * Modelo de descansos de empleados. Administra descansos fijos, alternados y
 * por fechas especiales, además de exponer una verificación puntual por fecha.
 */
const { poolPromise, sql } = require('../db/db');

const TIPOS_DESCANSO = Object.freeze([
  'FIJO_SEMANAL',
  'ALTERNADO_SEMANAL',
  'FECHA_UNICA',
  'RANGO_FECHAS',
]);

const ensureSchema = async () => {
  const pool = await poolPromise;
  await pool.request().batch(`
    IF OBJECT_ID('dbo.EmpleadoDescansos', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.EmpleadoDescansos (
        id_descanso INT IDENTITY(1,1) NOT NULL,
        id_empleado INT NOT NULL,
        tipo_descanso VARCHAR(25) NOT NULL,
        dia_semana TINYINT NULL,
        dia_semana_alterno TINYINT NULL,
        fecha_inicio DATE NOT NULL,
        fecha_fin DATE NULL,
        observacion NVARCHAR(200) NULL,
        estado BIT NOT NULL CONSTRAINT DF_EmpleadoDescansos_Estado DEFAULT (1),
        created_at DATETIME2 NOT NULL CONSTRAINT DF_EmpleadoDescansos_CreatedAt DEFAULT (SYSDATETIME()),
        updated_at DATETIME2 NOT NULL CONSTRAINT DF_EmpleadoDescansos_UpdatedAt DEFAULT (SYSDATETIME()),
        CONSTRAINT PK_EmpleadoDescansos PRIMARY KEY (id_descanso),
        CONSTRAINT FK_EmpleadoDescansos_Empleado FOREIGN KEY (id_empleado) REFERENCES dbo.Empleados(id_empleado),
        CONSTRAINT CK_EmpleadoDescansos_Tipo CHECK (tipo_descanso IN ('FIJO_SEMANAL', 'ALTERNADO_SEMANAL', 'FECHA_UNICA', 'RANGO_FECHAS')),
        CONSTRAINT CK_EmpleadoDescansos_DiaSemana CHECK (dia_semana BETWEEN 1 AND 7 OR dia_semana IS NULL),
        CONSTRAINT CK_EmpleadoDescansos_DiaSemanaAlterno CHECK (dia_semana_alterno BETWEEN 1 AND 7 OR dia_semana_alterno IS NULL),
        CONSTRAINT CK_EmpleadoDescansos_Fechas CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
        CONSTRAINT CK_EmpleadoDescansos_Reglas CHECK (
          (tipo_descanso = 'FIJO_SEMANAL' AND dia_semana IS NOT NULL AND dia_semana_alterno IS NULL)
          OR
          (tipo_descanso = 'ALTERNADO_SEMANAL' AND dia_semana IS NOT NULL AND dia_semana_alterno IS NOT NULL AND dia_semana <> dia_semana_alterno)
          OR
          (tipo_descanso = 'FECHA_UNICA' AND dia_semana IS NULL AND dia_semana_alterno IS NULL AND fecha_fin IS NULL)
          OR
          (tipo_descanso = 'RANGO_FECHAS' AND dia_semana IS NULL AND dia_semana_alterno IS NULL AND fecha_fin IS NOT NULL)
        )
      );
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EmpleadoDescansos_FijoSemanal_Activo' AND object_id = OBJECT_ID('dbo.EmpleadoDescansos'))
    BEGIN
      CREATE UNIQUE INDEX UX_EmpleadoDescansos_FijoSemanal_Activo
        ON dbo.EmpleadoDescansos (id_empleado, dia_semana)
        WHERE tipo_descanso = 'FIJO_SEMANAL' AND estado = 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EmpleadoDescansos_AlternadoSemanal_Activo' AND object_id = OBJECT_ID('dbo.EmpleadoDescansos'))
    BEGIN
      CREATE UNIQUE INDEX UX_EmpleadoDescansos_AlternadoSemanal_Activo
        ON dbo.EmpleadoDescansos (id_empleado)
        WHERE tipo_descanso = 'ALTERNADO_SEMANAL' AND estado = 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EmpleadoDescansos_FechaUnica_Activo' AND object_id = OBJECT_ID('dbo.EmpleadoDescansos'))
    BEGIN
      CREATE UNIQUE INDEX UX_EmpleadoDescansos_FechaUnica_Activo
        ON dbo.EmpleadoDescansos (id_empleado, fecha_inicio)
        WHERE tipo_descanso = 'FECHA_UNICA' AND estado = 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_EmpleadoDescansos_Rango_Activo' AND object_id = OBJECT_ID('dbo.EmpleadoDescansos'))
    BEGIN
      CREATE UNIQUE INDEX UX_EmpleadoDescansos_Rango_Activo
        ON dbo.EmpleadoDescansos (id_empleado, fecha_inicio, fecha_fin)
        WHERE tipo_descanso = 'RANGO_FECHAS' AND estado = 1;
    END;

    IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_EmpleadoDescansos_EmpleadoFechas' AND object_id = OBJECT_ID('dbo.EmpleadoDescansos'))
    BEGIN
      CREATE INDEX IX_EmpleadoDescansos_EmpleadoFechas
        ON dbo.EmpleadoDescansos (id_empleado, fecha_inicio, fecha_fin, estado, tipo_descanso);
    END;

    IF OBJECT_ID('dbo.TR_EmpleadoDescansos_UpdatedAt', 'TR') IS NOT NULL
      DROP TRIGGER dbo.TR_EmpleadoDescansos_UpdatedAt;

    EXEC('CREATE TRIGGER dbo.TR_EmpleadoDescansos_UpdatedAt
    ON dbo.EmpleadoDescansos
    AFTER UPDATE
    AS
    BEGIN
      SET NOCOUNT ON;
      UPDATE d
        SET updated_at = SYSDATETIME()
      FROM dbo.EmpleadoDescansos d
      INNER JOIN inserted i
        ON i.id_descanso = d.id_descanso;
    END');

    IF HAS_PERMS_BY_NAME(DB_NAME(), 'DATABASE', 'CREATE FUNCTION') = 1
    BEGIN
      IF OBJECT_ID('dbo.EsDescanso', 'FN') IS NOT NULL
        DROP FUNCTION dbo.EsDescanso;

      EXEC('CREATE FUNCTION dbo.EsDescanso
      (
        @id_empleado INT,
        @fecha DATE
      )
      RETURNS BIT
      AS
      BEGIN
        DECLARE @es BIT = 0;
        DECLARE @dow TINYINT = CONVERT(TINYINT, ((DATEDIFF(DAY, ''19000101'', @fecha) + 1) % 7) + 1);

        IF EXISTS (
          SELECT 1 FROM dbo.EmpleadoDescansos d
          WHERE d.id_empleado = @id_empleado AND d.estado = 1 AND d.tipo_descanso = ''FECHA_UNICA'' AND d.fecha_inicio = @fecha
        ) RETURN 1;

        IF EXISTS (
          SELECT 1 FROM dbo.EmpleadoDescansos d
          WHERE d.id_empleado = @id_empleado AND d.estado = 1 AND d.tipo_descanso = ''RANGO_FECHAS'' AND @fecha BETWEEN d.fecha_inicio AND d.fecha_fin
        ) RETURN 1;

        IF EXISTS (
          SELECT 1 FROM dbo.EmpleadoDescansos d
          WHERE d.id_empleado = @id_empleado
            AND d.estado = 1
            AND d.tipo_descanso = ''ALTERNADO_SEMANAL''
            AND @fecha >= d.fecha_inicio
            AND (d.fecha_fin IS NULL OR @fecha <= d.fecha_fin)
            AND (((DATEDIFF(DAY, d.fecha_inicio, @fecha) / 7) % 2) = 0 AND @dow = d.dia_semana
                OR ((DATEDIFF(DAY, d.fecha_inicio, @fecha) / 7) % 2) = 1 AND @dow = d.dia_semana_alterno)
        ) RETURN 1;

        IF EXISTS (
          SELECT 1 FROM dbo.EmpleadoDescansos d
          WHERE d.id_empleado = @id_empleado
            AND d.estado = 1
            AND d.tipo_descanso = ''FIJO_SEMANAL''
            AND @fecha >= d.fecha_inicio
            AND (d.fecha_fin IS NULL OR @fecha <= d.fecha_fin)
            AND d.dia_semana = @dow
        ) RETURN 1;

        RETURN @es;
      END');
    END;
  `);
};

const mapRow = (row) => ({
  id_descanso: row.id_descanso,
  id_empleado: row.id_empleado,
  empleado_nombre: row.empleado_nombre,
  tipo_descanso: row.tipo_descanso,
  dia_semana: row.dia_semana,
  dia_semana_alterno: row.dia_semana_alterno,
  fecha_inicio: row.fecha_inicio,
  fecha_fin: row.fecha_fin,
  observacion: row.observacion,
  estado: Boolean(row.estado),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const buildBaseQuery = `
  SELECT
    d.id_descanso,
    d.id_empleado,
    CONCAT(e.nombre, ' ', e.apellido) AS empleado_nombre,
    d.tipo_descanso,
    d.dia_semana,
    d.dia_semana_alterno,
    d.fecha_inicio,
    d.fecha_fin,
    d.observacion,
    d.estado,
    d.created_at,
    d.updated_at
  FROM dbo.EmpleadoDescansos d
  INNER JOIN dbo.Empleados e ON e.id_empleado = d.id_empleado
`;

const EmpleadoDescansos = {
  TIPOS_DESCANSO,
  ensureSchema,

  async getAll({ idEmpleado = null, estado = null } = {}) {
    const pool = await poolPromise;
    const request = pool.request();
    const conditions = [];

    if (idEmpleado !== null) {
      request.input('id_empleado', sql.Int, idEmpleado);
      conditions.push('d.id_empleado = @id_empleado');
    }

    if (estado !== null) {
      request.input('estado', sql.Bit, estado ? 1 : 0);
      conditions.push('d.estado = @estado');
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await request.query(`
      ${buildBaseQuery}
      ${where}
      ORDER BY d.id_empleado ASC, d.fecha_inicio DESC, d.id_descanso DESC
    `);

    return result.recordset.map(mapRow);
  },

  async create(payload) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id_empleado', sql.Int, payload.id_empleado)
      .input('tipo_descanso', sql.VarChar(25), payload.tipo_descanso)
      .input('dia_semana', sql.TinyInt, payload.dia_semana)
      .input('dia_semana_alterno', sql.TinyInt, payload.dia_semana_alterno)
      .input('fecha_inicio', sql.Date, payload.fecha_inicio)
      .input('fecha_fin', sql.Date, payload.fecha_fin)
      .input('observacion', sql.NVarChar(200), payload.observacion)
      .input('estado', sql.Bit, payload.estado ? 1 : 0)
      .query(`
        INSERT INTO dbo.EmpleadoDescansos
          (id_empleado, tipo_descanso, dia_semana, dia_semana_alterno, fecha_inicio, fecha_fin, observacion, estado)
        OUTPUT INSERTED.id_descanso
        VALUES (@id_empleado, @tipo_descanso, @dia_semana, @dia_semana_alterno, @fecha_inicio, @fecha_fin, @observacion, @estado)
      `);

    return this.getById(result.recordset[0].id_descanso);
  },

  async getById(idDescanso) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id_descanso', sql.Int, idDescanso)
      .query(`
        ${buildBaseQuery}
        WHERE d.id_descanso = @id_descanso
      `);

    if (!result.recordset.length) return null;
    return mapRow(result.recordset[0]);
  },

  async update(idDescanso, payload) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id_descanso', sql.Int, idDescanso)
      .input('id_empleado', sql.Int, payload.id_empleado)
      .input('tipo_descanso', sql.VarChar(25), payload.tipo_descanso)
      .input('dia_semana', sql.TinyInt, payload.dia_semana)
      .input('dia_semana_alterno', sql.TinyInt, payload.dia_semana_alterno)
      .input('fecha_inicio', sql.Date, payload.fecha_inicio)
      .input('fecha_fin', sql.Date, payload.fecha_fin)
      .input('observacion', sql.NVarChar(200), payload.observacion)
      .input('estado', sql.Bit, payload.estado ? 1 : 0)
      .query(`
        UPDATE dbo.EmpleadoDescansos
        SET id_empleado = @id_empleado,
            tipo_descanso = @tipo_descanso,
            dia_semana = @dia_semana,
            dia_semana_alterno = @dia_semana_alterno,
            fecha_inicio = @fecha_inicio,
            fecha_fin = @fecha_fin,
            observacion = @observacion,
            estado = @estado
        WHERE id_descanso = @id_descanso
      `);

    if (!result.rowsAffected[0]) return null;
    return this.getById(idDescanso);
  },

  async remove(idDescanso) {
    const pool = await poolPromise;
    const result = await pool.request()
      .input('id_descanso', sql.Int, idDescanso)
      .query('DELETE FROM dbo.EmpleadoDescansos WHERE id_descanso = @id_descanso');

    return result.rowsAffected[0] > 0;
  },

  async esDescanso(idEmpleado, fecha) {
    const pool = await poolPromise;

    try {
      const result = await pool.request()
        .input('id_empleado', sql.Int, idEmpleado)
        .input('fecha', sql.Date, fecha)
        .query('SELECT dbo.EsDescanso(@id_empleado, @fecha) AS es_descanso');

      return Boolean(result.recordset[0]?.es_descanso);
    } catch (error) {
      const mensaje = String(error?.message || '').toLowerCase();
      const faltanteFuncion =
        mensaje.includes('esdescanso')
        && (mensaje.includes('not a recognized built-in function name')
          || mensaje.includes('cannot find either column')
          || mensaje.includes('could not find stored procedure'));

      if (!faltanteFuncion) {
        throw error;
      }

      const result = await pool.request()
        .input('id_empleado', sql.Int, idEmpleado)
        .input('fecha', sql.Date, fecha)
        .query(`
          DECLARE @dow TINYINT = CONVERT(TINYINT, ((DATEDIFF(DAY, '19000101', @fecha) + 1) % 7) + 1);

          SELECT CAST(
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM dbo.EmpleadoDescansos d
                WHERE d.id_empleado = @id_empleado
                  AND d.estado = 1
                  AND d.tipo_descanso = 'FECHA_UNICA'
                  AND d.fecha_inicio = @fecha
              ) THEN 1
              WHEN EXISTS (
                SELECT 1
                FROM dbo.EmpleadoDescansos d
                WHERE d.id_empleado = @id_empleado
                  AND d.estado = 1
                  AND d.tipo_descanso = 'RANGO_FECHAS'
                  AND @fecha BETWEEN d.fecha_inicio AND d.fecha_fin
              ) THEN 1
              WHEN EXISTS (
                SELECT 1
                FROM dbo.EmpleadoDescansos d
                WHERE d.id_empleado = @id_empleado
                  AND d.estado = 1
                  AND d.tipo_descanso = 'ALTERNADO_SEMANAL'
                  AND @fecha >= d.fecha_inicio
                  AND (d.fecha_fin IS NULL OR @fecha <= d.fecha_fin)
                  AND (((DATEDIFF(DAY, d.fecha_inicio, @fecha) / 7) % 2) = 0 AND @dow = d.dia_semana
                    OR ((DATEDIFF(DAY, d.fecha_inicio, @fecha) / 7) % 2) = 1 AND @dow = d.dia_semana_alterno)
              ) THEN 1
              WHEN EXISTS (
                SELECT 1
                FROM dbo.EmpleadoDescansos d
                WHERE d.id_empleado = @id_empleado
                  AND d.estado = 1
                  AND d.tipo_descanso = 'FIJO_SEMANAL'
                  AND @fecha >= d.fecha_inicio
                  AND (d.fecha_fin IS NULL OR @fecha <= d.fecha_fin)
                  AND d.dia_semana = @dow
              ) THEN 1
              ELSE 0
            END
          AS bit) AS es_descanso;
        `);

      return Boolean(result.recordset[0]?.es_descanso);
    }
  },
};

module.exports = EmpleadoDescansos;
