const DescansoConfig = require('../models/DescansoConfig');
const DescansoDias = require('../models/DescansoDias');
const DescansoSemanal = require('../models/DescansoSemanal');
const { addDays, parseUtcDate, resolveDescansoDia } = require('../utils/descansoHelper');

const MS_POR_DIA = 1000 * 60 * 60 * 24;

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const formatDate = (date) => date.toISOString().slice(0, 10);

const resolveWeekType = (fecha, inicioVigencia, semanaTipoInicio = 'A') => {
  const diff = Math.floor((fecha.getTime() - inicioVigencia.getTime()) / MS_POR_DIA);
  const weekIndex = Math.floor(diff / 7);
  const isEvenWeek = weekIndex % 2 === 0;

  if (semanaTipoInicio === 'B') {
    return isEvenWeek ? 'B' : 'A';
  }

  return isEvenWeek ? 'A' : 'B';
};

const buildWeekTypeResolver = (rows = []) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const anchor = rows.reduce((result, row) => {
    if (!result || row.fecha_inicio_vigencia < result) {
      return row.fecha_inicio_vigencia;
    }
    return result;
  }, null);

  const anchorRow = rows
    .filter((row) => row.fecha_inicio_vigencia.getTime() === anchor.getTime())
    .sort((a, b) => (a.semana_tipo < b.semana_tipo ? -1 : 1))[0];

  const anchorType = anchorRow ? anchorRow.semana_tipo : 'A';

  return (fecha) => resolveWeekType(fecha, anchor, anchorType);
};

const normalizeScheduleRows = (rows) => {
  const normalized = rows
    .map((row) => {
      const inicio = parseDate(row.fecha_inicio_vigencia);
      if (!inicio) {
        return null;
      }
      const fin = parseDate(row.fecha_fin_vigencia);
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

  const primerDescansoA = normalized
    .filter((row) => row.semana_tipo === 'A')
    .reduce((min, row) => {
      if (!min) return row.fecha_inicio_vigencia;
      return min < row.fecha_inicio_vigencia ? min : row.fecha_inicio_vigencia;
    }, null);

  if (!primerDescansoA) {
    return normalized;
  }

  return normalized
    .map((row) => {
      if (row.semana_tipo !== 'B') return row;

      const inicioEsperado = addDays(primerDescansoA, 7);
      if (row.fecha_inicio_vigencia > primerDescansoA) {
        return row;
      }

      if (row.fecha_fin_vigencia && row.fecha_fin_vigencia < inicioEsperado) {
        return null;
      }

      return {
        ...row,
        fecha_inicio_vigencia: inicioEsperado,
      };
    })
    .filter(Boolean);
};

const buildFechasDescanso = ({ rows, inicio, fin }) => {
  const fechasSet = new Set();
  let cursor = new Date(inicio.getTime());

  const resolveWeekTypeFromAnchor = buildWeekTypeResolver(rows);
  if (!resolveWeekTypeFromAnchor) {
    return [];
  }

  while (cursor <= fin) {
    const diaSemana = cursor.getUTCDay();

    rows.forEach((row) => {
      if (row.dia_semana !== diaSemana) return;
      if (cursor < row.fecha_inicio_vigencia) return;
      if (row.fecha_fin_vigencia && cursor > row.fecha_fin_vigencia) return;

      const weekType = resolveWeekTypeFromAnchor(cursor);
      if (weekType !== row.semana_tipo) return;
      fechasSet.add(formatDate(cursor));
    });

    cursor = addDays(cursor, 1);
  }

  return Array.from(fechasSet);
};

const buildFechasDescansoFromConfig = async ({ id_empleado, inicio, fin }) => {
  const fechas = [];
  let cursor = new Date(inicio.getTime());
  let configAplicada = false;

  while (cursor <= fin) {
    const { es_descanso, config_aplicada } = await resolveDescansoDia(id_empleado, cursor);
    if (config_aplicada) {
      configAplicada = true;
    }
    if (es_descanso) {
      fechas.push(formatDate(cursor));
    }
    cursor = addDays(cursor, 1);
  }

  return { fechas, configAplicada };
};

const getDescansosSummary = async (req, res) => {
  try {
    const { id_empleado, periodo_inicio, periodo_fin } = req.query;

    if (!id_empleado || !periodo_inicio || !periodo_fin) {
      return res.status(400).json({
        error: 'id_empleado, periodo_inicio y periodo_fin son requeridos.',
      });
    }

    const inicio = parseUtcDate(periodo_inicio) || parseDate(periodo_inicio);
    const fin = parseUtcDate(periodo_fin) || parseDate(periodo_fin);

    if (!inicio || !fin || fin < inicio) {
      return res.status(400).json({
        error: 'El rango de fechas es inválido.',
      });
    }

    const { fechas: fechasConfig, configAplicada } = await buildFechasDescansoFromConfig({
      id_empleado: Number(id_empleado),
      inicio,
      fin,
    });

    if (configAplicada) {
      return res.json({ fechas: fechasConfig, total: fechasConfig.length });
    }

    const rows = await DescansoSemanal.getByEmpleadoInRange(
      Number(id_empleado),
      periodo_inicio,
      periodo_fin,
    );

    const normalizedRows = normalizeScheduleRows(rows);
    const fechas = buildFechasDescanso({ rows: normalizedRows, inicio, fin });

    return res.json({ fechas, total: fechas.length });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No fue posible obtener los descansos.' });
  }
};

const getDescansosByEmpleado = async (req, res) => {
  try {
    const idEmpleado = Number(req.params.id);
    if (!Number.isInteger(idEmpleado) || idEmpleado <= 0) {
      return res.status(400).json({ error: 'ID de empleado inválido.' });
    }

    if (req.user?.id_rol !== 1) {
      const empleadoId = Number(req.user?.id_empleado);
      if (!empleadoId || empleadoId !== idEmpleado) {
        return res.status(403).json({ error: 'No tienes permisos para ver estos descansos.' });
      }
    }

    const descansos = await DescansoSemanal.getByEmpleado(idEmpleado);
    const descansoConfig = await DescansoConfig.getLatestByEmpleado(idEmpleado);
    const descansoDias = descansoConfig?.id_config
      ? await DescansoDias.getByConfig(descansoConfig.id_config)
      : [];

    return res.json({
      descansos,
      descanso_config: descansoConfig,
      descanso_dias: descansoDias,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'No fue posible obtener los descansos.' });
  }
};

module.exports = {
  getDescansosSummary,
  getDescansosByEmpleado,
};
