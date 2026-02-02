/**
 * Modelo de planillas. Orquesta las consultas de periodos de pago y
 * guarda los montos calculados para cada colaborador.
 */
const { poolPromise, sql } = require('../db/db');
const { resolvePlanillaAutomaticaColumn } = require('../utils/empleadoSchema');
const Asistencia = require('./Asistencia');
const DescansoConfig = require('./DescansoConfig');
const DetallePlanilla = require('./DetallePlanilla');
const DiasDobles = require('./DiasDobles');
const parseUtcDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const ESTADOS_ASISTENCIA = ['Presente', 'Ausente', 'Permiso', 'Vacaciones', 'Incapacidad', 'Descanso'];
const MS_POR_DIA = 1000 * 60 * 60 * 24;
const isTruthyBit = (value) => Number(value) === 1 || value === true;
const normalizeDiaSemana = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (numeric === 7) return 0;
  if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) return numeric;
  return null;
};

const planillaSchemaState = {
  checked: false,
  hasEsAutomaticaColumn: false,
};

const ENSURE_PLANILLA_SCHEMA_QUERY = `
IF NOT EXISTS (
  SELECT *
  FROM sys.objects
  WHERE object_id = OBJECT_ID(N'[dbo].[Planilla]')
    AND type in (N'U')
)
BEGIN
  CREATE TABLE [dbo].[Planilla](
    [id_planilla] INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    [id_empleado] INT NOT NULL,
    [periodo_inicio] DATE NOT NULL,
    [periodo_fin] DATE NOT NULL,
    [salario_bruto] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_Planilla_SalarioBruto DEFAULT (0),
    [deducciones] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_Planilla_Deducciones DEFAULT (0),
    [ccss_deduccion] DECIMAL(10, 2) NOT NULL CONSTRAINT DF_Planilla_CcssDeduccion DEFAULT (0),
    [horas_extras] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_Planilla_HorasExtras DEFAULT (0),
    [bonificaciones] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_Planilla_Bonificaciones DEFAULT (0),
    [pago_neto] DECIMAL(12, 2) NOT NULL CONSTRAINT DF_Planilla_PagoNeto DEFAULT (0),
    [fecha_pago] DATE NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT DF_Planilla_CreatedAt DEFAULT (SYSDATETIME()),
    [updated_at] DATETIME2 NOT NULL CONSTRAINT DF_Planilla_UpdatedAt DEFAULT (SYSDATETIME()),
    CONSTRAINT FK_Planilla_Empleado FOREIGN KEY (id_empleado) REFERENCES Empleados(id_empleado)
  );
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

const resolveDescansoPeriod = (fecha, config) => {
  if (!fecha || !config) return null;
  const tipoPatron = String(config.tipo_patron || '').trim().toUpperCase();
  if (tipoPatron !== 'ALTERNADO') {
    return 'A';
  }

  const fechaBase = parseUtcDate(config.fecha_base);
  if (!fechaBase) return 'A';

  const ciclo = String(config.ciclo || '').trim().toUpperCase();
  const cicloDias = ciclo === 'QUINCENAL' ? 15 : 7;
  if (!Number.isFinite(cicloDias) || cicloDias <= 0) {
    return 'A';
  }

  const diffDays = Math.floor((fecha.getTime() - fechaBase.getTime()) / MS_POR_DIA);
  const periodIndex = Math.floor(diffDays / cicloDias);
  const parity = ((periodIndex % 2) + 2) % 2;
  return parity === 0 ? 'A' : 'B';
};

const countDescansoDays = async (id_empleado, periodo_inicio, periodo_fin) => {
  if (!id_empleado || !periodo_inicio || !periodo_fin) {
    return 0;
  }

  const descansoConfig = await DescansoConfig.getByEmpleadoId(id_empleado);
  if (!descansoConfig) {
    return 0;
  }

  const descansoDias = await DescansoConfig.getDiasByConfigId(descansoConfig.id_config);
  const diasA = new Set();
  const diasB = new Set();

  if (Array.isArray(descansoDias)) {
    descansoDias.forEach((dia) => {
      if (!dia || !dia.es_descanso) return;
      const periodo = String(dia.periodo_tipo || '').trim().toUpperCase();
      const diaSemana = normalizeDiaSemana(dia.dia_semana);
      if (diaSemana === null) return;
      if (periodo === 'B') {
        diasB.add(diaSemana);
      } else {
        diasA.add(diaSemana);
      }
    });
  }

  if (diasA.size === 0 && diasB.size === 0) {
    return 0;
  }

  const inicioVigencia = parseUtcDate(descansoConfig.fecha_inicio_vigencia);
  const finVigencia = parseUtcDate(descansoConfig.fecha_fin_vigencia);
  const fechaInicio = parseUtcDate(periodo_inicio);
  const fechaFin = parseUtcDate(periodo_fin);

  if (!inicioVigencia || !fechaInicio || !fechaFin) {
    return 0;
  }

  let cursor = fechaInicio > inicioVigencia ? fechaInicio : inicioVigencia;
  const limite = finVigencia && finVigencia < fechaFin ? finVigencia : fechaFin;

  if (cursor > limite) {
    return 0;
  }

  let total = 0;
  const alternado = String(descansoConfig.tipo_patron || '').trim().toUpperCase() === 'ALTERNADO'
    && diasB.size > 0;

  while (cursor <= limite) {
    const periodo = alternado ? resolveDescansoPeriod(cursor, descansoConfig) : 'A';
    const set = periodo === 'B' ? diasB : diasA;
    if (set.has(cursor.getUTCDay())) {
      total += 1;
    }
    cursor = new Date(cursor.getTime() + MS_POR_DIA);
  }

  return total;
};

const buildDescansoFechaSet = async (id_empleado, periodo_inicio, periodo_fin) => {
  if (!id_empleado || !periodo_inicio || !periodo_fin) {
    return new Set();
  }

  const descansoConfig = await DescansoConfig.getByEmpleadoId(id_empleado);
  if (!descansoConfig) {
    return new Set();
  }

  const descansoDias = await DescansoConfig.getDiasByConfigId(descansoConfig.id_config);
  const diasA = new Set();
  const diasB = new Set();

  if (Array.isArray(descansoDias)) {
    descansoDias.forEach((dia) => {
      if (!dia || !dia.es_descanso) return;
      const periodo = String(dia.periodo_tipo || '').trim().toUpperCase();
      const diaSemana = normalizeDiaSemana(dia.dia_semana);
      if (diaSemana === null) return;
      if (periodo === 'B') {
        diasB.add(diaSemana);
      } else {
        diasA.add(diaSemana);
      }
    });
  }

  if (diasA.size === 0 && diasB.size === 0) {
    return new Set();
  }

  const inicioVigencia = parseUtcDate(descansoConfig.fecha_inicio_vigencia);
  const finVigencia = parseUtcDate(descansoConfig.fecha_fin_vigencia);
  const fechaInicio = parseUtcDate(periodo_inicio);
  const fechaFin = parseUtcDate(periodo_fin);

  if (!inicioVigencia || !fechaInicio || !fechaFin) {
    return new Set();
  }

  let cursor = fechaInicio > inicioVigencia ? fechaInicio : inicioVigencia;
  const limite = finVigencia && finVigencia < fechaFin ? finVigencia : fechaFin;

  if (cursor > limite) {
    return new Set();
  }

  const descansos = new Set();
  const alternado = String(descansoConfig.tipo_patron || '').trim().toUpperCase() === 'ALTERNADO'
    && diasB.size > 0;

  while (cursor <= limite) {
    const periodo = alternado ? resolveDescansoPeriod(cursor, descansoConfig) : 'A';
    const set = periodo === 'B' ? diasB : diasA;
    if (set.has(cursor.getUTCDay())) {
      descansos.add(cursor.toISOString().split('T')[0]);
    }
    cursor = new Date(cursor.getTime() + MS_POR_DIA);
  }

  return descansos;
};

const resolveDiasPagoManual = async (id_empleado, periodo_inicio, periodo_fin) => {
  const diasPeriodo = calcularDiasPeriodo(periodo_inicio, periodo_fin);
  if (diasPeriodo <= 0) return 0;
  return Math.max(diasPeriodo, 0);
};

const buildDiasDoblesAuto = async ({
  id_empleado,
  periodo_inicio,
  periodo_fin,
  salario_base,
  salario_dia_base,
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

  const salarioDiaAplicado = Number.isFinite(salario_dia_base) && salario_dia_base > 0
    ? salario_dia_base
    : salario_base;

  const montoExtra = diasAplicados.reduce((sum, dia) => {
    const multiplicador = Number(dia.multiplicador) || 1;
    const factorExtra = Math.max(multiplicador - 1, 0);
    return sum + salarioDiaAplicado * factorExtra;
  }, 0);

  return {
    diasDobles: diasAplicados.length,
    montoExtra: Number(Number(montoExtra).toFixed(2)),
  };
};

const normalizeMultiplicador = (value, fallback = 2) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 1) {
    return fallback;
  }
  return numeric;
};

const normalizeFechaDiaDobleKey = (value) => {
  const fecha = parseUtcDate(value);
  if (!fecha) return null;
  return fecha.toISOString().split('T')[0];
};

const applyDescansoToDetalles = (detalles, descansoFechas) => {
  if (!Array.isArray(detalles) || detalles.length === 0 || !descansoFechas || descansoFechas.size === 0) {
    return detalles;
  }

  return detalles.map((detalle) => {
    if (!detalle || !detalle.fecha) {
      return detalle;
    }

    const fechaKey = normalizeFechaDiaDobleKey(detalle.fecha);
    if (!fechaKey || !descansoFechas.has(fechaKey)) {
      return detalle;
    }

    const estadoTexto = typeof detalle.estado === 'string' ? detalle.estado.trim() : '';
    const estadoNormalizado = ESTADOS_ASISTENCIA.includes(estadoTexto) ? estadoTexto : '';

    if (estadoNormalizado && estadoNormalizado !== 'Presente' && estadoNormalizado !== 'Ausente') {
      return detalle;
    }

    const asistenciaTexto = typeof detalle.asistencia === 'string' ? detalle.asistencia.trim() : '';
    const justificadoValor =
      detalle.justificado === true || detalle.justificado === 1 || detalle.justificado === '1';
    const justificacionTexto = justificadoValor
      ? typeof detalle.justificacion === 'string'
        ? detalle.justificacion.trim()
        : detalle.justificacion !== undefined && detalle.justificacion !== null
          ? String(detalle.justificacion).trim()
          : ''
      : '';

    return {
      ...detalle,
      asistio: false,
      es_descanso: true,
      estado: 'Descanso',
      asistencia: 'Descanso',
      justificado: true,
      justificacion: justificacionTexto || 'Descanso programado',
    };
  });
};

const applyDiasDoblesAutoToDetalles = async ({
  detalles,
  periodo_inicio,
  periodo_fin,
  filtrar_por_asistencia = true,
}) => {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return detalles;
  }

  const diasDobles = await DiasDobles.getActiveInRange(periodo_inicio, periodo_fin);
  if (!Array.isArray(diasDobles) || diasDobles.length === 0) {
    return detalles;
  }

  const doblesMap = new Map(
    diasDobles
      .map((dia) => {
        if (!dia || !dia.fecha) return null;
        const fechaKey = normalizeFechaDiaDobleKey(dia.fecha);
        if (!fechaKey) return null;
        return [fechaKey, normalizeMultiplicador(dia.multiplicador)];
      })
      .filter(Boolean),
  );

  if (doblesMap.size === 0) {
    return detalles;
  }

  return detalles.map((detalle) => {
    if (!detalle || detalle.es_dia_doble || !detalle.fecha) {
      return detalle;
    }

    const fechaDetalleKey = normalizeFechaDiaDobleKey(detalle.fecha);
    if (!fechaDetalleKey) {
      return detalle;
    }

    const multiplicador = doblesMap.get(fechaDetalleKey);
    if (multiplicador === undefined) {
      return detalle;
    }

    const asistio = Boolean(detalle.asistio);

    const salarioBase = Number(detalle.salario_dia) || 0;
    const salarioCalculado = asistio
      ? Number((salarioBase * multiplicador).toFixed(2))
      : salarioBase;

    return {
      ...detalle,
      es_dia_doble: true,
      salario_dia: salarioCalculado,
      tipo: 'Día doble',
    };
  });
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

      const salarioDiaBase = Number(Number(detalle.salario_dia || 0).toFixed(2));
      const salarioDia = (() => {
        if (estadoNormalizado === 'Incapacidad') {
          return Number(Math.max(salarioDiaBase / 2, 0).toFixed(2));
        }
        return salarioDiaBase;
      })();

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
    .filter((detalle) => {
      const hasFecha = detalle.fecha !== null && detalle.fecha !== undefined && detalle.fecha !== '';
      const hasDiaSemana =
        detalle.dia_semana !== null && detalle.dia_semana !== undefined && detalle.dia_semana !== '';
      return hasFecha && hasDiaSemana;
    });
}

class Planilla {
  static async ensureSchema() {
    const pool = await poolPromise;
    return resolvePlanillaSchema(() => pool.request());
  }

  // 🔹 Obtener todas las planillas (admin)
  static async getAll(filters = {}) {
    try {
      const { periodo_inicio = null, periodo_fin = null } = filters || {};

      const periodoInicioDate = periodo_inicio ? new Date(periodo_inicio) : null;
      const periodoFinDate = periodo_fin ? new Date(periodo_fin) : null;

      const pool = await poolPromise;
      await resolvePlanillaSchema(() => pool.request());
      const request = pool.request();

      const conditions = [];

      if (periodoInicioDate && !Number.isNaN(periodoInicioDate.getTime())) {
        request.input('periodo_inicio', sql.Date, periodoInicioDate);
        conditions.push('pl.periodo_fin >= @periodo_inicio');
      }

      if (periodoFinDate && !Number.isNaN(periodoFinDate.getTime())) {
        request.input('periodo_fin', sql.Date, periodoFinDate);
        conditions.push('pl.periodo_inicio <= @periodo_fin');
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await request.query(`
          SELECT pl.*, e.nombre, e.apellido, e.salario_monto, e.tipo_pago AS tipo_pago_empleado
          FROM dbo.Planilla pl
          LEFT JOIN dbo.Empleados e ON pl.id_empleado = e.id_empleado
          ${whereClause}
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
      await resolvePlanillaSchema(() => pool.request());
      const result = await pool.request()
        .input('id_planilla', sql.Int, id_planilla)
        .query(`
          SELECT pl.*, e.nombre, e.apellido, e.salario_monto, e.tipo_pago AS tipo_pago_empleado,
                 e.email, e.cedula
          FROM dbo.Planilla pl
          LEFT JOIN dbo.Empleados e ON pl.id_empleado = e.id_empleado
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
      await resolvePlanillaSchema(() => pool.request());
      const result = await pool.request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT pl.*, e.nombre, e.apellido, e.tipo_pago AS tipo_pago_empleado
          FROM dbo.Planilla pl
          LEFT JOIN dbo.Empleados e ON pl.id_empleado = e.id_empleado
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
          FROM dbo.Planilla
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
          FROM dbo.Empleados
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

      let detallesFinales = detallesSanitizados;
      let detallesDoblesPresentes = detallesFinales.some((detalle) => detalle.es_dia_doble);

      if (
        detallesFinales.length > 0 &&
        !detallesDoblesPresentes &&
        diasDoblesValor === 0 &&
        montoDiasDoblesValor === null
      ) {
        detallesFinales = await applyDiasDoblesAutoToDetalles({
          detalles: detallesFinales,
          periodo_inicio,
          periodo_fin,
          filtrar_por_asistencia: esAutomatica,
        });
        detallesDoblesPresentes = detallesFinales.some((detalle) => detalle.es_dia_doble);
      }
      const descansoFechas =
        detallesFinales.length > 0
          ? await buildDescansoFechaSet(id_empleado, periodo_inicio, periodo_fin)
          : new Set();
      if (descansoFechas.size > 0) {
        detallesFinales = applyDescansoToDetalles(detallesFinales, descansoFechas);
      }
      const salarioDiaDobles =
        tipo_pago === 'Diario'
          ? salario_base
          : salario_base > 0 && diasReferenciaPago > 0
            ? salario_base / diasReferenciaPago
            : 0;
      const autoDiasDoblesInfo =
        !detallesDoblesPresentes && diasDoblesValor === 0 && montoDiasDoblesValor === null
          ? await buildDiasDoblesAuto({
              id_empleado,
              periodo_inicio,
              periodo_fin,
              salario_base,
              salario_dia_base: salarioDiaDobles,
              filtrar_por_asistencia: esAutomatica,
            })
          : null;

      let salarioBasePeriodo = salario_base;
      let deduccionDiasMonto = 0;

      if (detallesFinales.length > 0) {
        salarioBasePeriodo = detallesFinales.reduce((sum, detalle) => {
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
            const descansoDias = await countDescansoDays(id_empleado, periodo_inicio, periodo_fin);
            const diasAsistenciaNormalizados =
              Number.isFinite(diasAsistencia) && diasAsistencia > 0 ? diasAsistencia : 0;
            diasParaPago = diasAsistenciaNormalizados + descansoDias;
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
        let montoExtraDiasDobles = 0;

        if (tipo_pago === 'Quincenal' && diasTrabajadosCalculados !== null) {
          const diasTrabajadosNormalizados =
            Number.isFinite(diasTrabajadosCalculados) && diasTrabajadosCalculados >= 0
              ? diasTrabajadosCalculados
              : 0;
          const diasLibres = Math.max(diasReferenciaPago - diasTrabajadosNormalizados, 0);
          const diasDescansoReferencia = esAutomatica
            ? await countDescansoDays(id_empleado, periodo_inicio, periodo_fin)
            : DIAS_LIBRES_QUINCENA;
          const diasExtra = Math.max(diasDescansoReferencia - diasLibres, 0);
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

        if (montoDiasDoblesValor !== null) {
          montoExtraDiasDobles = Number(montoDiasDoblesValor.toFixed(2));
        } else if (diasDoblesValor > 0 && salarioDiarioEstimado > 0) {
          montoExtraDiasDobles = salarioDiarioEstimado * diasDoblesValor;
        } else if (autoDiasDoblesInfo && autoDiasDoblesInfo.montoExtra > 0) {
          montoExtraDiasDobles = autoDiasDoblesInfo.montoExtra;
        }

        if (!Number.isFinite(montoExtraDiasDobles) || montoExtraDiasDobles < 0) {
          montoExtraDiasDobles = 0;
        }

        if (montoExtraDiasDobles > 0) {
          salarioBasePeriodo = Number(
            (salarioBasePeriodo + Number(montoExtraDiasDobles.toFixed(2))).toFixed(2)
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
          INSERT INTO dbo.Planilla (${insertColumns.join(', ')})
          VALUES (${insertValues.join(', ')});
          SELECT SCOPE_IDENTITY() AS id_planilla;
        `);

        const planillaId = Number(result.recordset[0]?.id_planilla);

        if (!Number.isInteger(planillaId)) {
          throw new Error('No se pudo obtener el identificador de la planilla creada');
        }

        if (detallesFinales.length > 0) {
          await DetallePlanilla.createMany(transaction, planillaId, detallesFinales);
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
        return { ...result.recordset[0], detalles: detallesFinales };
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
           FROM dbo.Planilla
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
          FROM dbo.Empleados
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

      const diasDoblesValor = Number(dias_dobles) || 0;
      const montoDiasDoblesValor =
        monto_dias_dobles === null || monto_dias_dobles === undefined
          ? null
          : Number(monto_dias_dobles);

      let detallesFinales = detallesSanitizados;
      let detallesDoblesPresentes = detallesFinales.some((detalle) => detalle.es_dia_doble);

      if (
        detallesFinales.length > 0 &&
        !detallesDoblesPresentes &&
        diasDoblesValor === 0 &&
        montoDiasDoblesValor === null
      ) {
        detallesFinales = await applyDiasDoblesAutoToDetalles({
          detalles: detallesFinales,
          periodo_inicio,
          periodo_fin,
          filtrar_por_asistencia: esAutomatica,
        });
        detallesDoblesPresentes = detallesFinales.some((detalle) => detalle.es_dia_doble);
      }
      const descansoFechas =
        detallesFinales.length > 0
          ? await buildDescansoFechaSet(id_empleado, periodo_inicio, periodo_fin)
          : new Set();
      if (descansoFechas.size > 0) {
        detallesFinales = applyDescansoToDetalles(detallesFinales, descansoFechas);
      }
      const salarioDiaDobles =
        tipo_pago === 'Diario'
          ? salario_base
          : salario_base > 0 && diasReferenciaPago > 0
            ? salario_base / diasReferenciaPago
            : 0;
      const autoDiasDoblesInfo =
        !detallesDoblesPresentes && diasDoblesValor === 0 && montoDiasDoblesValor === null
          ? await buildDiasDoblesAuto({
              id_empleado,
              periodo_inicio,
              periodo_fin,
              salario_base,
              salario_dia_base: salarioDiaDobles,
              filtrar_por_asistencia: esAutomatica,
            })
          : null;

      const montoHorasExtras = Math.max(Number(horas_extras) || 0, 0);
      const bonificacionesNumber = Math.max(Number(bonificaciones) || 0, 0);
      const deduccionesBase = Math.max(Number(deducciones) || 0, 0);

      let salarioBasePeriodo = 0;
      let deduccionDiasMonto = 0;

      if (detallesFinales.length > 0) {
        salarioBasePeriodo = detallesFinales.reduce((sum, detalle) => {
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
            const descansoDias = await countDescansoDays(id_empleado, periodo_inicio, periodo_fin);
            const diasAsistenciaNormalizados =
              Number.isFinite(diasAsistencia) && diasAsistencia > 0 ? diasAsistencia : 0;
            diasParaPago = diasAsistenciaNormalizados + descansoDias;
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
        let montoExtraDiasDobles = 0;

        if (tipo_pago === 'Quincenal' && diasTrabajadosNormalizados !== null) {
          const diasLibres = Math.max(diasReferenciaPago - diasTrabajadosNormalizados, 0);
          const diasDescansoReferencia = esAutomatica
            ? await countDescansoDays(id_empleado, periodo_inicio, periodo_fin)
            : DIAS_LIBRES_QUINCENA;
          const diasExtra = Math.max(diasDescansoReferencia - diasLibres, 0);
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

        if (
          montoDiasDoblesValor !== null &&
          Number.isFinite(montoDiasDoblesValor) &&
          montoDiasDoblesValor >= 0
        ) {
          montoExtraDiasDobles = montoDiasDoblesValor;
        } else if (diasDoblesValor > 0 && salarioDiarioEstimado > 0) {
          montoExtraDiasDobles = salarioDiarioEstimado * diasDoblesValor;
        } else if (autoDiasDoblesInfo && autoDiasDoblesInfo.montoExtra > 0) {
          montoExtraDiasDobles = autoDiasDoblesInfo.montoExtra;
        }

        if (!Number.isFinite(montoExtraDiasDobles) || montoExtraDiasDobles < 0) {
          montoExtraDiasDobles = 0;
        }

        if (montoExtraDiasDobles > 0) {
          salarioBasePeriodo = Number(
            (salarioBasePeriodo + Number(montoExtraDiasDobles.toFixed(2))).toFixed(2)
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
          UPDATE dbo.Planilla
          SET ${updateAssignments.join(',\n                ')}
          WHERE id_planilla = @id_planilla
        `);

        await DetallePlanilla.deleteByPlanilla(transaction, id_planilla);

        if (detallesFinales.length > 0) {
          await DetallePlanilla.createMany(transaction, id_planilla, detallesFinales);
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
