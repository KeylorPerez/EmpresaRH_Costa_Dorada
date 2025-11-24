/**
 * Controlador de asistencia. Gestiona las marcas de entrada y salida,
 * la generación de reportes y la validación de horas trabajadas por empleado.
 */
const fs = require('fs');
const path = require('path');
const Asistencia = require('../models/Asistencia');
const Usuario = require('../models/Usuario'); // para resolver id_empleado del usuario
const Empleado = require('../models/Empleado');
const JustificacionAsistencia = require('../models/JustificacionAsistencia');
const allowedTypes = ['entrada', 'salida', 'almuerzo_inicio', 'almuerzo_fin'];
const allowedStates = ['Presente', 'Ausente', 'Permiso', 'Vacaciones', 'Incapacidad'];
const allowedJustificationTypes = JustificacionAsistencia.getAllowedTypes();
const allowedJustificationStates = JustificacionAsistencia.getAllowedStates();

const { promises: fsPromises } = fs;
const EXPORTS_DIR = path.join(__dirname, '..', 'exports');
const tipoMarcaLabels = {
  entrada: 'Entrada',
  salida: 'Salida',
  almuerzo_inicio: 'Inicio almuerzo',
  almuerzo_fin: 'Fin almuerzo',
};

const parseEnvFloat = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const geofenceLatitude = parseEnvFloat(process.env.OFFICE_LATITUDE);
const geofenceLongitude = parseEnvFloat(process.env.OFFICE_LONGITUDE);
const geofenceRadius = parseEnvFloat(process.env.OFFICE_RADIUS_METERS || process.env.OFFICE_RADIUS_MTS || 0);
// Para evitar rechazos innecesarios cuando el GPS reporta pequeñas variaciones,
// se usa una tolerancia adicional configurable. Se incrementa el valor por
// defecto (50 m) para cubrir imprecisiones habituales en dispositivos móviles.
const geofenceTolerance = Math.max(
  0,
  parseEnvFloat(process.env.OFFICE_RADIUS_TOLERANCE_METERS || process.env.OFFICE_RADIUS_TOLERANCE || 50) || 0
);

const geofenceConfigured =
  Number.isFinite(geofenceLatitude) &&
  Number.isFinite(geofenceLongitude) &&
  Number.isFinite(geofenceRadius) &&
  geofenceRadius > 0;

const effectiveGeofenceRadius = geofenceConfigured ? geofenceRadius + geofenceTolerance : null;

const toRadians = (value) => (value * Math.PI) / 180;

const calculateDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const earthRadius = 6371000; // metros
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const parseCoordinate = (value) => {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const isTruthy = (value) => value === true || value === 1 || value === '1';

const normalizeSolicitud = (solicitud) => {
  if (!solicitud) return null;
  return {
    id_solicitud: solicitud.id_solicitud,
    id_asistencia: solicitud.id_asistencia,
    id_empleado: solicitud.id_empleado,
    tipo: solicitud.tipo,
    descripcion: solicitud.descripcion,
    estado: solicitud.estado,
    respuesta: solicitud.respuesta,
    created_at: solicitud.created_at ? solicitud.created_at.toISOString() : null,
    updated_at: solicitud.updated_at ? solicitud.updated_at.toISOString() : null,
  };
};

const ensureExportsDir = async () => {
  if (!fs.existsSync(EXPORTS_DIR)) {
    await fsPromises.mkdir(EXPORTS_DIR, { recursive: true });
  }
};

const formatDateValue = (value) => {
  if (!value) return '-';
  if (value instanceof Date) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toISOString().slice(0, 10);
};

const formatDateDisplay = (value) => {
  const iso = formatDateValue(value);
  if (!iso || iso === '-') return '-';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

const formatTimeDisplay = (value) => {
  if (!value) return '--:--';
  if (value instanceof Date) {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
  if (typeof value === 'string') {
    const [hours = '00', minutes = '00'] = value.split(':');
    return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
  }
  return '--:--';
};

const formatLocationDisplay = (latitud, longitud) => {
  if (latitud === undefined || latitud === null || longitud === undefined || longitud === null) {
    return '-';
  }

  const lat = Number(latitud);
  const lon = Number(longitud);
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
  }

  const latString = latitud?.toString().trim();
  const lonString = longitud?.toString().trim();
  if (!latString && !lonString) return '-';
  if (latString && lonString) return `${latString}, ${lonString}`;
  return latString || lonString || '-';
};

const sanitizePdfText = (text = '') =>
  String(text)
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\u2007/g, ' ')
    .replace(/\s+/g, ' ');

const stripDiacritics = (text = '') => {
  if (!text) return '';
  if (typeof text.normalize !== 'function') return String(text);
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const PDF_SPECIAL_CHAR_MAP = {
  '₡': 'CRC ',
  '€': 'EUR ',
  '£': 'GBP ',
  '¥': 'JPY ',
  '₩': 'KRW ',
  '₦': 'NGN ',
  '₱': 'PHP ',
  '₭': 'LAK ',
  '₮': 'MNT ',
  '₨': 'INR ',
  '₹': 'INR ',
  '₴': 'UAH ',
  '₲': 'PYG ',
  '₵': 'GHS ',
  '₽': 'RUB ',
  '฿': 'THB ',
  '₸': 'KZT ',
  '–': '-',
  '—': '-',
  '‒': '-',
  '―': '-',
  '…': '...',
  '•': '*',
  '“': '"',
  '”': '"',
  '„': '"',
  '’': "'",
  '‘': "'",
  '‚': "'",
  '‹': "'",
  '›': "'",
};

const encodeCharForPdf = (char) => {
  if (Object.prototype.hasOwnProperty.call(PDF_SPECIAL_CHAR_MAP, char)) {
    return PDF_SPECIAL_CHAR_MAP[char];
  }

  const code = char.codePointAt(0);
  if (code !== undefined && code <= 0xff) {
    return String.fromCharCode(code);
  }

  const stripped = stripDiacritics(char);
  if (stripped && stripped !== char) {
    return Array.from(stripped)
      .map((nestedChar) => encodeCharForPdf(nestedChar))
      .join('');
  }

  return '?';
};

const normalizePdfEncoding = (text = '') =>
  Array.from(String(text || ''))
    .map((char) => encodeCharForPdf(char))
    .join('');

const escapePdfText = (text = '') =>
  normalizePdfEncoding(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

const wrapText = (text, maxLength = 80) => {
  if (!text) return [''];
  const words = sanitizePdfText(text).split(/\s+/);
  const lines = [];
  let currentLine = '';

  words.forEach((word) => {
    const tentative = currentLine ? `${currentLine} ${word}` : word;
    if (tentative.length > maxLength) {
      if (currentLine) {
        lines.push(currentLine);
      }
      if (word.length > maxLength) {
        let remaining = word;
        while (remaining.length > maxLength) {
          lines.push(remaining.slice(0, maxLength));
          remaining = remaining.slice(maxLength);
        }
        currentLine = remaining;
      } else {
        currentLine = word;
      }
    } else {
      currentLine = tentative;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
};

const chunkArray = (items, size) => {
  if (!Array.isArray(items) || items.length === 0) {
    return [[]];
  }

  const result = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
};

const buildPdfContentStream = (lines) => {
  const safeLines = lines.length > 0 ? lines : [''];
  const instructions = ['BT', '/F1 11 Tf', '50 780 Td'];
  instructions.push(`(${escapePdfText(safeLines[0])}) Tj`);
  for (let i = 1; i < safeLines.length; i += 1) {
    instructions.push('0 -14 Td');
    instructions.push(`(${escapePdfText(safeLines[i])}) Tj`);
  }
  instructions.push('ET');
  return instructions.join('\n');
};

const buildPdfBuffer = (pagesContent) => {
  const contentStreams = pagesContent.length > 0 ? pagesContent : ['BT\n/F1 11 Tf\n50 780 Td\n() Tj\nET'];
  const objects = [];

  const addObject = (value) => {
    objects.push(value);
    return objects.length;
  };

  const catalogId = addObject(null);
  const pagesId = addObject(null);
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');

  const pageIds = contentStreams.map((streamContent) => {
    const contentId = addObject({ stream: streamContent });
    const pageIndex = addObject({ contentId });
    return { pageIndex, contentId };
  });

  const kids = pageIds.map(({ pageIndex }) => `${pageIndex} 0 R`).join(' ');
  objects[pagesId - 1] = `<< /Type /Pages /Kids [${kids}] /Count ${pageIds.length} >>`;
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  pageIds.forEach(({ pageIndex, contentId }) => {
    objects[pageIndex - 1] = `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`;
  });

  const buffers = [];
  const header = '%PDF-1.4\n';
  buffers.push(Buffer.from(header, 'utf8'));
  let offset = header.length;
  const xrefPositions = [0];

  objects.forEach((obj, index) => {
    xrefPositions.push(offset);
    const objectId = index + 1;
    const objectHeader = `${objectId} 0 obj\n`;
    let bodyBuffer;
    if (obj && typeof obj === 'object' && obj.stream !== undefined) {
      const streamString = typeof obj.stream === 'string' ? obj.stream : obj.stream.toString();
      const normalizedStream = normalizePdfEncoding(streamString);
      const streamBuffer = Buffer.from(normalizedStream, 'latin1');
      const preamble = Buffer.from(`<< /Length ${streamBuffer.length} >>\nstream\n`, 'ascii');
      const postamble = Buffer.from('\nendstream\n', 'ascii');
      bodyBuffer = Buffer.concat([preamble, streamBuffer, postamble]);
    } else {
      const body = `${obj || ''}\n`;
      bodyBuffer = Buffer.from(body, 'utf8');
    }
    const objectBuffer = Buffer.concat([
      Buffer.from(objectHeader, 'utf8'),
      bodyBuffer,
      Buffer.from('endobj\n', 'utf8'),
    ]);
    buffers.push(objectBuffer);
    offset += objectBuffer.length;
  });

  const xrefStart = offset;
  const xrefHeader = `xref\n0 ${objects.length + 1}\n`;
  const xrefLines = ['0000000000 65535 f \n'];
  for (let i = 1; i < xrefPositions.length; i += 1) {
    xrefLines.push(`${xrefPositions[i].toString().padStart(10, '0')} 00000 n \n`);
  }
  const xrefBuffer = Buffer.from(xrefHeader + xrefLines.join(''), 'utf8');
  buffers.push(xrefBuffer);
  offset += xrefBuffer.length;

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  buffers.push(Buffer.from(trailer, 'utf8'));

  return Buffer.concat(buffers);
};

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[";\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const CSV_BOM = Buffer.from([0xef, 0xbb, 0xbf]).toString('utf8');

const sanitizeCsvLine = (value = '') =>
  String(value)
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\u2007/g, ' ')
    .replace(/[\u2028\u2029]/g, ' ');

const buildAttendancePdfLines = (rows, { start, end, empleado }) => {
  const lines = [];
  const divider = '-'.repeat(140);
  const titleDivider = '='.repeat(140);
  const totalMarcas = Array.isArray(rows) ? rows.length : 0;
  const nombreEmpleado = empleado
    ? [empleado.nombre, empleado.apellido].filter(Boolean).join(' ').trim() || `ID ${empleado.id_empleado}`
    : null;

  lines.push(titleDivider);
  lines.push('Reporte de asistencia - EmpresaRH');
  lines.push(titleDivider);
  lines.push('');
  lines.push(`Periodo: ${formatDateDisplay(start)} al ${formatDateDisplay(end)}`);
  if (nombreEmpleado) {
    lines.push(`Empleado: ${sanitizePdfText(nombreEmpleado)} (ID ${empleado.id_empleado})`);
  }
  lines.push(`Total de marcas: ${totalMarcas}`);
  lines.push('');
  const headerColumns = [
    'Fecha'.padEnd(12, ' '),
    'Hora'.padEnd(8, ' '),
    'Tipo'.padEnd(18, ' '),
    'Estado'.padEnd(12, ' '),
    'Justificado'.padEnd(12, ' '),
    'Ubicación'.padEnd(22, ' '),
    'Observaciones / Justificación',
  ];
  lines.push(headerColumns.join(' '));
  lines.push(divider);

  if (!totalMarcas) {
    lines.push('Sin registros en el periodo seleccionado.');
    return lines;
  }

  rows.forEach((registro) => {
    const fecha = formatDateDisplay(registro.fecha).padEnd(12, ' ');
    const hora = formatTimeDisplay(registro.hora).padEnd(8, ' ');
    const tipo = (tipoMarcaLabels[registro.tipo_marca] || registro.tipo_marca || '-')
      .toString()
      .padEnd(18, ' ');
    const estado = (registro.estado || 'Presente').toString().padEnd(12, ' ');
    const justificado = (registro.justificado ? 'Sí' : 'No').padEnd(12, ' ');
    const ubicacion = formatLocationDisplay(registro.latitud, registro.longitud).padEnd(22, ' ');
    const observaciones = registro.observaciones ? sanitizePdfText(registro.observaciones) : '';
    const justificacionTexto = registro.justificacion ? sanitizePdfText(registro.justificacion) : '';
    const detalle = [observaciones, justificacionTexto].filter((text) => text && text.length > 0).join(' | ');
    const observationLines = wrapText(detalle || '-', 50);

    observationLines.forEach((linea, index) => {
      if (index === 0) {
        lines.push(`${fecha} ${hora} ${tipo} ${estado} ${justificado} ${ubicacion} ${linea}`);
      } else {
        lines.push(
          `${' '.repeat(12)} ${' '.repeat(8)} ${' '.repeat(18)} ${' '.repeat(12)} ${' '.repeat(12)} ${' '.repeat(22)} ${linea}`,
        );
      }
    });
  });

  return lines;
};

const createAttendancePdf = async (filePath, rows, meta) => {
  const lines = buildAttendancePdfLines(rows, meta);
  const pages = chunkArray(lines, 40).map((pageLines) => buildPdfContentStream(pageLines));
  const pdfBuffer = buildPdfBuffer(pages);
  await fsPromises.writeFile(filePath, pdfBuffer);
};

const createAttendanceCsv = async (filePath, rows, meta) => {
  const { start, end, empleado } = meta;
  const nombreEmpleado = empleado
    ? [empleado.nombre, empleado.apellido].filter(Boolean).join(' ').trim() || `ID ${empleado.id_empleado}`
    : 'Todos';

  const lines = [];
  lines.push('Reporte de asistencia');
  lines.push(`Periodo;${escapeCsv(formatDateDisplay(start))};${escapeCsv(formatDateDisplay(end))}`);
  lines.push(`Empleado;${escapeCsv(nombreEmpleado)}`);
  lines.push(`Total marcas;${Array.isArray(rows) ? rows.length : 0}`);
  lines.push('');
  lines.push('Fecha;Hora;Tipo;Estado;Justificado;Justificación;Ubicación;Observaciones');

  if (Array.isArray(rows) && rows.length > 0) {
    rows.forEach((registro) => {
      const row = [
        formatDateDisplay(registro.fecha),
        formatTimeDisplay(registro.hora),
        tipoMarcaLabels[registro.tipo_marca] || registro.tipo_marca || '-',
        escapeCsv(registro.estado || 'Presente'),
        escapeCsv(registro.justificado ? 'Sí' : 'No'),
        escapeCsv(registro.justificacion || ''),
        escapeCsv(formatLocationDisplay(registro.latitud, registro.longitud)),
        escapeCsv(registro.observaciones || ''),
      ].join(';');
      lines.push(row);
    });
  } else {
    lines.push('Sin registros;;;;;;;');
  }

  const sanitizedLines = lines.map((line) => sanitizeCsvLine(line));
  const content = `${CSV_BOM}${sanitizedLines.join('\r\n')}\r\n`;
  await fsPromises.writeFile(filePath, content, 'utf8');
};

// helpers para fecha/hora
function formatDateToSql(dateInput) {
  const ensureDate = (value) => {
    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) return null;

      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
      }

      if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
        const [day, month, year] = trimmed.split('/');
        return `${year}-${month}-${day}`;
      }

      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }

      throw new Error('Formato de fecha inválido');
    }

    return null;
  };

  if (!dateInput) {
    const now = new Date();
    return formatDateToSql(now);
  }

  if (typeof dateInput === 'string') {
    const normalized = ensureDate(dateInput);
    if (typeof normalized === 'string') {
      return normalized;
    }
    if (normalized instanceof Date) {
      return formatDateToSql(normalized);
    }
    if (normalized === null) {
      const now = new Date();
      return formatDateToSql(now);
    }
    throw new Error('Formato de fecha inválido');
  }

  if (dateInput instanceof Date) {
    const yyyy = dateInput.getUTCFullYear();
    const mm = String(dateInput.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(dateInput.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  throw new Error('Formato de fecha inválido');
}

function parseTimeForSqlServer(timeInput) {
  if (!timeInput) return null;

  const buildFromParts = (hours, minutes, seconds) => {
    const h = String(Number(hours) || 0).padStart(2, '0');
    const m = String(Number(minutes) || 0).padStart(2, '0');
    const s = String(Number(seconds) || 0).padStart(2, '0');
    return `${h}:${m}:${s}.000`;
  };

  if (timeInput instanceof Date) {
    return buildFromParts(timeInput.getHours(), timeInput.getMinutes(), timeInput.getSeconds());
  }

  if (typeof timeInput === 'string') {
    const trimmed = timeInput.trim();
    if (!trimmed) return null;

    const [h = '0', m = '0', rest = '0'] = trimmed.split(':');
    const s = rest.includes('.') ? rest.split('.')[0] : rest;
    return buildFromParts(h, m, s);
  }

  throw new Error('Formato de hora inválido');
}

// GET /api/asistencia
const getAsistencia = async (req, res) => {
  try {
    const userToken = req.user;
    if (userToken.id_rol === 1) {
      const rows = await Asistencia.getAll();
      return res.json(rows);
    } else {
      const user = await Usuario.getById(userToken.id_usuario);
      if (!user || !user.id_empleado) return res.status(400).json({ error: 'Usuario no vinculado a empleado' });
      const rows = await Asistencia.getByEmpleado(user.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/asistencia/range?start=YYYY-MM-DD&end=YYYY-MM-DD&id_empleado?
const getByRange = async (req, res) => {
  try {
    const { start, end, id_empleado: idEmpleadoParam } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start y end son requeridos (YYYY-MM-DD)' });

    let idEmpleadoFiltro = null;
    if (idEmpleadoParam !== undefined && idEmpleadoParam !== null && idEmpleadoParam !== '') {
      const parsed = Number(idEmpleadoParam);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'id_empleado debe ser un número entero positivo' });
      }
      idEmpleadoFiltro = parsed;
    }

    const userToken = req.user;
    if (userToken.id_rol === 1) {
      const rows = await Asistencia.getByDateRange(start, end, idEmpleadoFiltro || undefined);
      return res.json(rows);
    } else {
      const user = await Usuario.getById(userToken.id_usuario);
      if (!user || !user.id_empleado) return res.status(400).json({ error: 'Usuario no vinculado a empleado' });
      const rows = await Asistencia.getByDateRange(start, end, user.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/asistencia
// body: { id_empleado? , tipo_marca, fecha? , hora? , observaciones? }
const createMarca = async (req, res) => {
  try {
    const {
      id_empleado: idEmpleadoBody,
      tipo_marca,
      fecha: fechaBody,
      hora: horaBody,
      observaciones,
      estado: estadoBody,
      justificado: justificadoBody,
      justificacion,
      latitud: latitudBody,
      longitud: longitudBody,
    } = req.body;
    const userToken = req.user;

    if (!tipo_marca || !allowedTypes.includes(tipo_marca)) {
      return res.status(400).json({ error: `tipo_marca inválido. Debe ser uno de: ${allowedTypes.join(', ')}` });
    }

    const usuario = await Usuario.getById(userToken.id_usuario);
    const actorEmpleadoId = usuario ? usuario.id_empleado : null;

    let id_empleado_final = idEmpleadoBody || actorEmpleadoId;
    if (!id_empleado_final) return res.status(400).json({ error: 'id_empleado requerido (o vincular usuario a empleado)' });

    if (idEmpleadoBody && userToken.id_rol !== 1 && idEmpleadoBody !== actorEmpleadoId) {
      return res.status(403).json({ error: 'No autorizado para marcar asistencia de otro empleado' });
    }

    const now = new Date();
    const fecha = fechaBody ? new Date(fechaBody) : now;
    const fechaSql = formatDateToSql(fecha);
    const hora = horaBody
      ? parseTimeForSqlServer(horaBody)
      : parseTimeForSqlServer(now);

    const empleado = await Empleado.getById(id_empleado_final);
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado o inactivo' });
    }

    const latitud = parseCoordinate(latitudBody);
    const longitud = parseCoordinate(longitudBody);
    const requiereUbicacion = userToken.id_rol !== 1;

    if (requiereUbicacion && (latitud === null || longitud === null)) {
      return res.status(400).json({ error: 'No se pudo obtener la ubicación para registrar la marca' });
    }

    if (geofenceConfigured && latitud !== null && longitud !== null) {
      const distancia = calculateDistanceMeters(latitud, longitud, geofenceLatitude, geofenceLongitude);
      const permitirFuera = isTruthy(empleado.permitir_marcacion_fuera);
      if (!permitirFuera && userToken.id_rol !== 1 && distancia > effectiveGeofenceRadius) {
        return res.status(403).json({ error: 'La ubicación se encuentra fuera del rango permitido para este colaborador' });
      }
    }

    let estadoFinal = 'Presente';
    if (estadoBody !== undefined && estadoBody !== null && estadoBody !== '') {
      const estadoTrimmed = estadoBody.toString().trim();
      if (!allowedStates.includes(estadoTrimmed)) {
        return res.status(400).json({
          error: `estado inválido. Debe ser uno de: ${allowedStates.join(', ')}`,
        });
      }
      estadoFinal = estadoTrimmed;
    }

    let justificadoFinal = false;
    if (justificadoBody !== undefined && justificadoBody !== null) {
      justificadoFinal = isTruthy(justificadoBody);
    }

    let justificacionTexto = '';
    if (justificadoFinal) {
      if (justificacion !== undefined && justificacion !== null) {
        justificacionTexto = justificacion.toString().trim();
      }
    } else {
      justificacionTexto = '';
    }

    if (userToken.id_rol !== 1) {
      estadoFinal = 'Presente';
      justificadoFinal = false;
      justificacionTexto = '';
    }

    const existingMarca = await Asistencia.findByEmpleadoFechaTipo(id_empleado_final, fechaSql, tipo_marca);
    if (existingMarca) {
      return res.status(409).json({ error: 'Esta marca ya fue registrada para la fecha seleccionada' });
    }

    const created = await Asistencia.create({
      id_empleado: id_empleado_final,
      fecha: fechaSql,
      hora: hora,
      tipo_marca,
      observaciones,
      latitud,
      longitud,
      estado: estadoFinal,
      justificado: justificadoFinal,
      justificacion: justificacionTexto,
    });

    return res.status(201).json({ message: 'Marca registrada', id_asistencia: created.id_asistencia });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/asistencia/:id
const updateMarca = async (req, res) => {
  try {
    const id_asistencia = parseInt(req.params.id, 10);
    const {
      tipo_marca,
      observaciones,
      estado: estadoBody,
      justificado: justificadoBody,
      justificacion,
    } = req.body;

    if (!tipo_marca || !allowedTypes.includes(tipo_marca)) {
      return res.status(400).json({ error: `tipo_marca inválido. Debe ser uno de: ${allowedTypes.join(', ')}` });
    }

    let estadoFinal = null;
    if (estadoBody !== undefined) {
      if (estadoBody === null || estadoBody === '') {
        return res.status(400).json({ error: 'estado es requerido' });
      }
      const estadoTrimmed = estadoBody.toString().trim();
      if (!allowedStates.includes(estadoTrimmed)) {
        return res.status(400).json({
          error: `estado inválido. Debe ser uno de: ${allowedStates.join(', ')}`,
        });
      }
      estadoFinal = estadoTrimmed;
    }

    let justificadoFinal = null;
    if (justificadoBody !== undefined && justificadoBody !== null) {
      justificadoFinal = isTruthy(justificadoBody);
    }

    let justificacionTexto;
    if (justificadoBody !== undefined) {
      if (justificadoFinal) {
        justificacionTexto = justificacion !== undefined && justificacion !== null ? justificacion.toString().trim() : '';
      } else {
        justificacionTexto = '';
      }
    } else if (justificacion !== undefined && justificacion !== null) {
      justificacionTexto = justificacion.toString().trim();
    }

    const payload = { tipo_marca, observaciones };
    if (estadoBody !== undefined) {
      payload.estado = estadoFinal;
    }
    if (justificadoBody !== undefined) {
      payload.justificado = justificadoFinal;
      payload.justificacion = justificacionTexto;
    } else if (justificacionTexto !== undefined) {
      payload.justificacion = justificacionTexto;
    }

    await Asistencia.update(id_asistencia, payload);
    res.json({ message: 'Marca actualizada' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const exportAsistencia = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo admin puede exportar asistencia' });
    }

    const { start, end, id_empleado: idEmpleadoParam, format: formatParam = 'pdf' } = req.query;
    if (!start || !end) {
      return res.status(400).json({ error: 'Debes proporcionar start y end en formato YYYY-MM-DD' });
    }

    let idEmpleadoFiltro = null;
    if (idEmpleadoParam !== undefined && idEmpleadoParam !== null && idEmpleadoParam !== '') {
      const parsed = Number(idEmpleadoParam);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'id_empleado debe ser un número entero positivo' });
      }
      idEmpleadoFiltro = parsed;
    }

    const formatMap = new Map([
      ['pdf', 'pdf'],
      ['excel', 'excel'],
      ['xls', 'excel'],
      ['xlsx', 'excel'],
      ['csv', 'excel'],
    ]);
    const normalizedFormat = formatMap.get((formatParam || '').toString().toLowerCase());
    if (!normalizedFormat) {
      return res.status(400).json({ error: 'Formato de exportación no soportado' });
    }

    let empleado = null;
    if (idEmpleadoFiltro) {
      empleado = await Empleado.getById(idEmpleadoFiltro);
      if (!empleado) {
        return res.status(404).json({ error: 'Empleado no encontrado' });
      }
    }

    const rows = await Asistencia.getByDateRange(start, end, idEmpleadoFiltro || undefined);

    await ensureExportsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const parts = ['asistencia', start, end];
    if (idEmpleadoFiltro) {
      parts.push(`empleado-${idEmpleadoFiltro}`);
    }
    const extension = normalizedFormat === 'pdf' ? 'pdf' : 'csv';
    const filename = `${parts.join('-')}-${timestamp}.${extension}`;
    const filePath = path.join(EXPORTS_DIR, filename);

    if (normalizedFormat === 'pdf') {
      await createAttendancePdf(filePath, rows, { start, end, empleado });
    } else {
      await createAttendanceCsv(filePath, rows, { start, end, empleado });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/files/${filename}`;

    return res.json({ url: publicUrl, filename, format: normalizedFormat });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const createJustificacionSolicitud = async (req, res) => {
  try {
    const id_asistencia = Number(req.params.id);
    if (!Number.isInteger(id_asistencia) || id_asistencia <= 0) {
      return res.status(400).json({ error: 'id_asistencia inválido' });
    }

    const { tipo, descripcion } = req.body;
    const tipoNormalizado = typeof tipo === 'string' ? tipo.trim() : '';
    if (!tipoNormalizado || !allowedJustificationTypes.includes(tipoNormalizado)) {
      return res.status(400).json({
        error: `tipo inválido. Debe ser uno de: ${allowedJustificationTypes.join(', ')}`,
      });
    }

    const descripcionTexto = descripcion !== undefined && descripcion !== null
      ? descripcion.toString().trim()
      : '';

    const userToken = req.user;
    const usuarioDb = await Usuario.getById(userToken.id_usuario);
    if (!usuarioDb) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const registro = await Asistencia.findById(id_asistencia);
    if (!registro) {
      return res.status(404).json({ error: 'Registro de asistencia no encontrado' });
    }

    if (userToken.id_rol !== 1) {
      if (!usuarioDb.id_empleado) {
        return res.status(400).json({ error: 'Usuario no vinculado a un empleado' });
      }
      if (usuarioDb.id_empleado !== registro.id_empleado) {
        return res.status(403).json({ error: 'No puedes justificar la asistencia de otro empleado' });
      }
    }

    const solicitud = await JustificacionAsistencia.create({
      id_asistencia,
      id_empleado: registro.id_empleado,
      tipo: tipoNormalizado,
      descripcion: descripcionTexto,
    });

    return res.status(201).json({
      message: 'Justificación enviada para revisión del administrador',
      solicitud: normalizeSolicitud(solicitud),
    });
  } catch (err) {
    if (err.code === 'JUSTIFICACION_PENDIENTE') {
      return res.status(409).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
};

const createJustificacionManual = async (req, res) => {
  try {
    const {
      id_empleado: idEmpleadoBody,
      fecha,
      hora,
      tipo_marca: tipoMarcaBody,
      tipo,
      descripcion,
    } = req.body;

    const userToken = req.user;

    let idEmpleadoFinal = null;
    if (userToken.id_rol === 1) {
      if (idEmpleadoBody === undefined || idEmpleadoBody === null || idEmpleadoBody === '') {
        return res.status(400).json({ error: 'id_empleado es requerido' });
      }
      const parsed = Number(idEmpleadoBody);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        return res.status(400).json({ error: 'id_empleado inválido' });
      }
      idEmpleadoFinal = parsed;
    } else {
      const usuarioDb = await Usuario.getById(userToken.id_usuario);
      if (!usuarioDb || !usuarioDb.id_empleado) {
        return res.status(400).json({ error: 'Usuario no vinculado a un empleado' });
      }
      if (
        idEmpleadoBody !== undefined &&
        idEmpleadoBody !== null &&
        idEmpleadoBody !== '' &&
        Number(idEmpleadoBody) !== usuarioDb.id_empleado
      ) {
        return res.status(403).json({ error: 'No puedes crear solicitudes para otro empleado' });
      }
      idEmpleadoFinal = usuarioDb.id_empleado;
    }

    const empleado = await Empleado.getById(idEmpleadoFinal);
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado o inactivo' });
    }

    const tipoJustificacion = typeof tipo === 'string' ? tipo.trim() : '';
    if (!tipoJustificacion || !allowedJustificationTypes.includes(tipoJustificacion)) {
      return res.status(400).json({
        error: `tipo inválido. Debe ser uno de: ${allowedJustificationTypes.join(', ')}`,
      });
    }

    const tipoMarcaRaw = typeof tipoMarcaBody === 'string' ? tipoMarcaBody.trim() : '';
    let tipoMarcaFinal = 'entrada';
    if (tipoMarcaRaw) {
      if (!allowedTypes.includes(tipoMarcaRaw)) {
        return res.status(400).json({
          error: `tipo_marca inválido. Debe ser uno de: ${allowedTypes.join(', ')}`,
        });
      }
      tipoMarcaFinal = tipoMarcaRaw;
    }

    const fechaSql = formatDateToSql(fecha);
    let horaSql = parseTimeForSqlServer(hora);
    if (!horaSql) {
      horaSql = parseTimeForSqlServer(new Date());
    }

    const existingMarca = await Asistencia.findByEmpleadoFechaTipo(
      idEmpleadoFinal,
      fechaSql,
      tipoMarcaFinal
    );
    if (existingMarca) {
      return res
        .status(409)
        .json({ error: 'Ya existe una marca para la fecha y tipo seleccionados' });
    }

    const descripcionTexto = descripcion !== undefined && descripcion !== null
      ? descripcion.toString().trim()
      : '';

    const estadoDesdeTipo = (() => {
      switch (tipoJustificacion) {
        case 'Permiso con goce':
        case 'Permiso sin goce':
          return 'Permiso';
        case 'Incapacidad':
          return 'Incapacidad';
        case 'Vacaciones':
          return 'Vacaciones';
        default:
          return 'Ausente';
      }
    })();

    const observacionesBase = 'Registro generado desde una solicitud de justificación manual';
    const observaciones = descripcionTexto
      ? `${observacionesBase}: ${descripcionTexto}`
      : observacionesBase;

    const created = await Asistencia.create({
      id_empleado: idEmpleadoFinal,
      fecha: fechaSql,
      hora: horaSql,
      tipo_marca: tipoMarcaFinal,
      estado: estadoDesdeTipo,
      justificado: false,
      justificacion: '',
      observaciones,
      latitud: null,
      longitud: null,
    });

    const id_asistencia = Number(created?.id_asistencia);
    if (!id_asistencia) {
      throw new Error('No fue posible crear el registro de asistencia para la justificación');
    }

    const solicitud = await JustificacionAsistencia.create({
      id_asistencia,
      id_empleado: idEmpleadoFinal,
      tipo: tipoJustificacion,
      descripcion: descripcionTexto,
    });

    const registro = await Asistencia.findById(id_asistencia);

    return res.status(201).json({
      message: 'Justificación registrada y enviada para revisión del administrador',
      registro,
      solicitud: normalizeSolicitud(solicitud),
    });
  } catch (err) {
    if (err.code === 'JUSTIFICACION_PENDIENTE') {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

const resolverJustificacionSolicitud = async (req, res) => {
  try {
    const id_solicitud = Number(req.params.id);
    if (!Number.isInteger(id_solicitud) || id_solicitud <= 0) {
      return res.status(400).json({ error: 'id_solicitud inválido' });
    }

    const { estado, respuesta } = req.body;
    const estadoNormalizado = typeof estado === 'string' ? estado.trim().toLowerCase() : '';
    if (
      !allowedJustificationStates.includes(estadoNormalizado) ||
      estadoNormalizado === 'pendiente'
    ) {
      return res.status(400).json({
        error: `estado inválido. Debe ser 'aprobada' o 'rechazada'`,
      });
    }

    const solicitudActual = await JustificacionAsistencia.findById(id_solicitud);
    if (!solicitudActual) {
      return res.status(404).json({ error: 'Solicitud de justificación no encontrada' });
    }

    if (solicitudActual.estado !== 'pendiente') {
      return res.status(409).json({ error: 'La solicitud ya fue resuelta' });
    }

    const respuestaTexto = respuesta !== undefined && respuesta !== null
      ? respuesta.toString().trim()
      : '';

    const updated = await JustificacionAsistencia.updateEstado(id_solicitud, {
      estado: estadoNormalizado,
      respuesta: respuestaTexto,
    });

    if (estadoNormalizado === 'aprobada') {
      const detalles = [solicitudActual.tipo, respuestaTexto].filter((text) => text && text.length > 0).join(': ');
      await Asistencia.updateJustificacion(solicitudActual.id_asistencia, {
        justificado: true,
        justificacion: detalles || solicitudActual.tipo,
      });
    } else {
      await Asistencia.updateJustificacion(solicitudActual.id_asistencia, {
        justificado: false,
        justificacion: '',
      });
    }

    return res.json({
      message: `Solicitud ${estadoNormalizado === 'aprobada' ? 'aprobada' : 'rechazada'}`,
      solicitud: normalizeSolicitud(updated),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAsistencia,
  getByRange,
  createMarca,
  updateMarca,
  exportAsistencia,
  createJustificacionManual,
  createJustificacionSolicitud,
  resolverJustificacionSolicitud,
};
