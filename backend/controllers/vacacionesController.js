/**
 * Controlador de vacaciones. Permite crear, aprobar y reportar solicitudes
 * de disfrute, conectando la información del usuario con su expediente de empleado.
 */
const fs = require('fs');
const path = require('path');
const Vacaciones = require('../models/Vacaciones');
const Usuario = require('../models/Usuario'); // para obtener el id_empleado vinculado al usuario

const { promises: fsPromises } = fs;
const EXPORTS_DIR = path.join(__dirname, '..', 'exports');

const ensureExportsDir = async () => {
  if (!fs.existsSync(EXPORTS_DIR)) {
    await fsPromises.mkdir(EXPORTS_DIR, { recursive: true });
  }
};

const formatDateValue = (value) => {
  if (!value) return '';
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
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
};

const formatDateDisplay = (value) => {
  const iso = formatDateValue(value);
  if (!iso) return '';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
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

const wrapText = (text, maxLength = 95) => {
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
    const footer = 'endobj\n';
    const objectBuffer = Buffer.concat([Buffer.from(objectHeader, 'utf8'), bodyBuffer, Buffer.from(footer, 'utf8')]);
    buffers.push(objectBuffer);
    offset += objectBuffer.length;
  });

  const xrefStart = offset;
  const xrefHeader = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  const xrefLines = [];
  for (let i = 1; i <= objects.length; i += 1) {
    xrefLines.push(`${xrefPositions[i].toString().padStart(10, '0')} 00000 n \n`);
  }
  const xrefBuffer = Buffer.from(xrefHeader + xrefLines.join(''), 'utf8');
  buffers.push(xrefBuffer);
  offset += xrefBuffer.length;

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  buffers.push(Buffer.from(trailer, 'utf8'));

  return Buffer.concat(buffers);
};

const diasSolicitados = (inicio, fin) => {
  const start = new Date(inicio);
  const end = new Date(fin);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diff = Math.abs(end - start);
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
};

const estadoVacacionesMap = {
  1: 'Pendiente',
  2: 'Aprobado',
  3: 'Rechazado',
};

const buildVacacionesPdfLines = (solicitud) => {
  const lines = [];
  const divider = '-'.repeat(110);
  const titleDivider = '='.repeat(110);
  const nombreCompleto = [solicitud.nombre, solicitud.apellido]
    .filter(Boolean)
    .join(' ')
    .trim() || `Empleado ID ${solicitud.id_empleado}`;
  const dias = diasSolicitados(solicitud.fecha_inicio, solicitud.fecha_fin);
  const estadoLabel = estadoVacacionesMap[solicitud.id_estado] || 'Desconocido';

  lines.push(titleDivider);
  lines.push('Distribuidora Astua Pirie');
  lines.push('Constancia de solicitud de vacaciones');
  lines.push(titleDivider);
  lines.push('');

  lines.push(`Número de solicitud: ${solicitud.id_vacacion}`);
  lines.push(`Empleado: ${sanitizePdfText(nombreCompleto)} (ID ${solicitud.id_empleado})`);
  if (solicitud.cedula) {
    lines.push(`Cédula: ${sanitizePdfText(solicitud.cedula)}`);
  }
  if (solicitud.email || solicitud.telefono) {
    const contacto = [
      solicitud.email ? `Correo: ${sanitizePdfText(solicitud.email)}` : null,
      solicitud.telefono ? `Teléfono: ${sanitizePdfText(solicitud.telefono)}` : null,
    ].filter(Boolean);
    if (contacto.length > 0) {
      wrapText(contacto.join(' | '), 95).forEach((linea) => lines.push(linea));
    }
  }

  lines.push('');
  lines.push(divider);
  lines.push(`Periodo solicitado: ${formatDateDisplay(solicitud.fecha_inicio)} al ${formatDateDisplay(solicitud.fecha_fin)}`);
  lines.push(`Días solicitados: ${dias}`);
  const diasAprobados = Number(solicitud.dias_aprobados) > 0 ? Number(solicitud.dias_aprobados) : 0;
  lines.push(`Días aprobados: ${diasAprobados > 0 ? diasAprobados : 'En revisión'}`);
  lines.push(`Estado actual: ${estadoLabel}`);
  lines.push(`Aprobado por: ${sanitizePdfText(solicitud.aprobado_por_username || 'Pendiente')}`);
  lines.push(`Creada el: ${formatDateDisplay(solicitud.created_at) || '—'}`);
  lines.push(`Última actualización: ${formatDateDisplay(solicitud.updated_at) || '—'}`);
  lines.push(divider);

  if (solicitud.motivo) {
    lines.push('Motivo de la solicitud:');
    wrapText(solicitud.motivo, 95).forEach((linea) => lines.push(`  ${linea}`));
    lines.push(divider);
  }

  lines.push('Confirmo que he sido informado sobre la programación de mis vacaciones y que acepto las condiciones indicadas.');
  lines.push('');
  lines.push('Firma del colaborador: ________________________________');
  lines.push('Fecha de firma: ____ / ____ / ______');
  lines.push('');
  lines.push('Firma RRHH / Jefatura: ________________________________');
  lines.push('Fecha: ____ / ____ / ______');
  lines.push('');
  lines.push('Observaciones adicionales:');
  lines.push('______________________________________________________________');
  lines.push('______________________________________________________________');

  return lines;
};

const createVacacionesPdf = async (filePath, solicitud) => {
  const lines = buildVacacionesPdfLines(solicitud);
  const pages = chunkArray(lines, 40).map((pageLines) => buildPdfContentStream(pageLines));
  const pdfBuffer = buildPdfBuffer(pages);
  await fsPromises.writeFile(filePath, pdfBuffer);
};

// =======================
// GET /api/vacaciones
// Admin → ve todas las solicitudes
// Empleado → ve solo las suyas
// =======================
const getVacaciones = async (req, res) => {
  try {
    const user = req.user; // { id_usuario, id_rol }
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    if (user.id_rol === 1) {
      const rows = await Vacaciones.getAll();
      return res.json(rows);
    } else {
      const usuario = await Usuario.getById(user.id_usuario);
      if (!usuario || !usuario.id_empleado)
        return res.status(400).json({ error: 'Usuario no vinculado a empleado' });

      const rows = await Vacaciones.getByEmpleado(usuario.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// =======================
// POST /api/vacaciones
// Crear solicitud de vacaciones
// =======================
const createSolicitud = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const { id_empleado: idEmpleadoBody, fecha_inicio, fecha_fin, motivo } = req.body;

    if (!fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: 'fecha_inicio y fecha_fin son requeridos' });
    }

    const start = new Date(fecha_inicio);
    const end = new Date(fecha_fin);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'fecha_inicio o fecha_fin inválidas (usa YYYY-MM-DD)' });
    }
    if (end < start) {
      return res.status(400).json({ error: 'fecha_fin no puede ser anterior a fecha_inicio' });
    }

    // Calcular días solicitados automáticamente
    const dias_solicitados = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    const usuario = await Usuario.getById(user.id_usuario);
    const actorEmpleadoId = usuario ? usuario.id_empleado : null;

    let id_empleado_final = idEmpleadoBody || actorEmpleadoId;
    if (!id_empleado_final) {
      return res.status(400).json({ error: 'id_empleado requerido (o vincular usuario a empleado)' });
    }

    if (idEmpleadoBody && user.id_rol !== 1 && idEmpleadoBody !== actorEmpleadoId) {
      return res.status(403).json({ error: 'No autorizado para crear solicitud para otro empleado' });
    }

    const created = await Vacaciones.create({
      id_empleado: id_empleado_final,
      fecha_inicio: start,
      fecha_fin: end,
      motivo
    });

    return res.status(201).json({
      message: 'Solicitud de vacaciones creada correctamente',
      solicitud: created
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// =======================
// PUT /api/vacaciones/:id/aprobar (solo admin)
// =======================
const aprobarSolicitud = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede aprobar' });

    const id_vacacion = parseInt(req.params.id, 10);
    if (isNaN(id_vacacion)) return res.status(400).json({ error: 'id inválido' });

    const { dias_aprobados } = req.body;
    if (!dias_aprobados || isNaN(dias_aprobados)) {
      return res.status(400).json({ error: 'dias_aprobados es requerido y debe ser número' });
    }

    await Vacaciones.aprobar(id_vacacion, user.id_usuario, parseInt(dias_aprobados, 10));
    return res.json({ message: 'Solicitud aprobada correctamente' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// =======================
// PUT /api/vacaciones/:id/rechazar (solo admin)
// =======================
const rechazarSolicitud = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede rechazar' });

    const id_vacacion = parseInt(req.params.id, 10);
    if (isNaN(id_vacacion)) return res.status(400).json({ error: 'id inválido' });

    await Vacaciones.rechazar(id_vacacion, user.id_usuario);
    return res.json({ message: 'Solicitud rechazada correctamente' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const exportSolicitudPdf = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const id_vacacion = Number(req.params.id);
    if (!Number.isInteger(id_vacacion) || id_vacacion <= 0) {
      return res.status(400).json({ error: 'id inválido' });
    }

    const solicitud = await Vacaciones.getById(id_vacacion);
    if (!solicitud) {
      return res.status(404).json({ error: 'Solicitud no encontrada' });
    }

    if (user.id_rol !== 1) {
      const usuarioDb = await Usuario.getById(user.id_usuario);
      if (!usuarioDb || !usuarioDb.id_empleado) {
        return res.status(403).json({ error: 'No autorizado para acceder a esta solicitud' });
      }
      if (usuarioDb.id_empleado !== solicitud.id_empleado) {
        return res.status(403).json({ error: 'No autorizado para acceder a esta solicitud' });
      }
    }

    await ensureExportsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `vacaciones-${solicitud.id_vacacion}-${timestamp}.pdf`;
    const filePath = path.join(EXPORTS_DIR, filename);

    await createVacacionesPdf(filePath, solicitud);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/files/${filename}`;

    return res.json({ url: publicUrl, filename, format: 'pdf' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getVacaciones,
  createSolicitud,
  aprobarSolicitud,
  rechazarSolicitud,
  exportSolicitudPdf
};
