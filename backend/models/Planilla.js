const { poolPromise, sql } = require('../db/db');

class Planilla {
  // 🔹 Obtener todas las planillas (admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT pl.*, e.nombre, e.apellido, e.salario_monto
          FROM Planilla pl
          LEFT JOIN Empleados e ON pl.id_empleado = e.id_empleado
          ORDER BY pl.periodo_inicio DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Obtener planillas por empleado
  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT *
          FROM Planilla
          WHERE id_empleado = @id_empleado
          ORDER BY periodo_inicio DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Generar o calcular planilla
  static async calcularPlanilla({
    id_empleado,
    periodo_inicio,
    periodo_fin,
    horas_extras = 0,
    bonificaciones = 0,
    deducciones = 0,
    fecha_pago = null,
    prestamos = [],
  }) {
    try {
      const pool = await poolPromise;

      const empleadoRes = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT salario_monto, porcentaje_ccss, usa_deduccion_fija, deduccion_fija
          FROM Empleados
          WHERE id_empleado = @id_empleado
        `);

      const empleado = empleadoRes.recordset[0] || {};
      const salario_base = Number(empleado.salario_monto) || 0;
      const porcentaje_ccss =
        empleado.porcentaje_ccss !== null && empleado.porcentaje_ccss !== undefined
          ? Number(empleado.porcentaje_ccss)
          : 9.34;
      const usa_deduccion_fija = Boolean(empleado.usa_deduccion_fija);
      const deduccion_fija = Number(empleado.deduccion_fija || 0);

      const prestamosValidos = Array.isArray(prestamos)
        ? prestamos
            .map((prestamo) => ({
              id_prestamo: Number(prestamo.id_prestamo),
              monto_pago: Number(Number(prestamo.monto_pago || 0).toFixed(2)),
            }))
            .filter(
              (prestamo) =>
                Number.isInteger(prestamo.id_prestamo) &&
                !Number.isNaN(prestamo.monto_pago) &&
                prestamo.monto_pago > 0
            )
        : [];

      const deduccionesPrestamos = prestamosValidos.reduce(
        (sum, prestamo) => sum + prestamo.monto_pago,
        0
      );

      const horasExtrasNumber = Number(horas_extras) || 0;
      const bonificacionesNumber = Number(bonificaciones) || 0;
      const deduccionesBase = Number(deducciones) || 0;

      const salario_bruto = salario_base + bonificacionesNumber + (horasExtrasNumber * (salario_base / 160));
      const ccss_deduccion = usa_deduccion_fija
        ? deduccion_fija
        : Number((salario_bruto * (porcentaje_ccss / 100)).toFixed(2));
      const deducciones_totales = Number((deduccionesBase + deduccionesPrestamos).toFixed(2));
      const total_deducciones_para_pago = deducciones_totales + ccss_deduccion;
      const pago_neto = salario_bruto - total_deducciones_para_pago;

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const request = new sql.Request(transaction);

        request
          .input('id_empleado', sql.Int, id_empleado)
          .input('periodo_inicio', sql.Date, periodo_inicio)
          .input('periodo_fin', sql.Date, periodo_fin)
          .input('salario_bruto', sql.Decimal(12, 2), salario_bruto)
          .input('bonificaciones', sql.Decimal(12, 2), bonificacionesNumber)
          .input('deducciones', sql.Decimal(12, 2), deducciones_totales)
          .input('ccss_deduccion', sql.Decimal(10, 2), ccss_deduccion)
          .input('horas_extras', sql.Decimal(6, 2), horasExtrasNumber)
          .input('pago_neto', sql.Decimal(12, 2), pago_neto)
          .input('fecha_pago', sql.Date, fecha_pago);

        const result = await request.query(`
          INSERT INTO Planilla (id_empleado, periodo_inicio, periodo_fin, salario_bruto, deducciones, ccss_deduccion, horas_extras, bonificaciones, pago_neto, fecha_pago, created_at, updated_at)
          VALUES (@id_empleado, @periodo_inicio, @periodo_fin, @salario_bruto, @deducciones, @ccss_deduccion, @horas_extras, @bonificaciones, @pago_neto, @fecha_pago, GETDATE(), GETDATE());
          SELECT SCOPE_IDENTITY() AS id_planilla;
        `);

        for (const prestamo of prestamosValidos) {
          const saldoRequest = new sql.Request(transaction);
          const saldoResult = await saldoRequest
            .input('id_prestamo', sql.Int, prestamo.id_prestamo)
            .query(`
              SELECT saldo
              FROM Prestamos WITH (ROWLOCK, UPDLOCK)
              WHERE id_prestamo = @id_prestamo
            `);

          if (!saldoResult.recordset[0]) {
            throw new Error('Préstamo no encontrado');
          }

          const saldoActual = Number(saldoResult.recordset[0].saldo);
          if (Number.isNaN(saldoActual)) {
            throw new Error('Saldo del préstamo inválido');
          }

          if (prestamo.monto_pago > saldoActual) {
            throw new Error('El monto a descontar supera el saldo del préstamo');
          }

          await new sql.Request(transaction)
            .input('id_prestamo', sql.Int, prestamo.id_prestamo)
            .input('monto_pago', sql.Decimal(12, 2), prestamo.monto_pago)
            .query(`
              UPDATE Prestamos
              SET saldo = CASE WHEN saldo - @monto_pago < 0 THEN 0 ELSE saldo - @monto_pago END,
                  fecha_ultimo_pago = GETDATE(),
                  updated_at = GETDATE()
              WHERE id_prestamo = @id_prestamo
            `);
        }

        await transaction.commit();
        return result.recordset[0];
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Actualizar planilla existente
  static async update(id_planilla, { horas_extras, bonificaciones, deducciones, fecha_pago }) {
    try {
      const pool = await poolPromise;

      const planillaRes = await pool.request()
        .input('id_planilla', sql.Int, id_planilla)
        .query('SELECT id_empleado FROM Planilla WHERE id_planilla = @id_planilla');

      if (!planillaRes.recordset[0]) {
        throw new Error('Planilla no encontrada');
      }

      const id_empleado = planillaRes.recordset[0].id_empleado;

      const empleadoRes = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT salario_monto, porcentaje_ccss, usa_deduccion_fija, deduccion_fija
          FROM Empleados
          WHERE id_empleado = @id_empleado
        `);

      const empleado = empleadoRes.recordset[0] || {};
      const salario_base = Number(empleado.salario_monto) || 0;
      const porcentaje_ccss =
        empleado.porcentaje_ccss !== null && empleado.porcentaje_ccss !== undefined
          ? Number(empleado.porcentaje_ccss)
          : 9.34;
      const usa_deduccion_fija = Boolean(empleado.usa_deduccion_fija);
      const deduccion_fija = Number(empleado.deduccion_fija || 0);

      const horasExtrasNumber = Number(horas_extras) || 0;
      const bonificacionesNumber = Number(bonificaciones) || 0;
      const deduccionesNumber = Number(deducciones) || 0;

      const salario_bruto = salario_base + bonificacionesNumber + (horasExtrasNumber * (salario_base / 160));
      const ccss_deduccion = usa_deduccion_fija
        ? deduccion_fija
        : Number((salario_bruto * (porcentaje_ccss / 100)).toFixed(2));
      const deducciones_totales = deduccionesNumber + ccss_deduccion;
      const pago_neto = salario_bruto - deducciones_totales;

      await pool.request()
        .input('id_planilla', sql.Int, id_planilla)
        .input('horas_extras', sql.Decimal(6,2), horasExtrasNumber)
        .input('bonificaciones', sql.Decimal(12,2), bonificacionesNumber)
        .input('deducciones', sql.Decimal(12,2), deduccionesNumber)
        .input('ccss_deduccion', sql.Decimal(10,2), ccss_deduccion)
        .input('salario_bruto', sql.Decimal(12,2), salario_bruto)
        .input('pago_neto', sql.Decimal(12,2), pago_neto)
        .input('fecha_pago', sql.Date, fecha_pago)
        .query(`
          UPDATE Planilla
          SET horas_extras = @horas_extras,
              bonificaciones = @bonificaciones,
              deducciones = @deducciones,
              ccss_deduccion = @ccss_deduccion,
              salario_bruto = @salario_bruto,
              pago_neto = @pago_neto,
              fecha_pago = @fecha_pago,
              updated_at = GETDATE()
          WHERE id_planilla = @id_planilla
        `);
      return { message: 'Planilla actualizada correctamente' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Planilla;
