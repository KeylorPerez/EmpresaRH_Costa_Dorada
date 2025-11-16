/**
 * Modelo de vacaciones. Administra las solicitudes, sus estados y el
 * cálculo de días pendientes para cada empleado.
 */
const { poolPromise, sql } = require('../db/db');

class Vacaciones {
  // 🔹 Obtener todas las solicitudes (solo admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT v.*, e.nombre, e.apellido, u.username AS aprobado_por_username
          FROM Vacaciones v
          LEFT JOIN Empleados e ON v.id_empleado = e.id_empleado
          LEFT JOIN Usuarios u ON v.aprobado_por = u.id_usuario
          ORDER BY v.fecha_inicio DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Obtener solicitudes por empleado
  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT v.*, u.username AS aprobado_por_username
          FROM Vacaciones v
          LEFT JOIN Usuarios u ON v.aprobado_por = u.id_usuario
          WHERE v.id_empleado = @id_empleado
          ORDER BY v.fecha_inicio DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Obtener solicitud por ID con detalles de empleado y usuario aprobador
  static async getById(id_vacacion) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_vacacion', sql.Int, id_vacacion)
        .query(`
          SELECT TOP 1
            v.*,
            e.nombre,
            e.apellido,
            e.cedula,
            e.telefono,
            e.email,
            u.username AS aprobado_por_username
          FROM Vacaciones v
          LEFT JOIN Empleados e ON v.id_empleado = e.id_empleado
          LEFT JOIN Usuarios u ON v.aprobado_por = u.id_usuario
          WHERE v.id_vacacion = @id_vacacion
        `);
      return result.recordset[0] || null;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Crear solicitud (empleado)
  static async create({ id_empleado, fecha_inicio, fecha_fin, motivo = null }) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('fecha_inicio', sql.Date, fecha_inicio)
        .input('fecha_fin', sql.Date, fecha_fin)
        .input('motivo', sql.NVarChar(200), motivo)
        .input('dias_aprobados', sql.Int, 0) // pendiente, por defecto 0
        .input('id_estado', sql.Int, 1) // pendiente
        .query(`
          INSERT INTO Vacaciones (id_empleado, fecha_inicio, fecha_fin, motivo, dias_aprobados, id_estado, created_at, updated_at)
          VALUES (@id_empleado, @fecha_inicio, @fecha_fin, @motivo, @dias_aprobados, @id_estado, GETDATE(), GETDATE());
          SELECT SCOPE_IDENTITY() AS id_vacacion;
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Aprobar solicitud (solo admin)
  static async aprobar(id_vacacion, id_admin, dias_aprobados) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_vacacion', sql.Int, id_vacacion)
        .input('id_admin', sql.Int, id_admin)
        .input('dias_aprobados', sql.Int, dias_aprobados)
        .input('id_estado', sql.Int, 2) // aprobado
        .query(`
          UPDATE Vacaciones
          SET id_estado = @id_estado,
              aprobado_por = @id_admin,
              dias_aprobados = @dias_aprobados,
              updated_at = GETDATE()
          WHERE id_vacacion = @id_vacacion
        `);
      return { message: 'Vacación aprobada correctamente' };
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Rechazar solicitud (solo admin)
  static async rechazar(id_vacacion, id_admin) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_vacacion', sql.Int, id_vacacion)
        .input('id_admin', sql.Int, id_admin)
        .input('id_estado', sql.Int, 3) // rechazado
        .query(`
          UPDATE Vacaciones
          SET id_estado = @id_estado,
              aprobado_por = @id_admin,
              dias_aprobados = 0,
              updated_at = GETDATE()
          WHERE id_vacacion = @id_vacacion
        `);
      return { message: 'Vacación rechazada correctamente' };
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Eliminar solicitud (opcional, hard delete)
  static async delete(id_vacacion) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_vacacion', sql.Int, id_vacacion)
        .query(`DELETE FROM Vacaciones WHERE id_vacacion = @id_vacacion`);
      return { message: 'Vacación eliminada' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Vacaciones;
