const { poolPromise, sql } = require('../db/db');

const TIPOS_MARCA = ['entrada', 'salida', 'almuerzo_inicio', 'almuerzo_fin'];

class Asistencia {
  // Obtener todas las marcas (con información básica del empleado)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT a.*, e.nombre, e.apellido
          FROM Asistencia a
          INNER JOIN Empleados e ON a.id_empleado = e.id_empleado
          ORDER BY a.fecha DESC, a.hora DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async countDistinctDays(id_empleado, startDate, endDate) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('start', sql.Date, startDate)
        .input('end', sql.Date, endDate)
        .query(`
          SELECT COUNT(DISTINCT fecha) AS dias
          FROM Asistencia
          WHERE id_empleado = @id_empleado
            AND fecha BETWEEN @start AND @end
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

  // Obtener marcas por empleado
  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT * FROM Asistencia
          WHERE id_empleado = @id_empleado
          ORDER BY fecha DESC, hora DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Obtener por rango de fechas (opcional por empleado)
  static async getByDateRange(startDate, endDate, id_empleado = null) {
    try {
      const pool = await poolPromise;
      const req = pool.request()
        .input('start', sql.Date, startDate)
        .input('end', sql.Date, endDate);

      let query = `
        SELECT a.*, e.nombre, e.apellido
        FROM Asistencia a
        LEFT JOIN Empleados e ON a.id_empleado = e.id_empleado
        WHERE a.fecha BETWEEN @start AND @end
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

  static async findByEmpleadoFechaTipo(id_empleado, fecha, tipo_marca) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('fecha', sql.Date, fecha)
        .input('tipo_marca', sql.VarChar(20), tipo_marca)
        .query(`
          SELECT TOP 1 *
          FROM Asistencia
          WHERE id_empleado = @id_empleado
            AND fecha = @fecha
            AND tipo_marca = @tipo_marca
        `);
      return result.recordset[0] || null;
    } catch (err) {
      throw err;
    }
  }

  // Crear nueva marca de asistencia
  static async create({ id_empleado, fecha = null, hora, tipo_marca, observaciones = null }) {
    try {
      if (!TIPOS_MARCA.includes(tipo_marca)) {
        throw new Error(`tipo_marca inválido. Debe ser uno de: ${TIPOS_MARCA.join(', ')}`);
      }

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
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('fecha', sql.Date, fecha) // Si es null, DB aplicará GETDATE()
        .input('hora', sql.Time, horaSql)
        .input('tipo_marca', sql.VarChar(20), tipo_marca)
        .input('observaciones', sql.NVarChar(sql.MAX), observaciones)
        .query(`
          INSERT INTO Asistencia (id_empleado, fecha, hora, tipo_marca, observaciones)
          VALUES (@id_empleado, ISNULL(@fecha, GETDATE()), @hora, @tipo_marca, @observaciones);
          SELECT SCOPE_IDENTITY() AS id_asistencia;
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // Actualizar tipo_marca u observaciones
  static async update(id_asistencia, { tipo_marca, observaciones = null }) {
    try {
      if (tipo_marca && !TIPOS_MARCA.includes(tipo_marca)) {
        throw new Error(`tipo_marca inválido. Debe ser uno de: ${TIPOS_MARCA.join(', ')}`);
      }

      const pool = await poolPromise;
      await pool.request()
        .input('id_asistencia', sql.Int, id_asistencia)
        .input('tipo_marca', sql.VarChar(20), tipo_marca)
        .input('observaciones', sql.NVarChar(sql.MAX), observaciones)
        .query(`
          UPDATE Asistencia
          SET tipo_marca = @tipo_marca,
              observaciones = @observaciones
          WHERE id_asistencia = @id_asistencia
        `);
      return { message: 'Asistencia actualizada' };
    } catch (err) {
      throw err;
    }
  }

  // Opcional: eliminar marca (hard delete)
  static async delete(id_asistencia) {
    try {
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
