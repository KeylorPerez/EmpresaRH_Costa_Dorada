const { addDays } = require('./descansoHelper');

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

module.exports = {
  buildFechasDescanso,
  formatDate,
  normalizeScheduleRows,
  parseDate,
};
