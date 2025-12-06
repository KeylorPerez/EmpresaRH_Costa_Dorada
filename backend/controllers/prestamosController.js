/**
 * Controlador de préstamos. Maneja la creación de adelantos, cálculo
 * de saldos pendientes y generación de reportes descargables para
 * mantener trazabilidad de cada solicitud.
 */
const fs = require('fs');
const path = require('path');
const Prestamos = require('../models/Prestamos');
const Usuario = require('../models/Usuario');

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

const estadoPrestamoMap = {
  1: 'Pendiente',
  2: 'Aprobado',
  3: 'Rechazado',
};

const currencyFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 2,
});

const formatCurrencyCRC = (value) => {
  const numero = Number(value);
  if (!Number.isFinite(numero)) {
    return '—';
  }
  return currencyFormatter.format(numero);
};

const formatPercentage = (value) => {
  const numero = Number(value);
  if (!Number.isFinite(numero)) {
    return '—';
  }
  return `${numero.toFixed(2)}%`;
};

const buildPrestamoPdfLines = (prestamo) => {
  const lines = [];
  const divider = '-'.repeat(110);
  const titleDivider = '='.repeat(110);

  const nombreCompleto = [prestamo.nombre, prestamo.apellido]
    .filter(Boolean)
    .join(' ')
    .trim() || `Empleado ID ${prestamo.id_empleado}`;
  const estadoLabel = estadoPrestamoMap[prestamo.id_estado] || sanitizePdfText(prestamo.estado_nombre || 'Desconocido');

  const cuotaSugerida = Number(prestamo.cuotas) > 0 && Number(prestamo.monto)
    ? Number(prestamo.monto) / Number(prestamo.cuotas)
    : null;

  lines.push(titleDivider);
  lines.push('Distribuidora Astua Pirie');
  lines.push('Constancia de préstamo a colaborador');
  lines.push(titleDivider);
  lines.push('');

  lines.push(`Número de préstamo: ${prestamo.id_prestamo}`);
  lines.push(`Empleado: ${sanitizePdfText(nombreCompleto)} (ID ${prestamo.id_empleado})`);
  if (prestamo.cedula) {
    lines.push(`Cédula: ${sanitizePdfText(prestamo.cedula)}`);
  }
  if (prestamo.email || prestamo.telefono) {
    const contacto = [
      prestamo.email ? `Correo: ${sanitizePdfText(prestamo.email)}` : null,
      prestamo.telefono ? `Teléfono: ${sanitizePdfText(prestamo.telefono)}` : null,
    ].filter(Boolean);
    if (contacto.length > 0) {
      wrapText(contacto.join(' | '), 95).forEach((linea) => lines.push(linea));
    }
  }

  lines.push('');
  lines.push(divider);
  lines.push(`Monto aprobado: ${formatCurrencyCRC(prestamo.monto)}`);
  lines.push(`Saldo pendiente: ${formatCurrencyCRC(prestamo.saldo)}`);
  lines.push(`Tasa de interés anual: ${formatPercentage(prestamo.interes_porcentaje)}`);
  lines.push(`Número de cuotas: ${prestamo.cuotas || '—'}`);
  lines.push(`Cuota estimada: ${cuotaSugerida ? formatCurrencyCRC(cuotaSugerida) : '—'}`);
  lines.push(`Estado actual: ${estadoLabel}`);
  lines.push(`Fecha de solicitud: ${formatDateDisplay(prestamo.fecha_solicitud) || '—'}`);
  lines.push(`Fecha del último pago: ${formatDateDisplay(prestamo.fecha_ultimo_pago) || '—'}`);
  lines.push(`Última actualización: ${formatDateDisplay(prestamo.updated_at || prestamo.created_at) || '—'}`);
  lines.push(divider);

  lines.push('Declaración del colaborador:');
  wrapText(
    'Declaro haber solicitado y recibido el préstamo descrito en este documento, comprometiéndome a cancelar cada cuota en los plazos establecidos por la empresa.',
    95,
  ).forEach((linea) => lines.push(`  ${linea}`));
  lines.push('');
  wrapText(
    'Acepto que los pagos se realizarán mediante deducción automática de mi planilla o por los medios acordados con el departamento financiero.',
    95,
  ).forEach((linea) => lines.push(`  ${linea}`));
  lines.push('');
  wrapText(
    'En caso de incumplimiento, autorizo a la empresa a realizar los ajustes necesarios conforme a las políticas internas y la legislación vigente.',
    95,
  ).forEach((linea) => lines.push(`  ${linea}`));
  lines.push(divider);

  lines.push('Firma del colaborador: ________________________________');
  lines.push('Cédula: ______________________________________________');
  lines.push('Fecha de firma: ____ / ____ / ______');
  lines.push('');
  lines.push('Firma de autorización (RRHH / Dirección): __________________');
  lines.push('Fecha: ____ / ____ / ______');
  lines.push('');
  lines.push('Observaciones:');
  lines.push('______________________________________________________________');
  lines.push('______________________________________________________________');
  lines.push('');
  lines.push(divider);
  lines.push('Anexo - Autorización de vacaciones como respaldo del préstamo');
  lines.push(divider);
  lines.push('');
  wrapText(
    'Yo, colaborador solicitante, autorizo que en caso de incumplimiento de pago la empresa pueda aplicar los días de vacación acumulados como garantía para cubrir las sumas adeudadas.',
    95,
  ).forEach((linea) => lines.push(`  ${linea}`));
  lines.push('');
  wrapText(
    'Entiendo que cualquier deducción relacionada se realizará conforme a la legislación laboral vigente y a las políticas internas, procurando el debido aviso previo por parte de Recursos Humanos.',
    95,
  ).forEach((linea) => lines.push(`  ${linea}`));
  lines.push('');
  lines.push('Firma de conformidad del colaborador: ___________________________');
  lines.push('Fecha: ____ / ____ / ______');
  lines.push('');
  lines.push('Firma de responsable de Recursos Humanos: ______________________');
  lines.push('Fecha: ____ / ____ / ______');

  return lines;
};

const createPrestamoPdf = async (filePath, prestamo) => {
  const lines = buildPrestamoPdfLines(prestamo);
  const pages = chunkArray(lines, 40).map((pageLines) => buildPdfContentStream(pageLines));
  const pdfBuffer = buildPdfBuffer(pages);
  await fsPromises.writeFile(filePath, pdfBuffer);
};

// DELETE /api/prestamos/:id
// Solo administradores. Permite eliminar préstamos aprobados.
const deletePrestamo = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const prestamo = await Prestamos.getById(id);
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    if (Number(prestamo.id_estado) !== 2) {
      return res.status(400).json({ error: 'Solo se pueden eliminar préstamos aprobados' });
    }

    await Prestamos.deleteById(id);
    return res.json({ message: 'Préstamo eliminado correctamente' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/prestamos
// Admin -> todos los préstamos
// Empleado -> solo sus préstamos
const getPrestamos = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    if (user.id_rol === 1) {
      const rows = await Prestamos.getAll();
      return res.json(rows);
    }

    const usuarioDB = await Usuario.getById(user.id_usuario);
    if (!usuarioDB || !usuarioDB.id_empleado) {
      return res.status(400).json({ error: 'Usuario no vinculado a empleado' });
    }

    const rows = await Prestamos.getByEmpleado(usuarioDB.id_empleado);
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/prestamos/:id
const getPrestamoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const prestamo = await Prestamos.getById(id);
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    if (user.id_rol !== 1) {
      const usuarioDB = await Usuario.getById(user.id_usuario);
      if (!usuarioDB || !usuarioDB.id_empleado || usuarioDB.id_empleado !== prestamo.id_empleado) {
        return res.status(403).json({ error: 'No autorizado para acceder a este préstamo' });
      }
    }

    return res.json(prestamo);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// POST /api/prestamos
// body: { id_empleado?, monto, cuotas, interes, fecha_solicitud? }
const createPrestamo = async (req, res) => {
  try {
    const {
      id_empleado: idBody,
      monto,
      cuotas,
      interes,
      fecha_solicitud: fechaSolicitud,
    } = req.body;
    const user = req.user;
    const usuarioDB = await Usuario.getById(user.id_usuario);

    let id_empleado_final = idBody || (usuarioDB ? usuarioDB.id_empleado : null);
    if (!id_empleado_final) return res.status(400).json({ error: 'id_empleado requerido' });

    if (idBody && user.id_rol !== 1 && idBody !== usuarioDB.id_empleado) {
      return res.status(403).json({ error: 'No autorizado para crear préstamo para otro empleado' });
    }

    const montoNumber = Number(monto);
    const cuotasNumber = Number(cuotas);
    const interesNumber = Number(interes);

    if (
      Number.isNaN(montoNumber) ||
      Number.isNaN(cuotasNumber) ||
      Number.isNaN(interesNumber)
    ) {
      return res.status(400).json({ error: 'Los valores de monto, cuotas o interes no son válidos' });
    }

    if (!montoNumber || !cuotasNumber || interesNumber === undefined || interesNumber === null) {
      return res.status(400).json({ error: 'Faltan datos requeridos: monto, cuotas, interes' });
    }

    if (montoNumber <= 0 || cuotasNumber <= 0) {
      return res.status(400).json({ error: 'Monto y cuotas deben ser mayores a cero' });
    }

    if (interesNumber < 0) {
      return res.status(400).json({ error: 'El interés no puede ser negativo' });
    }

    const created = await Prestamos.create({
      id_empleado: id_empleado_final,
      monto: montoNumber,
      cuotas: cuotasNumber,
      interes_porcentaje: interesNumber,
      fecha_solicitud: fechaSolicitud,
    });

    return res.status(201).json({ message: 'Préstamo creado', id_prestamo: created.id_prestamo });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PUT /api/prestamos/:id/pagar
// body: { monto_pago }
const pagarPrestamo = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { monto_pago } = req.body;
    const montoPagoNumber = Number(monto_pago);

    if (isNaN(id) || Number.isNaN(montoPagoNumber) || montoPagoNumber <= 0) {
      return res.status(400).json({ error: 'ID o monto_pago inválido' });
    }

    await Prestamos.pagarCuota(id, montoPagoNumber);
    return res.json({ message: 'Pago registrado, saldo actualizado' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// PUT /api/prestamos/:id/estado
// body: { estado | id_estado }
const updateEstadoPrestamo = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { estado, id_estado: idEstadoBody } = req.body || {};

    let id_estado;
    if (idEstadoBody !== undefined && idEstadoBody !== null && idEstadoBody !== "") {
      const parsed = Number(idEstadoBody);
      if (!Number.isNaN(parsed)) {
        id_estado = parsed;
      }
    }

    if (!id_estado && typeof estado === 'string') {
      const estadoLower = estado.trim().toLowerCase();
      if (estadoLower === 'aprobado') id_estado = 2;
      else if (estadoLower === 'rechazado') id_estado = 3;
      else if (estadoLower === 'pendiente') id_estado = 1;
    }

    if (!id_estado) {
      return res.status(400).json({ error: 'Debe indicar un estado válido' });
    }

    if (![1, 2, 3].includes(id_estado)) {
      return res.status(400).json({ error: 'Estado de préstamo no permitido' });
    }

    await Prestamos.updateEstado(id, id_estado);
    return res.json({ message: 'Estado del préstamo actualizado', id_estado });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const exportPrestamoPdf = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const id_prestamo = Number(req.params.id);
    if (!Number.isInteger(id_prestamo) || id_prestamo <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const prestamo = await Prestamos.getById(id_prestamo);
    if (!prestamo) {
      return res.status(404).json({ error: 'Préstamo no encontrado' });
    }

    if (user.id_rol !== 1) {
      const usuarioDB = await Usuario.getById(user.id_usuario);
      if (!usuarioDB || !usuarioDB.id_empleado || usuarioDB.id_empleado !== prestamo.id_empleado) {
        return res.status(403).json({ error: 'No autorizado para acceder a este préstamo' });
      }
    }

    if (Number(prestamo.id_estado) !== 2) {
      return res.status(400).json({ error: 'El documento está disponible únicamente para préstamos aprobados' });
    }

    await ensureExportsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `prestamo-${prestamo.id_prestamo}-${timestamp}.pdf`;
    const filePath = path.join(EXPORTS_DIR, filename);

    await createPrestamoPdf(filePath, prestamo);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/files/${filename}`;

    return res.json({ url: publicUrl, filename, format: 'pdf' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getPrestamos,
  getPrestamoById,
  createPrestamo,
  pagarPrestamo,
  updateEstadoPrestamo,
  exportPrestamoPdf,
  deletePrestamo,
};
