const { poolPromise, sql } = require('../db/db');

class Empleado {
  // Obtener todos los empleados activos con nombre del puesto
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT e.*, p.nombre AS puesto_nombre
          FROM Empleados e
          JOIN Puestos p ON e.id_puesto = p.id_puesto
          WHERE e.estado = 1
          ORDER BY e.nombre, e.apellido
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Obtener un empleado por ID con nombre del puesto
  static async getById(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT e.*, p.nombre AS puesto_nombre
          FROM Empleados e
          JOIN Puestos p ON e.id_puesto = p.id_puesto
          WHERE e.id_empleado = @id_empleado AND e.estado = 1
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // Crear un nuevo empleado
  static async create({ nombre, apellido, id_puesto, cedula, fecha_nacimiento, telefono, email, fecha_ingreso, salario_base }) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('nombre', sql.NVarChar(150), nombre)
        .input('apellido', sql.NVarChar(150), apellido)
        .input('id_puesto', sql.Int, id_puesto)
        .input('cedula', sql.VarChar(20), cedula)
        .input('fecha_nacimiento', sql.Date, fecha_nacimiento || null)
        .input('telefono', sql.VarChar(30), telefono || null)
        .input('email', sql.VarChar(150), email || null)
        .input('fecha_ingreso', sql.Date, fecha_ingreso)
        .input('salario_base', sql.Decimal(12, 2), salario_base)
        .query(`
          INSERT INTO Empleados (nombre, apellido, id_puesto, cedula, fecha_nacimiento, telefono, email, fecha_ingreso, salario_base, estado, created_at, updated_at)
          VALUES (@nombre, @apellido, @id_puesto, @cedula, @fecha_nacimiento, @telefono, @email, @fecha_ingreso, @salario_base, 1, GETDATE(), GETDATE());
          SELECT SCOPE_IDENTITY() AS id_empleado;
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // Actualizar un empleado
  static async update(id_empleado, { nombre, apellido, id_puesto, cedula, fecha_nacimiento, telefono, email, fecha_ingreso, salario_base, estado }) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('nombre', sql.NVarChar(150), nombre)
        .input('apellido', sql.NVarChar(150), apellido)
        .input('id_puesto', sql.Int, id_puesto)
        .input('cedula', sql.VarChar(20), cedula)
        .input('fecha_nacimiento', sql.Date, fecha_nacimiento || null)
        .input('telefono', sql.VarChar(30), telefono || null)
        .input('email', sql.VarChar(150), email || null)
        .input('fecha_ingreso', sql.Date, fecha_ingreso)
        .input('salario_base', sql.Decimal(12, 2), salario_base)
        .input('estado', sql.Bit, estado !== undefined ? estado : 1)
        .query(`
          UPDATE Empleados
          SET nombre = @nombre,
              apellido = @apellido,
              id_puesto = @id_puesto,
              cedula = @cedula,
              fecha_nacimiento = @fecha_nacimiento,
              telefono = @telefono,
              email = @email,
              fecha_ingreso = @fecha_ingreso,
              salario_base = @salario_base,
              estado = @estado,
              updated_at = GETDATE()
          WHERE id_empleado = @id_empleado
        `);
      return { message: 'Empleado actualizado' };
    } catch (err) {
      throw err;
    }
  }

  // Desactivar (soft delete)
  static async deactivate(id_empleado) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          UPDATE Empleados
          SET estado = 0,
              updated_at = GETDATE()
          WHERE id_empleado = @id_empleado
        `);
      return { message: 'Empleado desactivado' };
    } catch (err) {
      throw err;
    }
  }

  // Activar (reverso de deactivate)
  static async activate(id_empleado) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          UPDATE Empleados
          SET estado = 1,
              updated_at = GETDATE()
          WHERE id_empleado = @id_empleado
        `);
      return { message: 'Empleado activado' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Empleado;
