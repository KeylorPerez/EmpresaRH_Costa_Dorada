const { poolPromise, sql } = require('../db/db');

class Liquidacion {

  // 🔹 Obtener todas las liquidaciones (admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT l.*, e.nombre, e.apellido, e.salario_base
          FROM Liquidaciones l
          LEFT JOIN Empleados e ON l.id_empleado = e.id_empleado
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
          SELECT *
          FROM Liquidaciones
          WHERE id_empleado = @id_empleado
          ORDER BY fecha_liquidacion DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Generar nueva liquidación
  static async generar({
    id_empleado,
    salario_acumulado,
    vacaciones_no_gozadas = 0,
    cesantia = 0,
    preaviso = 0,
    antiguedad = 0,
    id_estado,
    aprobado_por = null,
    fecha_liquidacion = null
  }) {
    try {
      const pool = await poolPromise;
      const total_pagar = salario_acumulado + vacaciones_no_gozadas + cesantia + preaviso + antiguedad;
      const fechaFinal = fecha_liquidacion || new Date();

      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('salario_acumulado', sql.Decimal(12,2), salario_acumulado)
        .input('vacaciones_no_gozadas', sql.Decimal(12,2), vacaciones_no_gozadas)
        .input('cesantia', sql.Decimal(12,2), cesantia)
        .input('preaviso', sql.Decimal(12,2), preaviso)
        .input('antiguedad', sql.Decimal(12,2), antiguedad)
        .input('total_pagar', sql.Decimal(12,2), total_pagar)
        .input('id_estado', sql.Int, id_estado)
        .input('aprobado_por', sql.Int, aprobado_por)
        .input('fecha_liquidacion', sql.Date, fechaFinal)
        .query(`
          INSERT INTO Liquidaciones 
          (id_empleado, salario_acumulado, vacaciones_no_gozadas, cesantia, preaviso, antiguedad, total_pagar, id_estado, aprobado_por, fecha_liquidacion, created_at, updated_at)
          VALUES 
          (@id_empleado, @salario_acumulado, @vacaciones_no_gozadas, @cesantia, @preaviso, @antiguedad, @total_pagar, @id_estado, @aprobado_por, @fecha_liquidacion, GETDATE(), GETDATE());
          SELECT SCOPE_IDENTITY() AS id_liquidacion;
        `);

      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Actualizar liquidación
  static async update(id_liquidacion, {
    salario_acumulado,
    vacaciones_no_gozadas,
    cesantia,
    preaviso,
    antiguedad,
    total_pagar,
    id_estado,
    aprobado_por,
    fecha_liquidacion
  }) {
    try {
      const pool = await poolPromise;

      const total = total_pagar || salario_acumulado + vacaciones_no_gozadas + cesantia + preaviso + antiguedad;

      await pool.request()
        .input('id_liquidacion', sql.Int, id_liquidacion)
        .input('salario_acumulado', sql.Decimal(12,2), salario_acumulado)
        .input('vacaciones_no_gozadas', sql.Decimal(12,2), vacaciones_no_gozadas)
        .input('cesantia', sql.Decimal(12,2), cesantia)
        .input('preaviso', sql.Decimal(12,2), preaviso)
        .input('antiguedad', sql.Decimal(12,2), antiguedad)
        .input('total_pagar', sql.Decimal(12,2), total)
        .input('id_estado', sql.Int, id_estado)
        .input('aprobado_por', sql.Int, aprobado_por)
        .input('fecha_liquidacion', sql.Date, fecha_liquidacion)
        .query(`
          UPDATE Liquidaciones
          SET salario_acumulado = @salario_acumulado,
              vacaciones_no_gozadas = @vacaciones_no_gozadas,
              cesantia = @cesantia,
              preaviso = @preaviso,
              antiguedad = @antiguedad,
              total_pagar = @total_pagar,
              id_estado = @id_estado,
              aprobado_por = @aprobado_por,
              fecha_liquidacion = @fecha_liquidacion,
              updated_at = GETDATE()
          WHERE id_liquidacion = @id_liquidacion
        `);

      return { message: 'Liquidación actualizada correctamente' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Liquidacion;
