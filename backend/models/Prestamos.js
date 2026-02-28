/**
 * Modelo de préstamos. Maneja las solicitudes de adelantos y los
 * movimientos de saldo asociados.
 */
const { poolPromise, sql } = require('../db/db');

class Prestamos {
  // 🔹 Obtener todos los préstamos (admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT p.*, e.nombre, e.apellido, es.nombre AS estado_nombre
          FROM Prestamos p
          LEFT JOIN Empleados e ON p.id_empleado = e.id_empleado
          LEFT JOIN CatalogoEstados es ON p.id_estado = es.id_estado
          ORDER BY p.fecha_solicitud DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async getById(id_prestamo) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_prestamo', sql.Int, id_prestamo)
        .query(`
          SELECT p.*, e.nombre, e.apellido, e.cedula, e.email, e.telefono, es.nombre AS estado_nombre
          FROM Prestamos p
          LEFT JOIN Empleados e ON p.id_empleado = e.id_empleado
          LEFT JOIN CatalogoEstados es ON p.id_estado = es.id_estado
          WHERE p.id_prestamo = @id_prestamo
        `);
      return result.recordset[0] || null;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Obtener préstamos de un empleado específico
  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT p.*, es.nombre AS estado_nombre
          FROM Prestamos p
          LEFT JOIN CatalogoEstados es ON p.id_estado = es.id_estado
          WHERE p.id_empleado = @id_empleado
          ORDER BY p.fecha_solicitud DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Crear nuevo préstamo
  static async create({
    id_empleado,
    monto,
    cuotas,
    interes_porcentaje,
    fecha_solicitud,
    comentario,
  }) {
    try {
      const pool = await poolPromise;
      const saldo = monto; // saldo inicial = monto total
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('monto', sql.Decimal(12,2), monto)
        .input('cuotas', sql.Int, cuotas)
        .input('interes_porcentaje', sql.Decimal(5,2), interes_porcentaje || 0)
        .input('saldo', sql.Decimal(12,2), saldo)
        .input('fecha_solicitud', sql.Date, fecha_solicitud ? new Date(fecha_solicitud) : null)
        .input('comentario', sql.NVarChar(500), comentario || null)
        .input('id_estado', sql.Int, 1) // pendiente por defecto
        .query(`
          INSERT INTO Prestamos (id_empleado, monto, cuotas, interes_porcentaje, saldo, id_estado, fecha_solicitud, comentario, created_at, updated_at)
          VALUES (@id_empleado, @monto, @cuotas, @interes_porcentaje, @saldo, @id_estado, ISNULL(@fecha_solicitud, GETDATE()), @comentario, GETDATE(), GETDATE());
          SELECT SCOPE_IDENTITY() AS id_prestamo;
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Actualizar saldo del préstamo (cuando se paga una cuota)
  static async pagarCuota(id_prestamo, monto_pago) {
    try {
      const pool = await poolPromise;
      const request = pool.request();
      const prestamoResult = await request
        .input('id_prestamo', sql.Int, id_prestamo)
        .query(`
          SELECT saldo
          FROM Prestamos
          WHERE id_prestamo = @id_prestamo
        `);

      if (!prestamoResult.recordset[0]) {
        throw new Error('Préstamo no encontrado');
      }

      const saldoActual = Number(prestamoResult.recordset[0].saldo);
      if (Number.isNaN(saldoActual)) {
        throw new Error('Saldo del préstamo inválido');
      }

      if (monto_pago > saldoActual) {
        throw new Error('El monto de pago excede el saldo pendiente');
      }

      await pool.request()
        .input('id_prestamo', sql.Int, id_prestamo)
        .input('monto_pago', sql.Decimal(12,2), monto_pago)
        .query(`
          UPDATE Prestamos
          SET saldo = CASE WHEN saldo - @monto_pago < 0 THEN 0 ELSE saldo - @monto_pago END,
              fecha_ultimo_pago = GETDATE(),
              updated_at = GETDATE()
          WHERE id_prestamo = @id_prestamo
        `);
      return { message: 'Saldo actualizado correctamente' };
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Cambiar estado del préstamo (aprobado, rechazado)
  static async updateEstado(id_prestamo, id_estado) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_prestamo', sql.Int, id_prestamo)
        .input('id_estado', sql.Int, id_estado)
        .query(`
          UPDATE Prestamos
          SET id_estado = @id_estado,
              updated_at = GETDATE()
          WHERE id_prestamo = @id_prestamo
        `);
      return { message: 'Estado del préstamo actualizado' };
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Eliminar un préstamo (solo admin)
  static async deleteById(id_prestamo) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('id_prestamo', sql.Int, id_prestamo)
        .query(`
          DELETE FROM Prestamos
          WHERE id_prestamo = @id_prestamo
        `);

      return { rowsAffected: result.rowsAffected?.[0] || 0 };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Prestamos;
