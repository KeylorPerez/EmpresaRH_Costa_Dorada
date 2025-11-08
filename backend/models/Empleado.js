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
          ORDER BY e.estado DESC, e.nombre, e.apellido
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
          WHERE e.id_empleado = @id_empleado
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // Crear un nuevo empleado
  static async create({
    nombre,
    apellido,
    id_puesto,
    cedula,
    fecha_nacimiento,
    telefono,
    email,
    fecha_ingreso,
    salario_monto,
    tipo_pago,
    bonificacion_fija,
    porcentaje_ccss,
    usa_deduccion_fija,
    deduccion_fija,
    permitir_marcacion_fuera = 0,
  }) {
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
        .input('salario_monto', sql.Decimal(12, 2), salario_monto)
        .input('tipo_pago', sql.NVarChar(20), tipo_pago)
        .input('bonificacion_fija', sql.Decimal(10, 2), bonificacion_fija)
        .input('porcentaje_ccss', sql.Decimal(5, 2), porcentaje_ccss)
        .input('usa_deduccion_fija', sql.Bit, usa_deduccion_fija)
        .input('deduccion_fija', sql.Decimal(10, 2), deduccion_fija)
        .input('permitir_marcacion_fuera', sql.Bit, permitir_marcacion_fuera)
        .query(`
          INSERT INTO Empleados
          (nombre, apellido, id_puesto, cedula, fecha_nacimiento, telefono, email, fecha_ingreso, salario_monto, tipo_pago, bonificacion_fija, porcentaje_ccss, usa_deduccion_fija, deduccion_fija, permitir_marcacion_fuera, estado, created_at, updated_at)
          VALUES
          (@nombre, @apellido, @id_puesto, @cedula, @fecha_nacimiento, @telefono, @email, @fecha_ingreso, @salario_monto, @tipo_pago, @bonificacion_fija, @porcentaje_ccss, @usa_deduccion_fija, @deduccion_fija, @permitir_marcacion_fuera, 1, GETDATE(), GETDATE());

          SELECT SCOPE_IDENTITY() AS id_empleado;
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // Actualizar un empleado
  static async update(
    id_empleado,
    {
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento,
      telefono,
      email,
      fecha_ingreso,
      salario_monto,
      tipo_pago,
      bonificacion_fija,
      porcentaje_ccss,
      usa_deduccion_fija,
      deduccion_fija,
      permitir_marcacion_fuera,
      estado,
    }
  ) {
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
        .input('salario_monto', sql.Decimal(12, 2), salario_monto)
        .input('tipo_pago', sql.NVarChar(20), tipo_pago !== undefined ? tipo_pago : null)
        .input('bonificacion_fija', sql.Decimal(10, 2), bonificacion_fija !== undefined ? bonificacion_fija : null)
        .input('porcentaje_ccss', sql.Decimal(5, 2), porcentaje_ccss !== undefined ? porcentaje_ccss : null)
        .input('usa_deduccion_fija', sql.Bit, usa_deduccion_fija !== undefined ? usa_deduccion_fija : null)
        .input('deduccion_fija', sql.Decimal(10, 2), deduccion_fija !== undefined ? deduccion_fija : null)
        .input('permitir_marcacion_fuera', sql.Bit, permitir_marcacion_fuera !== undefined ? permitir_marcacion_fuera : null)
        .input('estado', sql.Bit, estado !== undefined ? estado : null)
        .query(`
          UPDATE Empleados
          SET
            nombre = @nombre,
            apellido = @apellido,
            id_puesto = @id_puesto,
            cedula = @cedula,
            fecha_nacimiento = @fecha_nacimiento,
            telefono = @telefono,
            email = @email,
            fecha_ingreso = @fecha_ingreso,
            salario_monto = @salario_monto,
            tipo_pago = COALESCE(@tipo_pago, tipo_pago),
            bonificacion_fija = COALESCE(@bonificacion_fija, bonificacion_fija),
            porcentaje_ccss = COALESCE(@porcentaje_ccss, porcentaje_ccss),
            usa_deduccion_fija = COALESCE(@usa_deduccion_fija, usa_deduccion_fija),
            deduccion_fija = COALESCE(@deduccion_fija, deduccion_fija),
            permitir_marcacion_fuera = COALESCE(@permitir_marcacion_fuera, permitir_marcacion_fuera),
            estado = COALESCE(@estado, estado),
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

