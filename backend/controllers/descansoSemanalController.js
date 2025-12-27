const DescansoSemanal = require('../models/DescansoSemanal');

const MS_POR_DIA = 1000 * 60 * 60 * 24;

const parseDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const formatDate = (date) => date.toISOString().slice(0, 10);

const addDays = (date, days) => new Date(date.getTime() + days * MS_POR_DIA);

const resolveWeekType = (fecha, inicioVigencia) => {
  const diff = Math.floor((fecha.getTime() - inicioVigencia.getTime()) / MS_POR_DIA);
  const weekIndex = Math.floor(diff / 7);
  return weekIndex % 2 === 0 ? 'A' : 'B';
};

const normalizeScheduleRows = (rows) =>
  rows
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

const buildFechasDescanso = ({ rows, inicio, fin }) => {
  const fechasSet = new Set();
  let cursor = new Date(inicio.getTime());

  while (cursor <= fin) {
    const diaSemana = cursor.getUTCDay();

    rows.forEach((row) => {
      if (row.dia_semana !== diaSemana) return;
      if (cursor < row.fecha_inicio_vigencia) return;
      if (row.fecha_fin_vigencia && cursor > row.fecha_fin_vigencia) return;

      const weekType = resolveWeekType(cursor, row.fecha_inicio_vigencia);
      if (weekType !== row.semana_tipo) return;
      fechasSet.add(formatDate(cursor));
    });

    cursor = addDays(cursor, 1);
  }

  return Array.from(fechasSet);
};

const getDescansosSummary = async (req, res) => {
  try {
    const { id_empleado, periodo_inicio, periodo_fin } = req.query;

    if (!id_empleado || !periodo_inicio || !periodo_fin) {
      return res.status(400).json({
        error: 'id_empleado, periodo_inicio y periodo_fin son requeridos.',
      });
    }

    const inicio = parseDate(periodo_inicio);
    const fin = parseDate(periodo_fin);

    if (!inicio || !fin || fin < inicio) {
      return res.status(400).json({
        error: 'El rango de fechas es inválido.',
      });
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

module.exports = {
  getDescansosSummary,
};
