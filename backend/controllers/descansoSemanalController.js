const DescansoConfig = require('../models/DescansoConfig');
const DescansoDias = require('../models/DescansoDias');
const DescansoSemanal = require('../models/DescansoSemanal');
const { addDays, buildDescansoResolver, parseUtcDate } = require('../utils/descansoHelper');
const {
  buildFechasDescanso,
  formatDate,
  normalizeScheduleRows,
  parseDate,
} = require('../utils/descansoSemanalHelper');

const buildFechasDescansoFromConfig = async ({ id_empleado, inicio, fin }) => {
  const resolveDescanso = await buildDescansoResolver(id_empleado, inicio, fin);
  if (!resolveDescanso) {
    return { fechas: [], configAplicada: false };
  }

  const fechas = [];
  let cursor = new Date(inicio.getTime());
  let configAplicada = false;

  while (cursor <= fin) {
    const { es_descanso, config_aplicada } = resolveDescanso(cursor);
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
