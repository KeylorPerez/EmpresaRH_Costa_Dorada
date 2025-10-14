const { poolPromise, sql } = require('../db/db');

class Liquidacion {
  // 🔹 Obtener todas las liquidaciones (admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT l.*, e.nombre, e.apellido, u.username AS aprobado_por_username
          FROM Liquidaciones l
          LEFT JOIN Empleados e ON l.id_empleado = e.id_empleado
          LEFT JOIN Usuarios u ON l.aprobado_por = u.id_usuario
          ORDER BY l.fecha_liquidacion DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Obtener liquidaciones por empleado
  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT l.*, u.username AS aprobado_por_username
          FROM Liquidaciones l
          LEFT JOIN Usuarios u ON l.aprobado_por = u.id_usuario
          WHERE l.id_empleado = @id_empleado
          ORDER BY l.fecha_liquidacion DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Generar liquidación
  static async generar({
    id_empleado,
    salario_acumulado,
    vacaciones_no_gozadas,
    cesantia = 0,
    preaviso = 0,
    antiguedad = 0,
    total_pagar,
    fecha_liquidacion = new Date(),
    id_estado = 1 // pendiente por defecto
  }) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('salario_acumulado', sql.Decimal(12,2), salario_acumulado)
        .input('vacaciones_no_gozadas', sql.Decimal(12,2), vacaciones_no_gozadas)
        .input('cesantia', sql.Decimal(12,2), cesantia)
        .input('preaviso', sql.Decimal(12,2), preaviso)
        .input('antiguedad', sql.Decimal(12,2), antiguedad)
        .input('total_pagar', sql.Decimal(12,2), total_pagar)
        .input('fecha_liquidacion', sql.Date, fecha_liquidacion)
        .input('id_estado', sql.Int, id_estado)
        .query(`
          INSERT INTO Liquidaciones (id_empleado, salario_acumulado, vacaciones_no_gozadas, cesantia, preaviso, antiguedad, total_pagar, fecha_liquidacion, id_estado, created_at, updated_at)
          VALUES (@id_empleado, @salario_acumulado, @vacaciones_no_gozadas, @cesantia, @preaviso, @antiguedad, @total_pagar, @fecha_liquidacion, @id_estado, GETDATE(), GETDATE());
          SELECT SCOPE_IDENTITY() AS id_liquidacion;
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Aprobar liquidación (solo admin)
  static async aprobar(id_liquidacion, id_admin) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_liquidacion', sql.Int, id_liquidacion)
        .input('id_admin', sql.Int, id_admin)
        .input('id_estado', sql.Int, 2) // aprobado
        .query(`
          UPDATE Liquidaciones
          SET id_estado = @id_estado,
              aprobado_por = @id_admin,
              updated_at = GETDATE()
          WHERE id_liquidacion = @id_liquidacion
        `);
      return { message: 'Liquidación aprobada correctamente' };
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Rechazar liquidación (solo admin)
  static async rechazar(id_liquidacion, id_admin) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_liquidacion', sql.Int, id_liquidacion)
        .input('id_admin', sql.Int, id_admin)
        .input('id_estado', sql.Int, 3) // rechazado
        .query(`
          UPDATE Liquidaciones
          SET id_estado = @id_estado,
              aprobado_por = @id_admin,
              updated_at = GETDATE()
          WHERE id_liquidacion = @id_liquidacion
        `);
      return { message: 'Liquidación rechazada correctamente' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Liquidacion;
