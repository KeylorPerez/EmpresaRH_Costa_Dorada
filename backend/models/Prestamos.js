const { poolPromise, sql } = require('../db/db');

class Prestamos {
  // Obtener todos los préstamos (admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT p.*, e.nombre, e.apellido
          FROM Prestamos p
          LEFT JOIN Empleados e ON p.id_empleado = e.id_empleado
          ORDER BY p.fecha DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Obtener préstamos de un empleado específico
  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT *
          FROM Prestamos
          WHERE id_empleado = @id_empleado
          ORDER BY fecha DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Crear nuevo préstamo
  static async create({ id_empleado, monto, cuotas, interes }) {
    try {
      const pool = await poolPromise;
      const saldo = monto; // al inicio, el saldo pendiente = monto total
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('monto', sql.Decimal(18,2), monto)
        .input('cuotas', sql.Int, cuotas)
        .input('interes', sql.Decimal(5,2), interes)
        .input('saldo', sql.Decimal(18,2), saldo)
        .query(`
          INSERT INTO Prestamos (id_empleado, monto, cuotas, interes, saldo)
          VALUES (@id_empleado, @monto, @cuotas, @interes, @saldo);
          SELECT SCOPE_IDENTITY() AS id_prestamo;
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // Actualizar saldo del préstamo (cuando se paga una cuota)
  static async updateSaldo(id_prestamo, monto_pago) {
    try {
      const pool = await poolPromise;
      // restar pago al saldo
      await pool.request()
        .input('id_prestamo', sql.Int, id_prestamo)
        .input('monto_pago', sql.Decimal(18,2), monto_pago)
        .query(`
          UPDATE Prestamos
          SET saldo = saldo - @monto_pago
          WHERE id_prestamo = @id_prestamo
        `);
      return { message: 'Saldo actualizado' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Prestamos;
