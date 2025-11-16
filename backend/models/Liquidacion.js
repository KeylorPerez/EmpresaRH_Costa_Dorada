const { poolPromise, sql } = require('../db/db');
const LiquidacionDetalle = require('./LiquidacionDetalle');
const LiquidacionSalarioHistorico = require('./LiquidacionSalarioHistorico');

const toDecimalOrNull = (value) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  return Number(numeric.toFixed(2));
};

const toIntegerOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric);
};

const toDateOrNull = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

class Liquidacion {
  static async getAll() {
    const pool = await poolPromise;
    const result = await pool.request().query(`
      SELECT
        l.id_liquidacion,
        l.id_empleado,
        l.salario_acumulado,
        l.total_pagar,
        l.fecha_liquidacion,
        l.aprobado_por,
        l.id_estado,
        l.created_at,
        l.updated_at,
        l.fecha_inicio_periodo,
        l.fecha_fin_periodo,
        l.motivo_liquidacion,
        l.salario_promedio_mensual,
        l.salario_promedio_diario,
        l.dias_trabajados_aguinaldo,
        l.dias_pendientes_vacaciones,
        l.dias_preaviso,
        l.dias_cesantia,
        l.observaciones,
        e.nombre,
        e.apellido,
        e.salario_monto AS salario_base,
        COALESCE(SUM(CASE WHEN d.tipo = 'INGRESO' THEN COALESCE(d.monto_final, d.monto_calculado) ELSE 0 END), 0) AS total_ingresos_detalle,
        COALESCE(SUM(CASE WHEN d.tipo = 'DESCUENTO' THEN COALESCE(d.monto_final, d.monto_calculado) ELSE 0 END), 0) AS total_descuentos_detalle,
        COUNT(d.id_detalle) AS cantidad_detalles
      FROM Liquidaciones l
      LEFT JOIN Empleados e ON l.id_empleado = e.id_empleado
      LEFT JOIN Liquidacion_Detalles d ON l.id_liquidacion = d.id_liquidacion
      GROUP BY
        l.id_liquidacion,
        l.id_empleado,
        l.salario_acumulado,
        l.total_pagar,
        l.fecha_liquidacion,
        l.aprobado_por,
        l.id_estado,
        l.created_at,
        l.updated_at,
        l.fecha_inicio_periodo,
        l.fecha_fin_periodo,
        l.motivo_liquidacion,
        l.salario_promedio_mensual,
        l.salario_promedio_diario,
        l.dias_trabajados_aguinaldo,
        l.dias_pendientes_vacaciones,
        l.dias_preaviso,
        l.dias_cesantia,
        l.observaciones,
        e.nombre,
        e.apellido,
        e.salario_monto
      ORDER BY l.created_at DESC
    `);

    return result.recordset || [];
  }

  static async getById(id_liquidacion) {
    const pool = await poolPromise;
    const headerResult = await pool.request()
      .input('id_liquidacion', sql.Int, id_liquidacion)
      .query(`
        SELECT TOP 1
          l.id_liquidacion,
          l.id_empleado,
          l.salario_acumulado,
          l.total_pagar,
          l.fecha_liquidacion,
          l.aprobado_por,
          l.id_estado,
          l.created_at,
          l.updated_at,
          l.fecha_inicio_periodo,
          l.fecha_fin_periodo,
          l.motivo_liquidacion,
          l.salario_promedio_mensual,
          l.salario_promedio_diario,
          l.dias_trabajados_aguinaldo,
          l.dias_pendientes_vacaciones,
          l.dias_preaviso,
          l.dias_cesantia,
          l.observaciones,
          e.nombre,
          e.apellido,
          e.salario_monto AS salario_base
        FROM Liquidaciones l
        LEFT JOIN Empleados e ON l.id_empleado = e.id_empleado
        WHERE l.id_liquidacion = @id_liquidacion
      `);

    const header = headerResult.recordset[0];
    if (!header) {
      return null;
    }

    const detalles = await LiquidacionDetalle.getByLiquidacion(pool, id_liquidacion);
    const salariosHistoricos = await LiquidacionSalarioHistorico.getByLiquidacion(pool, id_liquidacion);
    return { ...header, detalles, salarios_historicos: salariosHistoricos };
  }

  static async calcularPromedioSalario(id_empleado, { meses = 6, fechaReferencia = new Date() } = {}) {
    const pool = await poolPromise;
    const fechaCorte = toDateOrNull(fechaReferencia) || new Date();
    const fechaDesde = new Date(fechaCorte);
    fechaDesde.setMonth(fechaDesde.getMonth() - meses);

    const request = pool.request();
    const result = await request
      .input('id_empleado', sql.Int, id_empleado)
      .input('fecha_desde', sql.Date, fechaDesde)
      .input('fecha_hasta', sql.Date, fechaCorte)
      .input('limite', sql.Int, meses * 2)
      .query(`
        SELECT TOP (@limite)
          pago_neto,
          salario_bruto,
          periodo_inicio,
          periodo_fin,
          fecha_pago
        FROM Planilla
        WHERE id_empleado = @id_empleado
          AND periodo_fin IS NOT NULL
          AND periodo_fin BETWEEN @fecha_desde AND @fecha_hasta
        ORDER BY periodo_fin DESC
      `);

    const historico = result.recordset || [];
    const montos = historico
      .map((row) => {
        const base = row.pago_neto !== null && row.pago_neto !== undefined ? row.pago_neto : row.salario_bruto;
        const numero = Number(base);
        return Number.isFinite(numero) ? numero : null;
      })
      .filter((value) => value !== null);

    if (!montos.length) {
      return { promedio: null, historico };
    }

    const suma = montos.reduce((acc, monto) => acc + monto, 0);
    const promedio = Number((suma / montos.length).toFixed(2));
    return { promedio, historico };
  }

  static async create({
    id_empleado,
    fecha_liquidacion,
    fecha_inicio_periodo,
    fecha_fin_periodo,
    motivo_liquidacion,
    id_estado,
    aprobado_por = null,
    salario_promedio_mensual = null,
    observaciones = null,
    detalles = [],
    salario_acumulado = null,
    total_pagar = null,
    salario_promedio_diario = null,
    dias_trabajados_aguinaldo = null,
    dias_pendientes_vacaciones = null,
    dias_preaviso = null,
    dias_cesantia = null,
    salarios_historicos = [],
  }) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const detallesSanitizados = LiquidacionDetalle.sanitizeDetalles(detalles);
      const totales = LiquidacionDetalle.calcularTotales(detallesSanitizados);
      const historicosSanitizados = LiquidacionSalarioHistorico.sanitizeHistorico(
        salarios_historicos,
      );

      const salarioAcumuladoFinal = toDecimalOrNull(salario_acumulado);
      const totalPagarFinal =
        toDecimalOrNull(total_pagar) !== null
          ? toDecimalOrNull(total_pagar)
          : totales.total_pagar;

      const request = new sql.Request(transaction);
      request
        .input('id_empleado', sql.Int, id_empleado)
        .input('salario_acumulado', sql.Decimal(12, 2), salarioAcumuladoFinal)
        .input('total_pagar', sql.Decimal(12, 2), totalPagarFinal)
        .input('fecha_liquidacion', sql.Date, toDateOrNull(fecha_liquidacion) || new Date())
        .input('aprobado_por', sql.Int, aprobado_por)
        .input('id_estado', sql.Int, id_estado)
        .input('fecha_inicio_periodo', sql.Date, toDateOrNull(fecha_inicio_periodo))
        .input('fecha_fin_periodo', sql.Date, toDateOrNull(fecha_fin_periodo))
        .input('motivo_liquidacion', sql.VarChar(300), motivo_liquidacion || null)
        .input('salario_promedio_mensual', sql.Decimal(12, 2), toDecimalOrNull(salario_promedio_mensual))
        .input('observaciones', sql.VarChar(500), observaciones || null)
        .input('salario_promedio_diario', sql.Decimal(18, 2), toDecimalOrNull(salario_promedio_diario))
        .input('dias_trabajados_aguinaldo', sql.Int, toIntegerOrNull(dias_trabajados_aguinaldo))
        .input('dias_pendientes_vacaciones', sql.Int, toIntegerOrNull(dias_pendientes_vacaciones))
        .input('dias_preaviso', sql.Int, toIntegerOrNull(dias_preaviso))
        .input('dias_cesantia', sql.Int, toIntegerOrNull(dias_cesantia));

      const insertResult = await request.query(`
        INSERT INTO Liquidaciones
          (id_empleado, salario_acumulado, total_pagar, fecha_liquidacion, aprobado_por, id_estado, created_at, updated_at,
           fecha_inicio_periodo, fecha_fin_periodo, motivo_liquidacion, salario_promedio_mensual, observaciones,
           salario_promedio_diario, dias_trabajados_aguinaldo, dias_pendientes_vacaciones,
           dias_preaviso, dias_cesantia)
        VALUES
          (@id_empleado, @salario_acumulado, @total_pagar, @fecha_liquidacion, @aprobado_por, @id_estado, GETDATE(), GETDATE(),
           @fecha_inicio_periodo, @fecha_fin_periodo, @motivo_liquidacion, @salario_promedio_mensual, @observaciones,
           @salario_promedio_diario, @dias_trabajados_aguinaldo, @dias_pendientes_vacaciones,
           @dias_preaviso, @dias_cesantia);
        SELECT SCOPE_IDENTITY() AS id_liquidacion;
      `);

      const newId = Number(insertResult.recordset[0]?.id_liquidacion);
      if (!Number.isInteger(newId)) {
        throw new Error('No fue posible obtener el identificador de la liquidación creada');
      }

      await LiquidacionDetalle.insertMany(transaction, newId, detallesSanitizados);
      await LiquidacionSalarioHistorico.insertMany(transaction, newId, historicosSanitizados);
      await transaction.commit();

      return {
        id_liquidacion: newId,
        total_pagar: totalPagarFinal,
        salario_acumulado: salarioAcumuladoFinal,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }

  static async update(id_liquidacion, {
    fecha_liquidacion,
    fecha_inicio_periodo,
    fecha_fin_periodo,
    motivo_liquidacion,
    id_estado,
    aprobado_por = null,
    salario_promedio_mensual = null,
    observaciones = null,
    detalles = null,
    salario_acumulado = null,
    total_pagar = null,
    salario_promedio_diario = null,
    dias_trabajados_aguinaldo = null,
    dias_pendientes_vacaciones = null,
    dias_preaviso = null,
    dias_cesantia = null,
    salarios_historicos = null,
  }) {
    const pool = await poolPromise;
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      let detallesSanitizados = null;
      let totales = null;

      if (Array.isArray(detalles)) {
        detallesSanitizados = LiquidacionDetalle.sanitizeDetalles(detalles);
        totales = LiquidacionDetalle.calcularTotales(detallesSanitizados);
        await LiquidacionDetalle.deleteByLiquidacion(transaction, id_liquidacion);
        await LiquidacionDetalle.insertMany(transaction, id_liquidacion, detallesSanitizados);
      }

      if (Array.isArray(salarios_historicos)) {
        const historicosSanitizados = LiquidacionSalarioHistorico.sanitizeHistorico(salarios_historicos);
        await LiquidacionSalarioHistorico.deleteByLiquidacion(transaction, id_liquidacion);
        await LiquidacionSalarioHistorico.insertMany(transaction, id_liquidacion, historicosSanitizados);
      }

      const salarioAcumuladoFinal =
        toDecimalOrNull(salario_acumulado) !== null
          ? toDecimalOrNull(salario_acumulado)
          : null;

      const totalPagarFinal =
        toDecimalOrNull(total_pagar) !== null
          ? toDecimalOrNull(total_pagar)
          : totales
            ? totales.total_pagar
            : null;

      const request = new sql.Request(transaction);
      request
        .input('id_liquidacion', sql.Int, id_liquidacion)
        .input('fecha_liquidacion', sql.Date, toDateOrNull(fecha_liquidacion))
        .input('fecha_inicio_periodo', sql.Date, toDateOrNull(fecha_inicio_periodo))
        .input('fecha_fin_periodo', sql.Date, toDateOrNull(fecha_fin_periodo))
        .input('motivo_liquidacion', sql.VarChar(300), motivo_liquidacion || null)
        .input('id_estado', sql.Int, id_estado)
        .input('aprobado_por', sql.Int, aprobado_por)
        .input('salario_promedio_mensual', sql.Decimal(12, 2), toDecimalOrNull(salario_promedio_mensual))
        .input('observaciones', sql.VarChar(500), observaciones || null)
        .input('salario_acumulado', sql.Decimal(12, 2), salarioAcumuladoFinal)
        .input('total_pagar', sql.Decimal(12, 2), totalPagarFinal)
        .input('salario_promedio_diario', sql.Decimal(18, 2), toDecimalOrNull(salario_promedio_diario))
        .input('dias_trabajados_aguinaldo', sql.Int, toIntegerOrNull(dias_trabajados_aguinaldo))
        .input('dias_pendientes_vacaciones', sql.Int, toIntegerOrNull(dias_pendientes_vacaciones))
        .input('dias_preaviso', sql.Int, toIntegerOrNull(dias_preaviso))
        .input('dias_cesantia', sql.Int, toIntegerOrNull(dias_cesantia));

      await request.query(`
        UPDATE Liquidaciones
        SET
          fecha_liquidacion = COALESCE(@fecha_liquidacion, fecha_liquidacion),
          fecha_inicio_periodo = COALESCE(@fecha_inicio_periodo, fecha_inicio_periodo),
          fecha_fin_periodo = COALESCE(@fecha_fin_periodo, fecha_fin_periodo),
          motivo_liquidacion = COALESCE(@motivo_liquidacion, motivo_liquidacion),
          id_estado = COALESCE(@id_estado, id_estado),
          aprobado_por = COALESCE(@aprobado_por, aprobado_por),
          salario_promedio_mensual = COALESCE(@salario_promedio_mensual, salario_promedio_mensual),
          observaciones = COALESCE(@observaciones, observaciones),
          salario_acumulado = COALESCE(@salario_acumulado, salario_acumulado),
          total_pagar = COALESCE(@total_pagar, total_pagar),
          salario_promedio_diario = COALESCE(@salario_promedio_diario, salario_promedio_diario),
          dias_trabajados_aguinaldo = COALESCE(@dias_trabajados_aguinaldo, dias_trabajados_aguinaldo),
          dias_pendientes_vacaciones = COALESCE(@dias_pendientes_vacaciones, dias_pendientes_vacaciones),
          dias_preaviso = COALESCE(@dias_preaviso, dias_preaviso),
          dias_cesantia = COALESCE(@dias_cesantia, dias_cesantia),
          updated_at = GETDATE()
        WHERE id_liquidacion = @id_liquidacion;
      `);

      await transaction.commit();

      return {
        id_liquidacion,
        total_pagar: totalPagarFinal,
        salario_acumulado: salarioAcumuladoFinal,
      };
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  }
}

module.exports = Liquidacion;
