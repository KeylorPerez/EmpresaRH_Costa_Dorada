/**
 * Modelo de planillas. Orquesta las consultas de periodos de pago y
 * guarda los montos calculados para cada colaborador.
 */
const { poolPromise, sql } = require('../db/db');
const { resolvePlanillaAutomaticaColumn } = require('../utils/empleadoSchema');
const Asistencia = require('./Asistencia');
const DetallePlanilla = require('./DetallePlanilla');
const DiasDobles = require('./DiasDobles');
const DescansoSemanal = require('./DescansoSemanal');

const ESTADOS_ASISTENCIA = ['Presente', 'Ausente', 'Permiso', 'Vacaciones', 'Incapacidad', 'Descanso'];
const MS_POR_DIA = 1000 * 60 * 60 * 24;
const isTruthyBit = (value) => Number(value) === 1 || value === true;

const planillaSchemaState = {
  checked: false,
  hasEsAutomaticaColumn: false,
};

const ENSURE_PLANILLA_SCHEMA_QUERY = `
IF OBJECT_ID('dbo.Planilla', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.Planilla', 'es_automatica') IS NULL
  BEGIN
    ALTER TABLE dbo.Planilla
      ADD es_automatica BIT NOT NULL CONSTRAINT DF_Planilla_EsAutomatica DEFAULT (1);
  END;
END;
`;

async function resolvePlanillaSchema(requestFactory) {
  if (planillaSchemaState.checked) {
    return planillaSchemaState;
  }

  const getRequest = async () => {
    if (typeof requestFactory === 'function') {
      return requestFactory();
    }

    const pool = await poolPromise;
    return pool.request();
  };

  const ensureRequest = await getRequest();
  await ensureRequest.query(ENSURE_PLANILLA_SCHEMA_QUERY);

  const checkRequest = await getRequest();
  const result = await checkRequest.query(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'Planilla'
      AND COLUMN_NAME = 'es_automatica'
  `);

  planillaSchemaState.checked = true;
  planillaSchemaState.hasEsAutomaticaColumn = result.recordset.length > 0;

  return planillaSchemaState;
}

const calcularDiasPeriodo = (inicio, fin) => {
  if (!inicio || !fin) return 0;
  const fechaInicio = new Date(inicio);
  const fechaFin = new Date(fin);
  const diferencia = Math.floor((fechaFin - fechaInicio) / MS_POR_DIA) + 1;
  return Math.max(diferencia, 0);
};

const parseUtcDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const addDays = (date, days) => new Date(date.getTime() + days * MS_POR_DIA);

const resolveWeekType = (fecha, inicioVigencia) => {
  const diff = Math.floor((fecha.getTime() - inicioVigencia.getTime()) / MS_POR_DIA);
  const weekIndex = Math.floor(diff / 7);
  return weekIndex % 2 === 0 ? 'A' : 'B';
};

const normalizeDescansoRows = (rows = []) =>
  rows
    .map((row) => {
      const inicio = parseUtcDate(row.fecha_inicio_vigencia);
      if (!inicio) {
        return null;
      }
      const fin = parseUtcDate(row.fecha_fin_vigencia);

      return {
        ...row,
        semana_tipo: typeof row.semana_tipo === 'string' ? row.semana_tipo.trim().toUpperCase() : '',
        dia_semana: Number(row.dia_semana),
        fecha_inicio_vigencia: inicio,
        fecha_fin_vigencia: fin,
      };
    })
    .filter((row) => {
      if (!row) return false;
      if (row.semana_tipo !== 'A' && row.semana_tipo !== 'B') return false;
      if (!Number.isFinite(row.dia_semana)) return false;
      return row.dia_semana >= 0 && row.dia_semana <= 6;
    });

const countDescansoDays = async (id_empleado, periodo_inicio, periodo_fin) => {
  const inicio = parseUtcDate(periodo_inicio);
  const fin = parseUtcDate(periodo_fin);
  if (!inicio || !fin || fin < inicio) return 0;

  const rows = await DescansoSemanal.getByEmpleadoInRange(id_empleado, periodo_inicio, periodo_fin);
  const normalizedRows = normalizeDescansoRows(rows);
  if (normalizedRows.length === 0) {
    return 0;
  }

  const fechasSet = new Set();
  let cursor = new Date(inicio.getTime());

  while (cursor <= fin) {
    const diaSemana = cursor.getUTCDay();

    normalizedRows.forEach((row) => {
      if (row.dia_semana !== diaSemana) return;
      if (cursor < row.fecha_inicio_vigencia) return;
      if (row.fecha_fin_vigencia && cursor > row.fecha_fin_vigencia) return;

      const weekType = resolveWeekType(cursor, row.fecha_inicio_vigencia);
      if (weekType !== row.semana_tipo) return;
      fechasSet.add(cursor.toISOString().slice(0, 10));
    });

    cursor = addDays(cursor, 1);
  }

  return fechasSet.size;
};

const resolveDiasPagoManual = async (id_empleado, periodo_inicio, periodo_fin) => {
  const diasPeriodo = calcularDiasPeriodo(periodo_inicio, periodo_fin);
  if (diasPeriodo <= 0) return 0;
  const descansoDias = await countDescansoDays(id_empleado, periodo_inicio, periodo_fin);
  return Math.max(diasPeriodo - descansoDias, 0);
};

const buildDiasDoblesAuto = async ({
  id_empleado,
  periodo_inicio,
  periodo_fin,
  salario_base,
  filtrar_por_asistencia = true,
}) => {
  const diasDobles = await DiasDobles.getActiveInRange(periodo_inicio, periodo_fin);
  if (!Array.isArray(diasDobles) || diasDobles.length === 0) {
    return { diasDobles: 0, montoExtra: 0 };
  }

  let asistenciaSet = null;
  let filtrarPorAsistencia = false;

  if (filtrar_por_asistencia) {
    const asistenciaFechas = await Asistencia.getDistinctAttendanceDays(
      id_empleado,
      periodo_inicio,
      periodo_fin
    );
    asistenciaSet = new Set(asistenciaFechas);
    filtrarPorAsistencia = asistenciaSet.size > 0;
  }

  const diasAplicados = diasDobles.filter((dia) =>
    filtrarPorAsistencia && asistenciaSet ? asistenciaSet.has(dia.fecha) : true
  );

  const montoExtra = diasAplicados.reduce((sum, dia) => {
    const multiplicador = Number(dia.multiplicador) || 1;
    const factorExtra = Math.max(multiplicador - 1, 0);
    return sum + salario_base * factorExtra;
  }, 0);

  return {
    diasDobles: diasAplicados.length,
    montoExtra: Number(Number(montoExtra).toFixed(2)),
  };
};

function sanitizeDetallePlanilla(detalles) {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return [];
  }

  return detalles
    .map((detalle) => {
      const estadoTexto = typeof detalle.estado === 'string' ? detalle.estado.trim() : '';
      const estadoNormalizado = ESTADOS_ASISTENCIA.includes(estadoTexto) ? estadoTexto : 'Presente';

      const asistenciaTexto = (() => {
        if (typeof detalle.asistencia === 'string') {
          const texto = detalle.asistencia.trim();
          if (texto.length > 0) {
            return texto.length > 50 ? texto.slice(0, 50) : texto;
          }
        }
        if (estadoNormalizado === 'Descanso') {
          return 'Descanso';
        }
        return detalle.asistio ? 'Asistió' : 'Faltó';
      })();

      const tipoTexto = (() => {
        if (typeof detalle.tipo === 'string') {
          const texto = detalle.tipo.trim();
          if (texto.length > 0) {
            return texto.length > 50 ? texto.slice(0, 50) : texto;
          }
        }
        return detalle.es_dia_doble ? 'Día doble' : 'Normal';
      })();

      const justificadoValor =
        detalle.justificado === true ||
        detalle.justificado === 1 ||
        detalle.justificado === '1';

      const justificacionTexto = (() => {
        if (!justificadoValor) return null;
        if (detalle.justificacion === undefined || detalle.justificacion === null) {
          return null;
        }
        const texto = String(detalle.justificacion).trim();
        if (!texto) return null;
        return texto.length > 500 ? texto.slice(0, 500) : texto;
      })();

      const salarioDia = Number(Number(detalle.salario_dia || 0).toFixed(2));

      return {
        fecha: detalle.fecha,
        dia_semana: detalle.dia_semana,
        salario_dia: salarioDia,
        asistio: Boolean(detalle.asistio),
        es_dia_doble: Boolean(detalle.es_dia_doble),
        estado: estadoNormalizado.length > 50 ? estadoNormalizado.slice(0, 50) : estadoNormalizado,
        asistencia: asistenciaTexto,
        tipo: tipoTexto,
        justificado: justificadoValor,
        justificacion: justificacionTexto,
        observacion:
          detalle.observacion !== undefined && detalle.observacion !== null
            ? String(detalle.observacion).slice(0, 150)
            : null,
      };
    })
    .filter((detalle) => Boolean(detalle.fecha) && Boolean(detalle.dia_semana));
}

class Planilla {
  // 🔹 Obtener todas las planillas (admin)
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT pl.*, e.nombre, e.apellido, e.salario_monto, e.tipo_pago AS tipo_pago_empleado
          FROM Planilla pl
          LEFT JOIN Empleados e ON pl.id_empleado = e.id_empleado
          ORDER BY pl.periodo_inicio DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async getById(id_planilla) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_planilla', sql.Int, id_planilla)
        .query(`
          SELECT pl.*, e.nombre, e.apellido, e.salario_monto, e.tipo_pago AS tipo_pago_empleado,
                 e.email, e.cedula
          FROM Planilla pl
          LEFT JOIN Empleados e ON pl.id_empleado = e.id_empleado
          WHERE pl.id_planilla = @id_planilla
        `);
      return result.recordset[0] || null;
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
          SELECT pl.*, e.nombre, e.apellido, e.tipo_pago AS tipo_pago_empleado
          FROM Planilla pl
          LEFT JOIN Empleados e ON pl.id_empleado = e.id_empleado
          WHERE pl.id_empleado = @id_empleado
          ORDER BY pl.periodo_inicio DESC
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
    dias_trabajados = null,
    dias_descuento = 0,
    monto_descuento_dias = null,
    dias_dobles = 0,
    monto_dias_dobles = null,
    detalles = [],
    es_automatica = null,
  }) {
    try {
      const pool = await poolPromise;
      const { hasEsAutomaticaColumn } = await resolvePlanillaSchema(() => pool.request());

      // Verificar si ya existe una planilla que cubra el mismo periodo
      const existingPlanilla = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('periodo_inicio', sql.Date, periodo_inicio)
        .input('periodo_fin', sql.Date, periodo_fin)
        .query(`
          SELECT id_planilla
          FROM Planilla
          WHERE id_empleado = @id_empleado
            AND periodo_inicio <= @periodo_fin
            AND periodo_fin >= @periodo_inicio
        `);

      if (existingPlanilla.recordset.length > 0) {
        const error = new Error('Ya existe una planilla registrada para este periodo');
        error.statusCode = 409;
        throw error;
      }

      const planillaColumn = await resolvePlanillaAutomaticaColumn(pool);
      const planillaColumnSelect = planillaColumn
        ? `${planillaColumn} AS planilla_automatica`
        : 'CAST(0 AS bit) AS planilla_automatica';

      const empleadoRes = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT salario_monto, porcentaje_ccss, usa_deduccion_fija, deduccion_fija, tipo_pago, estado, ${planillaColumnSelect}
          FROM Empleados
          WHERE id_empleado = @id_empleado
            AND estado = 1
        `);

      const empleado = empleadoRes.recordset[0];
      if (!empleado) {
        const error = new Error('Empleado no encontrado o inactivo');
        error.statusCode = 404;
        throw error;
      }
      const salario_base = Number(empleado.salario_monto) || 0;
      const porcentaje_ccss =
        empleado.porcentaje_ccss !== null && empleado.porcentaje_ccss !== undefined
          ? Number(empleado.porcentaje_ccss)
          : 9.34;
      const usa_deduccion_fija = Boolean(empleado.usa_deduccion_fija);
      const deduccion_fija = Number(empleado.deduccion_fija || 0);
      const tipo_pago = empleado.tipo_pago || 'Quincenal';
      const employeeAllowsAuto = isTruthyBit(empleado.planilla_automatica);
      const hasManualAutoFlag = es_automatica !== null && es_automatica !== undefined;
      const esAutomatica = hasManualAutoFlag
        ? isTruthyBit(es_automatica)
        : employeeAllowsAuto;

      const DIAS_POR_QUINCENA = 15;
      const DIAS_LIBRES_QUINCENA = 2;
      const DIAS_POR_MES = 30;
      const diasPeriodoQuincena = calcularDiasPeriodo(periodo_inicio, periodo_fin);
      const diasReferenciaPago =
        tipo_pago === 'Mensual'
          ? DIAS_POR_MES
          : tipo_pago === 'Quincenal' && diasPeriodoQuincena > 0
            ? diasPeriodoQuincena
            : DIAS_POR_QUINCENA;

      const detallesSanitizados = sanitizeDetallePlanilla(detalles);

      let diasTrabajadosCalculados = null;
      if (dias_trabajados === null || dias_trabajados === undefined) {
        diasTrabajadosCalculados = null;
      } else {
        const diasValor = Number(dias_trabajados);
        diasTrabajadosCalculados = Number.isFinite(diasValor) && diasValor >= 0 ? diasValor : 0;
      }

      const diasDescuentoValor = (() => {
        const valor = Number(dias_descuento);
        if (!Number.isFinite(valor) || valor <= 0) return 0;
        return valor;
      })();

      const montoDescuentoDiasValor = (() => {
        if (monto_descuento_dias === null || monto_descuento_dias === undefined) return null;
        const valor = Number(monto_descuento_dias);
        if (!Number.isFinite(valor) || valor < 0) return null;
        return valor;
      })();

      const diasDoblesValor = (() => {
        const valor = Number(dias_dobles);
        if (!Number.isFinite(valor) || valor <= 0) return 0;
        return valor;
      })();

      const montoDiasDoblesValor = (() => {
        if (monto_dias_dobles === null || monto_dias_dobles === undefined) return null;
        const valor = Number(monto_dias_dobles);
        if (!Number.isFinite(valor) || valor < 0) return null;
        return valor;
      })();

      const detallesDoblesPresentes = detallesSanitizados.some((detalle) => detalle.es_dia_doble);
      const autoDiasDoblesInfo =
        tipo_pago === 'Diario' && !detallesDoblesPresentes && diasDoblesValor === 0 && montoDiasDoblesValor === null
          ? await buildDiasDoblesAuto({
              id_empleado,
              periodo_inicio,
              periodo_fin,
              salario_base,
              filtrar_por_asistencia: esAutomatica,
            })
          : null;

      let salarioBasePeriodo = salario_base;
      let deduccionDiasMonto = 0;

      if (detallesSanitizados.length > 0) {
        salarioBasePeriodo = detallesSanitizados.reduce((sum, detalle) => {
          const salario = Number(detalle.salario_dia) || 0;
          return sum + salario;
        }, 0);
        salarioBasePeriodo = Number(Number(salarioBasePeriodo).toFixed(2));
        if (autoDiasDoblesInfo && autoDiasDoblesInfo.montoExtra > 0) {
          salarioBasePeriodo = Number(
            (salarioBasePeriodo + autoDiasDoblesInfo.montoExtra).toFixed(2)
          );
        }
      } else if (tipo_pago === 'Diario') {
        let diasParaPago = diasTrabajadosCalculados;

        if (diasParaPago === null) {
          if (esAutomatica) {
            const diasAsistencia = await Asistencia.countDistinctDays(
              id_empleado,
              periodo_inicio,
              periodo_fin,
            );
            diasParaPago = diasAsistencia;
          } else {
            diasParaPago = await resolveDiasPagoManual(id_empleado, periodo_inicio, periodo_fin);
          }
        }

        if (!Number.isFinite(diasParaPago) || diasParaPago < 0) {
          diasParaPago = 0;
        }

        const pagoDiasNormales = Number((salario_base * diasParaPago).toFixed(2));
        let montoExtraDiasDobles = 0;

        if (montoDiasDoblesValor !== null) {
          montoExtraDiasDobles = Number(montoDiasDoblesValor.toFixed(2));
        } else if (diasDoblesValor > 0 && salario_base > 0) {
          montoExtraDiasDobles = salario_base * diasDoblesValor;
        } else if (autoDiasDoblesInfo && autoDiasDoblesInfo.montoExtra > 0) {
          montoExtraDiasDobles = autoDiasDoblesInfo.montoExtra;
        }

        if (!Number.isFinite(montoExtraDiasDobles) || montoExtraDiasDobles < 0) {
          montoExtraDiasDobles = 0;
        }

        const montoExtraNormalizado = Number(montoExtraDiasDobles.toFixed(2));
        salarioBasePeriodo = Number((pagoDiasNormales + montoExtraNormalizado).toFixed(2));
      } else {
        const salarioDiarioEstimado = salario_base > 0 ? salario_base / diasReferenciaPago : 0;

        if (tipo_pago === 'Quincenal' && diasTrabajadosCalculados !== null) {
          const diasTrabajadosNormalizados =
            Number.isFinite(diasTrabajadosCalculados) && diasTrabajadosCalculados >= 0
              ? diasTrabajadosCalculados
              : 0;
          const diasLibres = Math.max(diasReferenciaPago - diasTrabajadosNormalizados, 0);
          const diasExtra = Math.max(DIAS_LIBRES_QUINCENA - diasLibres, 0);
          const diasPago = Math.max(diasTrabajadosNormalizados + diasExtra, 0);
          salarioBasePeriodo = Number((salarioDiarioEstimado * diasPago).toFixed(2));
          deduccionDiasMonto = 0;
        } else {
          if (montoDescuentoDiasValor !== null) {
            deduccionDiasMonto = montoDescuentoDiasValor;
          } else if (diasDescuentoValor > 0 && salarioDiarioEstimado > 0) {
            deduccionDiasMonto = salarioDiarioEstimado * diasDescuentoValor;
          }

          if (!Number.isFinite(deduccionDiasMonto) || deduccionDiasMonto < 0) {
            deduccionDiasMonto = 0;
          }

          deduccionDiasMonto = Number(
            Math.min(deduccionDiasMonto, Math.max(salarioBasePeriodo, 0)).toFixed(2)
          );
        }
      }

      const montoHorasExtras = Math.max(Number(horas_extras) || 0, 0);
      const bonificacionesNumber = Math.max(Number(bonificaciones) || 0, 0);
      const deduccionesBase = Math.max(Number(deducciones) || 0, 0);

      const pagoHorasExtras = Number(montoHorasExtras.toFixed(2));

      const salario_bruto_base = Number((salarioBasePeriodo + bonificacionesNumber + pagoHorasExtras).toFixed(2));
      const salario_bruto = salario_bruto_base;

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

      const ccssBase = Math.max(salario_bruto_base - deduccionDiasMonto, 0);
      const ccss_deduccion = usa_deduccion_fija
        ? deduccion_fija
        : Number((ccssBase * (porcentaje_ccss / 100)).toFixed(2));
      const deducciones_totales = Number((deduccionesBase + deduccionesPrestamos + deduccionDiasMonto).toFixed(2));
      const total_deducciones_para_pago = Number((deducciones_totales + ccss_deduccion).toFixed(2));
      const pago_neto = Number((salario_bruto_base - total_deducciones_para_pago).toFixed(2));

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
          .input('horas_extras', sql.Decimal(12, 2), pagoHorasExtras)
          .input('pago_neto', sql.Decimal(12, 2), pago_neto)
          .input('fecha_pago', sql.Date, fecha_pago);

        if (hasEsAutomaticaColumn) {
          request.input('es_automatica', sql.Bit, esAutomatica ? 1 : 0);
        }

        const insertColumns = [
          'id_empleado',
          'periodo_inicio',
          'periodo_fin',
          'salario_bruto',
          'deducciones',
          'ccss_deduccion',
          'horas_extras',
          'bonificaciones',
          'pago_neto',
          'fecha_pago',
        ];
        const insertValues = [
          '@id_empleado',
          '@periodo_inicio',
          '@periodo_fin',
          '@salario_bruto',
          '@deducciones',
          '@ccss_deduccion',
          '@horas_extras',
          '@bonificaciones',
          '@pago_neto',
          '@fecha_pago',
        ];

        if (hasEsAutomaticaColumn) {
          insertColumns.push('es_automatica');
          insertValues.push('@es_automatica');
        }

        insertColumns.push('created_at', 'updated_at');
        insertValues.push('GETDATE()', 'GETDATE()');

        const result = await request.query(`
          INSERT INTO Planilla (${insertColumns.join(', ')})
          VALUES (${insertValues.join(', ')});
          SELECT SCOPE_IDENTITY() AS id_planilla;
        `);

        const planillaId = Number(result.recordset[0]?.id_planilla);

        if (!Number.isInteger(planillaId)) {
          throw new Error('No se pudo obtener el identificador de la planilla creada');
        }

        if (detallesSanitizados.length > 0) {
          await DetallePlanilla.createMany(transaction, planillaId, detallesSanitizados);
        }

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
        return { ...result.recordset[0], detalles: detallesSanitizados };
      } catch (err) {
        await transaction.rollback();
        throw err;
      }
    } catch (err) {
      throw err;
    }
  }

  // 🔹 Actualizar planilla existente
  static async update(
    id_planilla,
    {
      horas_extras = 0,
      bonificaciones = 0,
      deducciones = 0,
      fecha_pago = null,
      dias_trabajados = null,
      dias_descuento = 0,
      monto_descuento_dias = null,
      dias_dobles = 0,
      monto_dias_dobles = null,
      detalles = [],
      es_automatica = null,
    }
  ) {
    try {
      const pool = await poolPromise;
      const { hasEsAutomaticaColumn } = await resolvePlanillaSchema(() => pool.request());

      const planillaSelect = hasEsAutomaticaColumn
        ? 'es_automatica'
        : 'CAST(0 AS bit) AS es_automatica';

      const planillaRes = await pool.request()
        .input('id_planilla', sql.Int, id_planilla)
        .query(
          `SELECT id_empleado, periodo_inicio, periodo_fin, ${planillaSelect}
           FROM Planilla
           WHERE id_planilla = @id_planilla`
        );

      if (!planillaRes.recordset[0]) {
        throw new Error('Planilla no encontrada');
      }

      const { id_empleado, periodo_inicio, periodo_fin, es_automatica: planillaAutomatica } =
        planillaRes.recordset[0];

      const planillaColumn = await resolvePlanillaAutomaticaColumn(pool);
      const planillaColumnSelect = planillaColumn
        ? `${planillaColumn} AS planilla_automatica`
        : 'CAST(0 AS bit) AS planilla_automatica';

      const empleadoRes = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT salario_monto, porcentaje_ccss, usa_deduccion_fija, deduccion_fija, tipo_pago, ${planillaColumnSelect}
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
      const tipo_pago = empleado.tipo_pago || 'Quincenal';
      const employeeAllowsAuto = isTruthyBit(empleado.planilla_automatica);
      const hasManualAutoFlag = es_automatica !== null && es_automatica !== undefined;
      const esAutomatica = hasManualAutoFlag
        ? isTruthyBit(es_automatica)
        : employeeAllowsAuto
        ? isTruthyBit(planillaAutomatica)
        : false;
      const DIAS_POR_QUINCENA = 15;
      const DIAS_LIBRES_QUINCENA = 2;
      const DIAS_POR_MES = 30;
      const diasPeriodoQuincena = calcularDiasPeriodo(periodo_inicio, periodo_fin);
      const diasReferenciaPago =
        tipo_pago === 'Mensual'
          ? DIAS_POR_MES
          : tipo_pago === 'Quincenal' && diasPeriodoQuincena > 0
            ? diasPeriodoQuincena
            : DIAS_POR_QUINCENA;

      const detallesSanitizados = sanitizeDetallePlanilla(detalles);
      const detallesDoblesPresentes = detallesSanitizados.some((detalle) => detalle.es_dia_doble);

      const diasDoblesValor = Number(dias_dobles) || 0;
      const montoDiasDoblesValor =
        monto_dias_dobles === null || monto_dias_dobles === undefined
          ? null
          : Number(monto_dias_dobles);
      const autoDiasDoblesInfo =
        tipo_pago === 'Diario' && !detallesDoblesPresentes && diasDoblesValor === 0 && montoDiasDoblesValor === null
          ? await buildDiasDoblesAuto({
              id_empleado,
              periodo_inicio,
              periodo_fin,
              salario_base,
              filtrar_por_asistencia: esAutomatica,
            })
          : null;

      const montoHorasExtras = Math.max(Number(horas_extras) || 0, 0);
      const bonificacionesNumber = Math.max(Number(bonificaciones) || 0, 0);
      const deduccionesBase = Math.max(Number(deducciones) || 0, 0);

      let salarioBasePeriodo = 0;
      let deduccionDiasMonto = 0;

      if (detallesSanitizados.length > 0) {
        salarioBasePeriodo = detallesSanitizados.reduce((sum, detalle) => {
          const salario = Number(detalle.salario_dia) || 0;
          return sum + salario;
        }, 0);
        salarioBasePeriodo = Number(Number(salarioBasePeriodo).toFixed(2));
        if (autoDiasDoblesInfo && autoDiasDoblesInfo.montoExtra > 0) {
          salarioBasePeriodo = Number(
            (salarioBasePeriodo + autoDiasDoblesInfo.montoExtra).toFixed(2)
          );
        }
      } else if (tipo_pago === 'Diario') {
        const diasValor = Number(dias_trabajados);
        let diasParaPago;
        if (Number.isNaN(diasValor) || diasValor < 0) {
          if (esAutomatica) {
            const diasAsistencia = await Asistencia.countDistinctDays(
              id_empleado,
              periodo_inicio,
              periodo_fin,
            );
            diasParaPago = Number.isFinite(diasAsistencia) && diasAsistencia > 0 ? diasAsistencia : 0;
          } else {
            diasParaPago = await resolveDiasPagoManual(id_empleado, periodo_inicio, periodo_fin);
          }
        } else {
          diasParaPago = diasValor;
        }

        let montoExtraDiasDobles = 0;

        if (
          montoDiasDoblesValor !== null &&
          Number.isFinite(montoDiasDoblesValor) &&
          montoDiasDoblesValor >= 0
        ) {
          montoExtraDiasDobles = montoDiasDoblesValor;
        } else if (diasDoblesValor > 0 && salario_base > 0) {
          montoExtraDiasDobles = salario_base * diasDoblesValor;
        } else if (autoDiasDoblesInfo && autoDiasDoblesInfo.montoExtra > 0) {
          montoExtraDiasDobles = autoDiasDoblesInfo.montoExtra;
        }

        const pagoDiasNormales = Number((salario_base * Math.max(diasParaPago, 0)).toFixed(2));
        const montoExtraNormalizado = Number(Number(montoExtraDiasDobles).toFixed(2));
        salarioBasePeriodo = Number((pagoDiasNormales + montoExtraNormalizado).toFixed(2));
      } else {
        const salarioDiarioEstimado = salario_base > 0 ? salario_base / diasReferenciaPago : 0;
        const diasTrabajadosValor = Number(dias_trabajados);
        const diasTrabajadosNormalizados =
          Number.isFinite(diasTrabajadosValor) && diasTrabajadosValor >= 0 ? diasTrabajadosValor : null;

        if (tipo_pago === 'Quincenal' && diasTrabajadosNormalizados !== null) {
          const diasLibres = Math.max(diasReferenciaPago - diasTrabajadosNormalizados, 0);
          const diasExtra = Math.max(DIAS_LIBRES_QUINCENA - diasLibres, 0);
          const diasPago = Math.max(diasTrabajadosNormalizados + diasExtra, 0);
          salarioBasePeriodo = Number((salarioDiarioEstimado * diasPago).toFixed(2));
          deduccionDiasMonto = 0;
        } else {
          salarioBasePeriodo = salario_base;

          const diasDescuentoValor = Number(dias_descuento);
          const montoDescuentoDiasValor =
            monto_descuento_dias === null || monto_descuento_dias === undefined
              ? null
              : Number(monto_descuento_dias);

          if (
            montoDescuentoDiasValor !== null &&
            Number.isFinite(montoDescuentoDiasValor) &&
            montoDescuentoDiasValor >= 0
          ) {
            deduccionDiasMonto = montoDescuentoDiasValor;
          } else if (!Number.isNaN(diasDescuentoValor) && diasDescuentoValor > 0 && salarioDiarioEstimado > 0) {
            deduccionDiasMonto = salarioDiarioEstimado * diasDescuentoValor;
          }

          if (!Number.isFinite(deduccionDiasMonto) || deduccionDiasMonto < 0) {
            deduccionDiasMonto = 0;
          }

          deduccionDiasMonto = Number(
            Math.min(deduccionDiasMonto, Math.max(salarioBasePeriodo, 0)).toFixed(2)
          );
        }
      }

      if (!Number.isFinite(salarioBasePeriodo) || salarioBasePeriodo < 0) {
        salarioBasePeriodo = 0;
      }

      const salario_bruto = Number(
        (salarioBasePeriodo + bonificacionesNumber + montoHorasExtras).toFixed(2)
      );
      const ccssBase = Math.max(salario_bruto - deduccionDiasMonto, 0);
      const ccss_deduccion = usa_deduccion_fija
        ? deduccion_fija
        : Number((ccssBase * (porcentaje_ccss / 100)).toFixed(2));
      const deducciones_totales = Number((deduccionesBase + deduccionDiasMonto).toFixed(2));
      const total_deducciones = Number((deducciones_totales + ccss_deduccion).toFixed(2));
      const pago_neto = Number((salario_bruto - total_deducciones).toFixed(2));

      const transaction = new sql.Transaction(pool);
      await transaction.begin();

      try {
        const updateRequest = new sql.Request(transaction)
          .input('id_planilla', sql.Int, id_planilla)
          .input('horas_extras', sql.Decimal(12, 2), montoHorasExtras)
          .input('bonificaciones', sql.Decimal(12, 2), bonificacionesNumber)
          .input('deducciones', sql.Decimal(12, 2), deducciones_totales)
          .input('ccss_deduccion', sql.Decimal(10, 2), ccss_deduccion)
          .input('salario_bruto', sql.Decimal(12, 2), salario_bruto)
          .input('pago_neto', sql.Decimal(12, 2), pago_neto)
          .input('fecha_pago', sql.Date, fecha_pago);

        if (hasEsAutomaticaColumn) {
          updateRequest.input('es_automatica', sql.Bit, esAutomatica ? 1 : 0);
        }

        const updateAssignments = [
          'horas_extras = @horas_extras',
          'bonificaciones = @bonificaciones',
          'deducciones = @deducciones',
          'ccss_deduccion = @ccss_deduccion',
          'salario_bruto = @salario_bruto',
          'pago_neto = @pago_neto',
          'fecha_pago = @fecha_pago',
          'updated_at = GETDATE()',
        ];

        if (hasEsAutomaticaColumn) {
          updateAssignments.splice(
            updateAssignments.length - 1,
            0,
            'es_automatica = COALESCE(@es_automatica, es_automatica)'
          );
        }

        await updateRequest.query(`
          UPDATE Planilla
          SET ${updateAssignments.join(',\n                ')}
          WHERE id_planilla = @id_planilla
        `);

        await DetallePlanilla.deleteByPlanilla(transaction, id_planilla);

        if (detallesSanitizados.length > 0) {
          await DetallePlanilla.createMany(transaction, id_planilla, detallesSanitizados);
        }

        await transaction.commit();
      } catch (err) {
        await transaction.rollback();
        throw err;
      }

      return { message: 'Planilla actualizada correctamente' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Planilla;
