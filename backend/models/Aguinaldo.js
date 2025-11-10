const { poolPromise, sql } = require('../db/db');

const toYearMonth = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const diffMonthsInclusive = (start, end) => {
  if (!start || !end) return null;
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return null;
  }

  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const endYear = endDate.getFullYear();
  const endMonth = endDate.getMonth();

  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  if (totalMonths <= 0) {
    return null;
  }

  return totalMonths;
};

class Aguinaldo {
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`
          SELECT a.*, e.nombre, e.apellido, e.cedula, e.email
          FROM Aguinaldos a
          LEFT JOIN Empleados e ON a.id_empleado = e.id_empleado
          ORDER BY a.anio DESC, e.nombre, e.apellido
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT a.*, e.nombre, e.apellido, e.cedula, e.email
          FROM Aguinaldos a
          LEFT JOIN Empleados e ON a.id_empleado = e.id_empleado
          WHERE a.id_empleado = @id_empleado
          ORDER BY a.anio DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async getById(id_aguinaldo) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('id_aguinaldo', sql.Int, id_aguinaldo)
        .query(`
          SELECT a.*, e.nombre, e.apellido, e.cedula, e.email
          FROM Aguinaldos a
          LEFT JOIN Empleados e ON a.id_empleado = e.id_empleado
          WHERE a.id_aguinaldo = @id_aguinaldo
        `);
      return result.recordset[0] || null;
    } catch (err) {
      throw err;
    }
  }

  static async calcularYGuardar({
    id_empleado,
    anio,
    metodo = 'automatico',
    incluirBonificaciones = true,
    incluirHorasExtra = false,
    salarioQuincenal = null,
    fechaIngresoManual = null,
    tipoPagoManual = null,
    fechaInicioPeriodo = null,
    fechaFinPeriodo = null,
    observacion = null,
  }) {
    try {
      const pool = await poolPromise;

      const parseFecha = (valor) => {
        if (!valor) return null;
        const fecha = valor instanceof Date ? new Date(valor) : new Date(valor);
        if (Number.isNaN(fecha.getTime())) return null;
        return fecha;
      };

      const defaultInicio = new Date(anio - 1, 11, 1);
      defaultInicio.setHours(0, 0, 0, 0);
      const defaultFin = new Date(anio, 10, 30);
      defaultFin.setHours(23, 59, 59, 997);

      const inicioPeriodo = parseFecha(fechaInicioPeriodo) || defaultInicio;
      inicioPeriodo.setHours(0, 0, 0, 0);
      const finPeriodo = parseFecha(fechaFinPeriodo) || defaultFin;
      finPeriodo.setHours(23, 59, 59, 997);

      if (finPeriodo < inicioPeriodo) {
        const error = new Error('La fecha fin del periodo no puede ser anterior a la fecha de inicio');
        error.statusCode = 400;
        throw error;
      }

      const observacionNormalizada = (() => {
        if (typeof observacion !== 'string') return null;
        const trimmed = observacion.trim();
        if (!trimmed) return null;
        return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
      })();

      const metodoNormalizado = metodo === 'manual' ? 'manual' : 'automatico';

      let salarioPromedio;
      let montoAguinaldo;
      let detalleCalculo = null;
      let fechaInicioParaGuardar = inicioPeriodo;
      const fechaFinParaGuardar = finPeriodo;

      if (metodoNormalizado === 'manual') {
        const empleadoResult = await pool
          .request()
          .input('id_empleado', sql.Int, id_empleado)
          .query(`
            SELECT fecha_ingreso, salario_monto, tipo_pago
            FROM Empleados
            WHERE id_empleado = @id_empleado
          `);

        const empleado = empleadoResult.recordset[0];
        if (!empleado) {
          const error = new Error('Empleado no encontrado');
          error.statusCode = 404;
          throw error;
        }

        const fechaIngresoBase = (() => {
          const preferenciaManual = parseFecha(fechaIngresoManual);
          if (preferenciaManual) return preferenciaManual;
          return parseFecha(empleado.fecha_ingreso);
        })();

        if (!fechaIngresoBase) {
          const error = new Error('No se pudo determinar la fecha de ingreso del colaborador');
          error.statusCode = 400;
          throw error;
        }

        fechaIngresoBase.setHours(0, 0, 0, 0);

        const inicioCalculoMs = Math.max(
          fechaIngresoBase.getTime(),
          inicioPeriodo.getTime()
        );
        const inicioCalculo = new Date(inicioCalculoMs);
        inicioCalculo.setHours(0, 0, 0, 0);

        if (inicioCalculo > finPeriodo) {
          const error = new Error('La fecha de ingreso se encuentra fuera del periodo de cálculo');
          error.statusCode = 400;
          throw error;
        }

        fechaInicioParaGuardar = inicioCalculo;

        const MS_POR_DIA = 24 * 60 * 60 * 1000;
        const diasPeriodo = Math.max(Math.floor((finPeriodo - inicioPeriodo) / MS_POR_DIA) + 1, 1);
        const diasTrabajados = Math.max(Math.floor((finPeriodo - inicioCalculo) / MS_POR_DIA) + 1, 0);

        const salarioBaseReferencia = (() => {
          const manual = Number(salarioQuincenal);
          if (Number.isFinite(manual) && manual > 0) return manual;
          const registro = Number(empleado.salario_monto);
          if (Number.isFinite(registro) && registro > 0) return registro;
          return null;
        })();

        if (salarioBaseReferencia === null) {
          const error = new Error('No se pudo determinar el salario base del colaborador');
          error.statusCode = 400;
          throw error;
        }

        const tipoPagoReferencia = (tipoPagoManual || empleado.tipo_pago || '').toString().toLowerCase();

        let salarioMensualEstimado;
        switch (tipoPagoReferencia) {
          case 'mensual':
            salarioMensualEstimado = salarioBaseReferencia;
            break;
          case 'diario':
            salarioMensualEstimado = salarioBaseReferencia * 30;
            break;
          case 'semanal':
            salarioMensualEstimado = salarioBaseReferencia * 4;
            break;
          default:
            salarioMensualEstimado = salarioBaseReferencia * 2;
            break;
        }

        salarioPromedio = Number(Number(salarioMensualEstimado).toFixed(2));
        const montoCalculado = (salarioMensualEstimado * diasTrabajados) / diasPeriodo;
        montoAguinaldo = Number(Number(montoCalculado).toFixed(2));

        detalleCalculo = {
          metodo: 'manual',
          periodo: {
            inicio: fechaInicioParaGuardar.toISOString(),
            fin: finPeriodo.toISOString(),
            fecha_ingreso_utilizada: inicioCalculo.toISOString(),
            dias_trabajados: diasTrabajados,
            dias_periodo: diasPeriodo,
          },
          salario_quincenal_utilizado: Number(Number(salarioBaseReferencia).toFixed(2)),
          salario_mensual_estimado: Number(Number(salarioMensualEstimado).toFixed(2)),
        };
      } else {
        const planillaResult = await pool
          .request()
          .input('id_empleado', sql.Int, id_empleado)
          .input('inicio_periodo', sql.Date, inicioPeriodo)
          .input('fin_periodo', sql.Date, finPeriodo)
          .query(`
            SELECT pago_neto, periodo_inicio, periodo_fin, salario_bruto, bonificaciones, horas_extras, fecha_pago
            FROM Planilla
            WHERE id_empleado = @id_empleado
              AND (
                (periodo_inicio BETWEEN @inicio_periodo AND @fin_periodo)
                OR (periodo_fin BETWEEN @inicio_periodo AND @fin_periodo)
              )
          `);

        const registros = planillaResult.recordset;

        if (!Array.isArray(registros) || registros.length === 0) {
          const error = new Error('No se encontraron planillas para calcular el aguinaldo en el periodo indicado');
          error.statusCode = 404;
          throw error;
        }

        const toNumber = (value) => {
          const numero = Number(value);
          return Number.isFinite(numero) ? numero : 0;
        };

        const totales = registros.reduce(
          (acumulado, registro) => {
            const salarioBruto = toNumber(registro.salario_bruto);
            const bonificaciones = toNumber(registro.bonificaciones);
            const horasExtras = toNumber(registro.horas_extras);

            const base = salarioBruto - bonificaciones - horasExtras;
            const baseNormalizado = base > 0 ? base : 0;

            return {
              base: acumulado.base + baseNormalizado,
              bonificaciones: acumulado.bonificaciones + bonificaciones,
              horas_extras: acumulado.horas_extras + horasExtras,
            };
          },
          { base: 0, bonificaciones: 0, horas_extras: 0 }
        );

        const totalConsiderado =
          totales.base +
          (incluirBonificaciones ? totales.bonificaciones : 0) +
          (incluirHorasExtra ? totales.horas_extras : 0);

        const mesesLaborados = registros.reduce((set, row) => {
          const referencia = row.periodo_fin || row.periodo_inicio || row.fecha_pago;
          const ym = toYearMonth(referencia);
          if (ym) set.add(ym);
          return set;
        }, new Set());

        const mesesCount = (() => {
          if (mesesLaborados.size > 0) {
            return mesesLaborados.size;
          }

          const fechasReferencia = registros
            .map((row) => row.periodo_inicio || row.periodo_fin || row.fecha_pago)
            .filter(Boolean)
            .map((valor) => new Date(valor))
            .filter((date) => !Number.isNaN(date.getTime()));

          if (fechasReferencia.length > 0) {
            const fechaMin = fechasReferencia.reduce((min, actual) =>
              actual < min ? actual : min
            );
            const fechaMax = fechasReferencia.reduce((max, actual) =>
              actual > max ? actual : max
            );
            const meses = diffMonthsInclusive(fechaMin, fechaMax);
            if (meses) {
              return Math.min(12, Math.max(1, meses));
            }
          }

          const mesesPeriodo = diffMonthsInclusive(fechaInicioParaGuardar, fechaFinParaGuardar);
          if (mesesPeriodo) {
            return Math.min(12, Math.max(1, mesesPeriodo));
          }

          return 12;
        })();

        salarioPromedio = Number(
          (mesesCount > 0 ? totalConsiderado / mesesCount : 0).toFixed(2)
        );

        const mesesTrabajados = (() => {
          const mesesPeriodo = diffMonthsInclusive(
            fechaInicioParaGuardar,
            fechaFinParaGuardar
          );
          if (mesesPeriodo) {
            return Math.min(12, Math.max(1, mesesPeriodo));
          }
          if (mesesCount > 0) {
            return Math.min(12, Math.max(1, mesesCount));
          }
          return 12;
        })();

        const aguinaldoCalculado =
          mesesTrabajados > 0 ? (salarioPromedio / 12) * mesesTrabajados : 0;

        montoAguinaldo = Number(aguinaldoCalculado.toFixed(2));

        detalleCalculo = {
          metodo: 'automatico',
          opciones: {
            incluir_bonificaciones: Boolean(incluirBonificaciones),
            incluir_horas_extra: Boolean(incluirHorasExtra),
          },
          periodo: {
            inicio: inicioPeriodo.toISOString(),
            fin: finPeriodo.toISOString(),
          },
          totales: {
            base: Number(totales.base.toFixed(2)),
            bonificaciones: Number(totales.bonificaciones.toFixed(2)),
            horas_extra: Number(totales.horas_extras.toFixed(2)),
            considerado: Number(totalConsiderado.toFixed(2)),
          },
        };
      }

      const existenteResult = await pool
        .request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('anio', sql.Int, anio)
        .query(`
          SELECT TOP 1 id_aguinaldo, pagado
          FROM Aguinaldos
          WHERE id_empleado = @id_empleado AND anio = @anio
        `);

      const existente = existenteResult.recordset[0];
      let idAguinaldo;
      let pagadoActual = false;

      if (existente) {
        idAguinaldo = Number(existente.id_aguinaldo);
        pagadoActual = Boolean(existente.pagado);

        await pool
          .request()
          .input('id_aguinaldo', sql.Int, idAguinaldo)
          .input('salario_promedio', sql.Decimal(12, 2), salarioPromedio)
          .input('monto_aguinaldo', sql.Decimal(12, 2), montoAguinaldo)
          .input('fecha_inicio_periodo', sql.Date, fechaInicioParaGuardar)
          .input('fecha_fin_periodo', sql.Date, fechaFinParaGuardar)
          .input('observacion', sql.VarChar(200), observacionNormalizada)
          .query(`
            UPDATE Aguinaldos
            SET salario_promedio = @salario_promedio,
                monto_aguinaldo = @monto_aguinaldo,
                fecha_calculo = GETDATE(),
                fecha_inicio_periodo = @fecha_inicio_periodo,
                fecha_fin_periodo = @fecha_fin_periodo,
                observacion = @observacion
            WHERE id_aguinaldo = @id_aguinaldo
          `);
      } else {
        const insertResult = await pool
          .request()
          .input('id_empleado', sql.Int, id_empleado)
          .input('anio', sql.Int, anio)
          .input('salario_promedio', sql.Decimal(12, 2), salarioPromedio)
          .input('monto_aguinaldo', sql.Decimal(12, 2), montoAguinaldo)
          .input('fecha_inicio_periodo', sql.Date, fechaInicioParaGuardar)
          .input('fecha_fin_periodo', sql.Date, fechaFinParaGuardar)
          .input('observacion', sql.VarChar(200), observacionNormalizada)
          .query(`
            INSERT INTO Aguinaldos (id_empleado, anio, salario_promedio, monto_aguinaldo, fecha_calculo, pagado, fecha_inicio_periodo, fecha_fin_periodo, observacion)
            VALUES (@id_empleado, @anio, @salario_promedio, @monto_aguinaldo, GETDATE(), 0, @fecha_inicio_periodo, @fecha_fin_periodo, @observacion);
            SELECT SCOPE_IDENTITY() AS id_aguinaldo;
          `);

        idAguinaldo = Number(insertResult.recordset[0]?.id_aguinaldo);
        pagadoActual = false;
      }

      if (!Number.isInteger(idAguinaldo) || idAguinaldo <= 0) {
        throw new Error('No fue posible determinar el identificador del aguinaldo calculado');
      }

      const aguinaldo = await this.getById(idAguinaldo);
      if (!aguinaldo) {
        return {
          id_aguinaldo: idAguinaldo,
          id_empleado,
          anio,
          salario_promedio: salarioPromedio,
          monto_aguinaldo: montoAguinaldo,
          fecha_calculo: new Date().toISOString(),
          pagado: pagadoActual,
          fecha_inicio_periodo: fechaInicioParaGuardar,
          fecha_fin_periodo: fechaFinParaGuardar,
          observacion: observacionNormalizada,
          detalle_calculo: detalleCalculo,
        };
      }

      return {
        ...aguinaldo,
        fecha_inicio_periodo: aguinaldo.fecha_inicio_periodo || fechaInicioParaGuardar,
        fecha_fin_periodo: aguinaldo.fecha_fin_periodo || fechaFinParaGuardar,
        observacion: aguinaldo.observacion || observacionNormalizada,
        detalle_calculo: detalleCalculo,
      };
    } catch (err) {
      throw err;
    }
  }

  static async actualizarPago(id_aguinaldo, pagado) {
    try {
      const pool = await poolPromise;
      const resultado = await pool
        .request()
        .input('id_aguinaldo', sql.Int, id_aguinaldo)
        .input('pagado', sql.Bit, pagado ? 1 : 0)
        .query(`
          UPDATE Aguinaldos
          SET pagado = @pagado
          WHERE id_aguinaldo = @id_aguinaldo;
          SELECT @@ROWCOUNT AS filas_afectadas;
        `);

      const filas = Number(resultado.recordset[0]?.filas_afectadas || 0);
      if (filas === 0) {
        const error = new Error('Aguinaldo no encontrado');
        error.statusCode = 404;
        throw error;
      }

      return this.getById(id_aguinaldo);
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Aguinaldo;
