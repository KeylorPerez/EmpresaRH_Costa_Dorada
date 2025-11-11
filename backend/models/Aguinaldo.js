const { poolPromise, sql } = require('../db/db');

const MS_POR_DIA = 24 * 60 * 60 * 1000;

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

const normalizarFechaUTC = (fecha) => {
  if (!(fecha instanceof Date)) return null;
  return new Date(
    Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate())
  );
};

const agregarMesesPreservandoDia = (fecha, meses) => {
  if (!(fecha instanceof Date)) return null;

  const year = fecha.getUTCFullYear();
  const month = fecha.getUTCMonth();
  const day = fecha.getUTCDate();

  const base = new Date(Date.UTC(year, month + meses, 1));
  const ultimoDiaMes = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)
  ).getUTCDate();

  base.setUTCDate(Math.min(day, ultimoDiaMes));
  return base;
};

const calcularMesesYDiasTrabajados = (inicio, fin) => {
  if (!inicio || !fin) return null;

  const fechaInicio = normalizarFechaUTC(inicio);
  const fechaFin = normalizarFechaUTC(fin);

  if (!fechaInicio || !fechaFin || fechaFin < fechaInicio) {
    return null;
  }

  let mesesCompletos = 0;
  while (true) {
    const siguiente = agregarMesesPreservandoDia(
      fechaInicio,
      mesesCompletos + 1
    );
    if (!siguiente || siguiente > fechaFin) break;
    mesesCompletos += 1;
  }

  const referencia = agregarMesesPreservandoDia(fechaInicio, mesesCompletos);
  if (!referencia || referencia > fechaFin) {
    return {
      mesesCompletos,
      diasParciales: 0,
      diasBaseParcial: 0,
      fraccionParcial: 0,
    };
  }

  const diasDelMes = new Date(
    Date.UTC(referencia.getUTCFullYear(), referencia.getUTCMonth() + 1, 0)
  ).getUTCDate();

  let diasParciales = Math.max(
    0,
    Math.floor((fechaFin - referencia) / MS_POR_DIA)
  );

  if (
    referencia.getUTCDate() === 1 &&
    fechaFin.getUTCDate() === diasDelMes
  ) {
    diasParciales = diasDelMes;
  } else {
    diasParciales = Math.min(diasParciales, diasDelMes);
  }

  const fraccionParcial =
    diasDelMes > 0 ? Math.min(1, diasParciales / diasDelMes) : 0;

  return {
    mesesCompletos,
    diasParciales,
    diasBaseParcial: diasDelMes,
    fraccionParcial,
  };
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
    promedioManual = null,
    fechaInicioPeriodo = null,
    fechaFinPeriodo = null,
    observacion = null,
  }) {
    try {
      const pool = await poolPromise;

      const parseFecha = (valor) => {
        if (!valor) return null;

        if (typeof valor === 'string') {
          const match = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
          if (match) {
            const [, year, month, day] = match;
            const date = new Date(
              Date.UTC(Number(year), Number(month) - 1, Number(day))
            );
            if (!Number.isNaN(date.getTime())) {
              return date;
            }
          }
        }

        const fecha = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
        if (Number.isNaN(fecha.getTime())) return null;

        return new Date(
          Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate())
        );
      };

      const defaultInicio = new Date(Date.UTC(anio - 1, 11, 1));
      const defaultFin = new Date(Date.UTC(anio, 10, 30, 23, 59, 59, 997));

      const inicioPeriodo = parseFecha(fechaInicioPeriodo) || defaultInicio;
      const finPeriodo = parseFecha(fechaFinPeriodo) || defaultFin;

      const periodoSolicitado = {
        inicio: new Date(inicioPeriodo.getTime()),
        fin: new Date(finPeriodo.getTime()),
      };

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
      let fechaFinParaGuardar = finPeriodo;

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

        fechaIngresoBase.setUTCHours(0, 0, 0, 0);

        const inicioCalculoMs = Math.max(
          fechaIngresoBase.getTime(),
          inicioPeriodo.getTime()
        );
        const inicioCalculo = new Date(inicioCalculoMs);
        inicioCalculo.setUTCHours(0, 0, 0, 0);

        if (inicioCalculo > finPeriodo) {
          const error = new Error('La fecha de ingreso se encuentra fuera del periodo de cálculo');
          error.statusCode = 400;
          throw error;
        }

        fechaInicioParaGuardar = inicioCalculo;

        const inicioReferenciaPeriodo =
          inicioPeriodo < defaultInicio ? inicioPeriodo : defaultInicio;
        const diasPeriodo = Math.max(
          Math.floor((finPeriodo - inicioReferenciaPeriodo) / MS_POR_DIA) + 1,
          1
        );
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

        const tipoPagoReferencia = (tipoPagoManual || empleado.tipo_pago || '')
          .toString()
          .toLowerCase();

        let salarioMensualEstimado;
        let montoCalculado;
        let totalEstimado = null;
        let mesesEquivalentes = null;

        const periodoPromedioUsuario =
          promedioManual?.periodo === 'mes' ? 'mes' : 'quincena';
        const diasPromedioUsuario = Number(promedioManual?.dias);
        const montoPromedioUsuario = Number(promedioManual?.monto);
        const tieneDiasPromedioUsuario =
          Number.isFinite(diasPromedioUsuario) && diasPromedioUsuario > 0;
        const tieneMontoPromedioUsuario =
          Number.isFinite(montoPromedioUsuario) && montoPromedioUsuario > 0;

        switch (tipoPagoReferencia) {
          case 'mensual':
            salarioMensualEstimado = salarioBaseReferencia;
            montoCalculado = (salarioMensualEstimado * diasTrabajados) / diasPeriodo;
            break;
          case 'diario': {
            if (tieneMontoPromedioUsuario) {
              salarioMensualEstimado =
                periodoPromedioUsuario === 'mes'
                  ? montoPromedioUsuario
                  : montoPromedioUsuario * 2;
            } else if (tieneDiasPromedioUsuario) {
              const factorPeriodo = periodoPromedioUsuario === 'mes' ? 1 : 2;
              salarioMensualEstimado =
                salarioBaseReferencia * diasPromedioUsuario * factorPeriodo;
            } else {
              salarioMensualEstimado = salarioBaseReferencia * 30;
            }

            totalEstimado = salarioBaseReferencia * diasTrabajados;
            const mesesEquivalentesRaw =
              diasPeriodo > 0 ? (diasTrabajados / diasPeriodo) * 12 : 0;
            mesesEquivalentes =
              mesesEquivalentesRaw > 0
                ? Math.min(12, mesesEquivalentesRaw)
                : 0;
            montoCalculado =
              mesesEquivalentes > 0
                ? (salarioMensualEstimado / 12) * mesesEquivalentes
                : 0;
            break;
          }
          case 'semanal':
            salarioMensualEstimado = salarioBaseReferencia * 4;
            montoCalculado = (salarioMensualEstimado * diasTrabajados) / diasPeriodo;
            break;
          default:
            salarioMensualEstimado = salarioBaseReferencia * 2;
            montoCalculado = (salarioMensualEstimado * diasTrabajados) / diasPeriodo;
            break;
        }

        salarioPromedio = Number(Number(salarioMensualEstimado).toFixed(2));
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
          salario_base_utilizado: Number(Number(salarioBaseReferencia).toFixed(2)),
          tipo_pago_referencia: tipoPagoReferencia || 'desconocido',
          salario_mensual_estimado: Number(Number(salarioMensualEstimado).toFixed(2)),
        };

        if (tipoPagoReferencia === 'diario') {
          detalleCalculo.total_estimado_periodo = Number(
            Number(totalEstimado ?? 0).toFixed(2)
          );
          detalleCalculo.meses_equivalentes = Number(
            Number(mesesEquivalentes ?? 0).toFixed(4)
          );

          if (promedioManual && typeof promedioManual === 'object') {
            const resumenPromedio = { periodo: periodoPromedioUsuario };

            if (tieneMontoPromedioUsuario) {
              resumenPromedio.monto = Number(
                montoPromedioUsuario.toFixed(2)
              );
            }

            if (tieneDiasPromedioUsuario) {
              resumenPromedio.dias = Number(
                diasPromedioUsuario.toFixed(2)
              );
            }

            if (Object.keys(resumenPromedio).length > 0) {
              detalleCalculo.promedio_referencia_usuario = resumenPromedio;
            }
          }

        }
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

        let fechaIngresoEmpleado = null;
        const empleadoInfoResult = await pool
          .request()
          .input('id_empleado', sql.Int, id_empleado)
          .query(`
            SELECT fecha_ingreso
            FROM Empleados
            WHERE id_empleado = @id_empleado
          `);

        const empleadoInfo = empleadoInfoResult.recordset[0];
        if (empleadoInfo) {
          fechaIngresoEmpleado = parseFecha(empleadoInfo.fecha_ingreso);
        }

        const fechasPlanilla = registros
          .flatMap((registro) => [
            parseFecha(registro.periodo_inicio),
            parseFecha(registro.periodo_fin),
            parseFecha(registro.fecha_pago),
          ])
          .filter(
            (fecha) =>
              fecha instanceof Date && !Number.isNaN(fecha.getTime())
          );

        const fechaMinRegistro =
          fechasPlanilla.length > 0
            ? fechasPlanilla.reduce((min, actual) =>
                actual < min ? actual : min
              )
            : null;

        const fechaMaxRegistro =
          fechasPlanilla.length > 0
            ? fechasPlanilla.reduce((max, actual) =>
                actual > max ? actual : max
              )
            : null;

        const fechasInicioCandidatas = [fechaInicioParaGuardar];
        if (fechaIngresoEmpleado) {
          fechasInicioCandidatas.push(fechaIngresoEmpleado);
        }
        if (fechaMinRegistro) {
          fechasInicioCandidatas.push(fechaMinRegistro);
        }

        const inicioSeleccionado = fechasInicioCandidatas.reduce((max, fecha) =>
          max.getTime() >= fecha.getTime() ? max : fecha
        );
        fechaInicioParaGuardar = new Date(inicioSeleccionado.getTime());

        const fechasFinCandidatas = [fechaFinParaGuardar];
        if (fechaMaxRegistro) {
          fechasFinCandidatas.push(fechaMaxRegistro);
        }

        const finSeleccionado = fechasFinCandidatas.reduce((min, fecha) =>
          min.getTime() <= fecha.getTime() ? min : fecha
        );
        fechaFinParaGuardar = new Date(finSeleccionado.getTime());

        if (fechaFinParaGuardar < fechaInicioParaGuardar) {
          fechaInicioParaGuardar = new Date(periodoSolicitado.inicio.getTime());
          fechaFinParaGuardar = new Date(periodoSolicitado.fin.getTime());
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

        const calculoMesesPeriodo = calcularMesesYDiasTrabajados(
          fechaInicioParaGuardar,
          fechaFinParaGuardar
        );

        const mesesLaborados = registros.reduce((set, row) => {
          const referencia =
            row.periodo_fin || row.periodo_inicio || row.fecha_pago;
          const ym = toYearMonth(referencia);
          if (ym) set.add(ym);
          return set;
        }, new Set());

        const mesesCount = (() => {
          if (mesesLaborados.size > 0) {
            return mesesLaborados.size;
          }

          if (fechasPlanilla.length > 0) {
            const fechaMin = fechasPlanilla.reduce((min, actual) =>
              actual < min ? actual : min
            );
            const fechaMax = fechasPlanilla.reduce((max, actual) =>
              actual > max ? actual : max
            );
            const meses = diffMonthsInclusive(fechaMin, fechaMax);
            if (meses) {
              return Math.min(12, Math.max(1, meses));
            }
          }

          const mesesPeriodo = diffMonthsInclusive(
            fechaInicioParaGuardar,
            fechaFinParaGuardar
          );
          if (mesesPeriodo) {
            return Math.min(12, Math.max(1, mesesPeriodo));
          }

          return 12;
        })();

        const mesesTrabajadosInfo = (() => {
          if (calculoMesesPeriodo) {
            const {
              mesesCompletos,
              diasParciales,
              diasBaseParcial,
              fraccionParcial,
            } = calculoMesesPeriodo;

            const total = mesesCompletos + fraccionParcial;
            const totalNormalizado =
              total > 0 ? Math.min(12, Number(total.toFixed(6))) : 0;

            return {
              total: totalNormalizado,
              detalle: {
                meses_completos: mesesCompletos,
                dias_adicionales: diasParciales,
                dias_base_mes_parcial: diasBaseParcial,
                fraccion_mes_parcial: Number(fraccionParcial.toFixed(6)),
              },
            };
          }

          const mesesPeriodo = diffMonthsInclusive(
            fechaInicioParaGuardar,
            fechaFinParaGuardar
          );
          if (mesesPeriodo) {
            const total = Math.min(12, Math.max(1, mesesPeriodo));
            return { total, detalle: null };
          }
          if (mesesCount > 0) {
            const total = Math.min(12, Math.max(1, mesesCount));
            return { total, detalle: null };
          }
          return { total: 12, detalle: null };
        })();

        const mesesTrabajados = mesesTrabajadosInfo.total;

        const divisorPromedio =
          mesesTrabajados > 0
            ? mesesTrabajados
            : mesesCount > 0
            ? mesesCount
            : 12;

        salarioPromedio = Number(
          (divisorPromedio > 0
            ? totalConsiderado / divisorPromedio
            : 0
          ).toFixed(2)
        );

        const aguinaldoCalculado = totalConsiderado / 12;

        montoAguinaldo = Number(aguinaldoCalculado.toFixed(2));

        detalleCalculo = {
          metodo: 'automatico',
          opciones: {
            incluir_bonificaciones: Boolean(incluirBonificaciones),
            incluir_horas_extra: Boolean(incluirHorasExtra),
          },
          periodo: {
            inicio: fechaInicioParaGuardar.toISOString(),
            fin: fechaFinParaGuardar.toISOString(),
          },
          totales: {
            base: Number(totales.base.toFixed(2)),
            bonificaciones: Number(totales.bonificaciones.toFixed(2)),
            horas_extra: Number(totales.horas_extras.toFixed(2)),
            considerado: Number(totalConsiderado.toFixed(2)),
          },
        };

        if (
          periodoSolicitado.inicio.getTime() !==
            fechaInicioParaGuardar.getTime() ||
          periodoSolicitado.fin.getTime() !== fechaFinParaGuardar.getTime()
        ) {
          detalleCalculo.periodo.solicitado = {
            inicio: periodoSolicitado.inicio.toISOString(),
            fin: periodoSolicitado.fin.toISOString(),
          };
        }

        if (fechaIngresoEmpleado) {
          detalleCalculo.periodo.fecha_ingreso_considerada =
            fechaIngresoEmpleado.toISOString();
        }

        if (fechaMinRegistro || fechaMaxRegistro) {
          detalleCalculo.periodo.fuentes_planilla = {};
          if (fechaMinRegistro) {
            detalleCalculo.periodo.fuentes_planilla.inicio =
              fechaMinRegistro.toISOString();
          }
          if (fechaMaxRegistro) {
            detalleCalculo.periodo.fuentes_planilla.fin =
              fechaMaxRegistro.toISOString();
          }
        }

        detalleCalculo.totales.divisor_promedio_mensual = Number(
          divisorPromedio.toFixed(4)
        );

        detalleCalculo.meses_trabajados = {
          equivalentes: Number(mesesTrabajados.toFixed(6)),
        };

        if (mesesTrabajadosInfo.detalle) {
          detalleCalculo.meses_trabajados.meses_completos =
            mesesTrabajadosInfo.detalle.meses_completos;
          detalleCalculo.meses_trabajados.dias_adicionales =
            mesesTrabajadosInfo.detalle.dias_adicionales;
          if (mesesTrabajadosInfo.detalle.dias_base_mes_parcial !== undefined) {
            detalleCalculo.meses_trabajados.dias_base_mes_parcial =
              mesesTrabajadosInfo.detalle.dias_base_mes_parcial;
          }
          if (mesesTrabajadosInfo.detalle.fraccion_mes_parcial !== undefined) {
            detalleCalculo.meses_trabajados.fraccion_mes_parcial =
              mesesTrabajadosInfo.detalle.fraccion_mes_parcial;
          }
        }
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

  static async actualizar(id_aguinaldo, campos = {}) {
    try {
      const pool = await poolPromise;
      const request = pool.request().input('id_aguinaldo', sql.Int, id_aguinaldo);

      const updates = [];

      if (campos.salario_promedio !== undefined) {
        request.input('salario_promedio', sql.Decimal(12, 2), campos.salario_promedio);
        updates.push('salario_promedio = @salario_promedio');
      }

      if (campos.monto_aguinaldo !== undefined) {
        request.input('monto_aguinaldo', sql.Decimal(12, 2), campos.monto_aguinaldo);
        updates.push('monto_aguinaldo = @monto_aguinaldo');
      }

      if (campos.fecha_inicio_periodo !== undefined) {
        request.input('fecha_inicio_periodo', sql.Date, campos.fecha_inicio_periodo);
        updates.push('fecha_inicio_periodo = @fecha_inicio_periodo');
      }

      if (campos.fecha_fin_periodo !== undefined) {
        request.input('fecha_fin_periodo', sql.Date, campos.fecha_fin_periodo);
        updates.push('fecha_fin_periodo = @fecha_fin_periodo');
      }

      if (campos.observacion !== undefined) {
        request.input('observacion', sql.VarChar(200), campos.observacion);
        updates.push('observacion = @observacion');
      }

      if (!updates.length) {
        return this.getById(id_aguinaldo);
      }

      updates.push('fecha_calculo = GETDATE()');

      const result = await request.query(`
        UPDATE Aguinaldos
        SET ${updates.join(', ')}
        WHERE id_aguinaldo = @id_aguinaldo;
      `);

      if (!result.rowsAffected || result.rowsAffected[0] === 0) {
        return null;
      }

      return this.getById(id_aguinaldo);
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
