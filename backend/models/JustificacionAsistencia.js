const { poolPromise, sql } = require('../db/db');

const TIPOS_JUSTIFICACION = [
  'Permiso con goce',
  'Permiso sin goce',
  'Incapacidad',
  'Vacaciones',
  'Otro',
];

const ESTADOS_SOLICITUD = ['pendiente', 'aprobada', 'rechazada'];

const ensureTableQuery = `
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[JustificacionAsistencia]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[JustificacionAsistencia](
    [id_solicitud] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [id_asistencia] INT NOT NULL,
    [id_empleado] INT NOT NULL,
    [tipo] NVARCHAR(50) NOT NULL,
    [descripcion] NVARCHAR(MAX) NULL,
    [estado] NVARCHAR(20) NOT NULL DEFAULT ('pendiente'),
    [respuesta] NVARCHAR(MAX) NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    [updated_at] DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_JustificacionAsistencia_Asistencia FOREIGN KEY(id_asistencia) REFERENCES Asistencia(id_asistencia),
    CONSTRAINT FK_JustificacionAsistencia_Empleado FOREIGN KEY(id_empleado) REFERENCES Empleados(id_empleado)
  );
END
`;

const ensureUpdatedAtTriggerQuery = `
IF NOT EXISTS (
  SELECT * FROM sys.triggers WHERE object_id = OBJECT_ID(N'[dbo].[TR_JustificacionAsistencia_Update]')
)
BEGIN
  EXEC('CREATE TRIGGER [dbo].[TR_JustificacionAsistencia_Update] ON [dbo].[JustificacionAsistencia]
  AFTER UPDATE
  AS
  BEGIN
    SET NOCOUNT ON;
    UPDATE J SET updated_at = SYSDATETIME()
    FROM JustificacionAsistencia J
    INNER JOIN inserted I ON J.id_solicitud = I.id_solicitud;
  END');
END
`;

class JustificacionAsistencia {
  static async ensureTable() {
    const pool = await poolPromise;
    await pool.request().query(ensureTableQuery);
    await pool.request().query(ensureUpdatedAtTriggerQuery);
  }

  static getAllowedTypes() {
    return [...TIPOS_JUSTIFICACION];
  }

  static getAllowedStates() {
    return [...ESTADOS_SOLICITUD];
  }

  static normalizeRecord(record) {
    if (!record) return null;
    return {
      id_solicitud: record.id_solicitud,
      id_asistencia: record.id_asistencia,
      id_empleado: record.id_empleado,
      tipo: record.tipo,
      descripcion: record.descripcion || '',
      estado: record.estado,
      respuesta: record.respuesta || '',
      created_at: record.created_at ? new Date(record.created_at) : null,
      updated_at: record.updated_at ? new Date(record.updated_at) : null,
    };
  }

  static async findPendingByAsistencia(id_asistencia) {
    await this.ensureTable();
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('id_asistencia', sql.Int, id_asistencia)
      .query(`
        SELECT TOP 1 *
        FROM JustificacionAsistencia
        WHERE id_asistencia = @id_asistencia AND estado = 'pendiente'
        ORDER BY created_at DESC, id_solicitud DESC
      `);
    return this.normalizeRecord(result.recordset[0]);
  }

  static async findLatestByAsistencia(id_asistencia) {
    await this.ensureTable();
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('id_asistencia', sql.Int, id_asistencia)
      .query(`
        SELECT TOP 1 *
        FROM JustificacionAsistencia
        WHERE id_asistencia = @id_asistencia
        ORDER BY created_at DESC, id_solicitud DESC
      `);
    return this.normalizeRecord(result.recordset[0]);
  }

  static async findById(id_solicitud) {
    await this.ensureTable();
    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('id_solicitud', sql.Int, id_solicitud)
      .query(`
        SELECT *
        FROM JustificacionAsistencia
        WHERE id_solicitud = @id_solicitud
      `);
    return this.normalizeRecord(result.recordset[0]);
  }

  static async create({ id_asistencia, id_empleado, tipo, descripcion }) {
    if (!Number.isInteger(id_asistencia) || id_asistencia <= 0) {
      throw new Error('id_asistencia inválido');
    }
    if (!Number.isInteger(id_empleado) || id_empleado <= 0) {
      throw new Error('id_empleado inválido');
    }
    if (!tipo || !TIPOS_JUSTIFICACION.includes(tipo)) {
      throw new Error(`tipo inválido. Debe ser uno de: ${TIPOS_JUSTIFICACION.join(', ')}`);
    }

    await this.ensureTable();
    const pending = await this.findPendingByAsistencia(id_asistencia);
    if (pending) {
      const error = new Error('Ya existe una justificación pendiente para este registro');
      error.code = 'JUSTIFICACION_PENDIENTE';
      throw error;
    }

    const pool = await poolPromise;
    const result = await pool
      .request()
      .input('id_asistencia', sql.Int, id_asistencia)
      .input('id_empleado', sql.Int, id_empleado)
      .input('tipo', sql.NVarChar(50), tipo)
      .input('descripcion', sql.NVarChar(sql.MAX), descripcion || null)
      .query(`
        INSERT INTO JustificacionAsistencia (id_asistencia, id_empleado, tipo, descripcion)
        OUTPUT INSERTED.*
        VALUES (@id_asistencia, @id_empleado, @tipo, @descripcion)
      `);

    return this.normalizeRecord(result.recordset[0]);
  }

  static async updateEstado(id_solicitud, { estado, respuesta = '' }) {
    if (!Number.isInteger(id_solicitud) || id_solicitud <= 0) {
      throw new Error('id_solicitud inválido');
    }

    const estadoNormalizado = typeof estado === 'string' ? estado.trim().toLowerCase() : '';
    if (!estadoNormalizado || !ESTADOS_SOLICITUD.includes(estadoNormalizado)) {
      throw new Error(`estado inválido. Debe ser uno de: ${ESTADOS_SOLICITUD.join(', ')}`);
    }

    await this.ensureTable();
    const pool = await poolPromise;
    await pool
      .request()
      .input('id_solicitud', sql.Int, id_solicitud)
      .input('estado', sql.NVarChar(20), estadoNormalizado)
      .input('respuesta', sql.NVarChar(sql.MAX), respuesta ? respuesta.trim() || null : null)
      .query(`
        UPDATE JustificacionAsistencia
        SET estado = @estado,
            respuesta = @respuesta,
            updated_at = SYSDATETIME()
        WHERE id_solicitud = @id_solicitud
      `);

    return this.findById(id_solicitud);
  }
}

module.exports = JustificacionAsistencia;
