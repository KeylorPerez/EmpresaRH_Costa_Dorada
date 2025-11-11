const { poolPromise, sql } = require('../db/db');

class Liquidacion {

  // 🔹 Obtener todas las liquidaciones (admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT l.*, e.nombre, e.apellido, e.salario_monto
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
    id_estado,
    aprobado_por = null,
    fecha_liquidacion = null,
    fecha_inicio_periodo = null,
    fecha_fin_periodo = null,
    motivo_liquidacion = null
  }) {
    try {
      const pool = await poolPromise;
      const total_pagar = salario_acumulado + vacaciones_no_gozadas + cesantia + preaviso;
      const fechaFinal = fecha_liquidacion || new Date();
      let fechaInicio = fecha_inicio_periodo || null;
      let fechaFin = fecha_fin_periodo || new Date();
      const motivo = motivo_liquidacion || null;

      if (!fechaInicio) {
        const empleadoInfo = await pool
          .request()
          .input('id_empleado', sql.Int, id_empleado)
          .query(`
            SELECT fecha_inicio_periodo, fecha_ingreso
            FROM Empleados
            WHERE id_empleado = @id_empleado
          `);

        if (empleadoInfo.recordset.length > 0) {
          const { fecha_inicio_periodo: inicioPeriodo, fecha_ingreso: fechaIngreso } =
            empleadoInfo.recordset[0];
          fechaInicio = inicioPeriodo || fechaIngreso || null;
        }
      }

      const result = await pool
        .request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('salario_acumulado', sql.Decimal(12,2), salario_acumulado)
        .input('vacaciones_no_gozadas', sql.Decimal(12,2), vacaciones_no_gozadas)
        .input('cesantia', sql.Decimal(12,2), cesantia)
        .input('preaviso', sql.Decimal(12,2), preaviso)
        .input('total_pagar', sql.Decimal(12,2), total_pagar)
        .input('id_estado', sql.Int, id_estado)
        .input('aprobado_por', sql.Int, aprobado_por)
        .input('fecha_liquidacion', sql.Date, fechaFinal)
        .input('fecha_inicio_periodo', sql.Date, fechaInicio)
        .input('fecha_fin_periodo', sql.Date, fechaFin)
        .input('motivo_liquidacion', sql.VarChar(300), motivo)
        .query(`
          INSERT INTO Liquidaciones
          (id_empleado, salario_acumulado, vacaciones_no_gozadas, cesantia, preaviso, total_pagar, id_estado, aprobado_por, fecha_liquidacion, created_at, updated_at, fecha_inicio_periodo, fecha_fin_periodo, motivo_liquidacion)
          VALUES
          (@id_empleado, @salario_acumulado, @vacaciones_no_gozadas, @cesantia, @preaviso, @total_pagar, @id_estado, @aprobado_por, @fecha_liquidacion, GETDATE(), GETDATE(), @fecha_inicio_periodo, @fecha_fin_periodo, @motivo_liquidacion);
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
    total_pagar,
    id_estado,
    aprobado_por,
    fecha_liquidacion,
    fecha_inicio_periodo,
    fecha_fin_periodo,
    motivo_liquidacion
  }) {
    try {
      const pool = await poolPromise;

      const total = total_pagar || salario_acumulado + vacaciones_no_gozadas + cesantia + preaviso;
      const fechaInicio = fecha_inicio_periodo || null;
      const fechaFin = fecha_fin_periodo || null;
      const motivo = motivo_liquidacion || null;

      await pool.request()
        .input('id_liquidacion', sql.Int, id_liquidacion)
        .input('salario_acumulado', sql.Decimal(12,2), salario_acumulado)
        .input('vacaciones_no_gozadas', sql.Decimal(12,2), vacaciones_no_gozadas)
        .input('cesantia', sql.Decimal(12,2), cesantia)
        .input('preaviso', sql.Decimal(12,2), preaviso)
        .input('total_pagar', sql.Decimal(12,2), total)
        .input('id_estado', sql.Int, id_estado)
        .input('aprobado_por', sql.Int, aprobado_por)
        .input('fecha_liquidacion', sql.Date, fecha_liquidacion)
        .input('fecha_inicio_periodo', sql.Date, fechaInicio)
        .input('fecha_fin_periodo', sql.Date, fechaFin)
        .input('motivo_liquidacion', sql.VarChar(300), motivo)
        .query(`
          UPDATE Liquidaciones
          SET salario_acumulado = @salario_acumulado,
              vacaciones_no_gozadas = @vacaciones_no_gozadas,
              cesantia = @cesantia,
              preaviso = @preaviso,
              total_pagar = @total_pagar,
              id_estado = @id_estado,
              aprobado_por = @aprobado_por,
              fecha_liquidacion = @fecha_liquidacion,
              fecha_inicio_periodo = @fecha_inicio_periodo,
              fecha_fin_periodo = @fecha_fin_periodo,
              motivo_liquidacion = @motivo_liquidacion,
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
