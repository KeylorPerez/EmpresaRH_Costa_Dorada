/**
 * Controlador de empleados. Centraliza la lógica de gestión de expedientes,
 * exportes en PDF/Excel y formateo de datos para garantizar consistencia
 * entre las distintas salidas del sistema.
 */
const fs = require('fs');
const path = require('path');
const Empleado = require('../models/Empleado');

const { promises: fsPromises } = fs;
const EXPORTS_DIR = path.join(__dirname, '..', 'exports');

const ensureExportsDir = async () => {
  if (!fs.existsSync(EXPORTS_DIR)) {
    await fsPromises.mkdir(EXPORTS_DIR, { recursive: true });
  }
};

const currencyFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 2,
});

const normalizeCurrencySpacing = (text = '') =>
  text
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\u2007/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const formatCurrency = (value) => {
  const formatted = currencyFormatter.format(Number(value) || 0);
  const sanitized = normalizeCurrencySpacing(formatted);
  return sanitized.replace(/₡/g, 'CRC ');
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

const sanitizePdfText = (text = '') =>
  String(text)
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\u2007/g, ' ')
    .replace(/\s+/g, ' ');

const padAndTruncate = (text, length) => {
  const sanitized = sanitizePdfText(text || '');
  if (sanitized.length <= length) {
    return sanitized.padEnd(length, ' ');
  }

  const trimmed = sanitized.slice(0, Math.max(0, length - 3));
  return `${trimmed}...`;
};

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

const formatEmployeeStatus = (estado) => (Number(estado) === 1 ? 'Activo' : 'Inactivo');

const buildEmployeesPdfLines = (rows, { statusLabel }) => {
  const lines = [];
  const divider = '-'.repeat(110);
  const titleDivider = '='.repeat(110);
  const totalEmpleados = Array.isArray(rows) ? rows.length : 0;

  lines.push(titleDivider);
  lines.push('Listado de empleados - Distribuidora Astua Pirie');
  lines.push(titleDivider);
  lines.push('');
  lines.push(`Estado incluido: ${sanitizePdfText(statusLabel)}`);
  lines.push(`Total de empleados: ${totalEmpleados}`);
  lines.push('');

  const header = [
    padAndTruncate('ID', 6),
    padAndTruncate('Nombre completo', 22),
    padAndTruncate('Cédula', 14),
    padAndTruncate('Puesto', 18),
    padAndTruncate('Ingreso', 10),
    padAndTruncate('Tipo pago', 10),
    padAndTruncate('Salario', 14),
    padAndTruncate('Estado', 8),
  ].join(' ');
  lines.push(header);
  lines.push(divider);

  if (!Array.isArray(rows) || rows.length === 0) {
    lines.push('No hay empleados para los filtros seleccionados.');
    return lines;
  }

  rows.forEach((empleado) => {
    const nombreCompleto = [empleado.nombre, empleado.apellido]
      .filter(Boolean)
      .join(' ')
      .trim() || `ID ${empleado.id_empleado}`;

    const baseLine = [
      padAndTruncate(String(empleado.id_empleado || ''), 6),
      padAndTruncate(nombreCompleto, 22),
      padAndTruncate(empleado.cedula || '—', 14),
      padAndTruncate(empleado.puesto_nombre || '—', 18),
      padAndTruncate(formatDateDisplay(empleado.fecha_ingreso), 10),
      padAndTruncate(empleado.tipo_pago || '—', 10),
      padAndTruncate(formatCurrency(empleado.salario_monto), 14),
      padAndTruncate(formatEmployeeStatus(empleado.estado), 8),
    ].join(' ');

    lines.push(baseLine);

    const detallesContacto = [];
    if (empleado.telefono) {
      detallesContacto.push(`Tel: ${sanitizePdfText(empleado.telefono)}`);
    }
    if (empleado.email) {
      detallesContacto.push(`Correo: ${sanitizePdfText(empleado.email)}`);
    }

    if (detallesContacto.length > 0) {
      const contactoTexto = detallesContacto.join(' | ');
      const contactoEnvuelto = wrapText(contactoTexto, 95);
      contactoEnvuelto.forEach((texto, index) => {
        const prefix = index === 0 ? ' '.repeat(6) : ' '.repeat(8);
        lines.push(`${prefix}${texto}`);
      });
    }
  });

  return lines;
};

const createEmployeesPdf = async (filePath, rows, meta) => {
  const lines = buildEmployeesPdfLines(rows, meta);
  const pages = chunkArray(lines, 40).map((pageLines) => buildPdfContentStream(pageLines));
  const pdfBuffer = buildPdfBuffer(pages);
  await fsPromises.writeFile(filePath, pdfBuffer);
};

const createEmployeesCsv = async (filePath, rows, meta) => {
  const { statusLabel } = meta;
  const lines = [];
  const total = Array.isArray(rows) ? rows.length : 0;

  lines.push('Distribuidora Astua Pirie');
  lines.push('Reporte de empleados');
  lines.push(`Estado incluido;${escapeCsv(statusLabel)}`);
  lines.push(`Total de empleados;${total}`);
  lines.push('');
  lines.push('ID;Nombre;Apellido;Cédula;Puesto;Teléfono;Correo;Ingreso;Tipo de pago;Salario;Bonificación fija;% CCSS;Deducción CCSS;Marcación externa;Estado');

  if (Array.isArray(rows) && rows.length > 0) {
    rows.forEach((empleado) => {
      const line = [
        empleado.id_empleado,
        escapeCsv(empleado.nombre || ''),
        escapeCsv(empleado.apellido || ''),
        escapeCsv(empleado.cedula || ''),
        escapeCsv(empleado.puesto_nombre || ''),
        escapeCsv(empleado.telefono || ''),
        escapeCsv(empleado.email || ''),
        escapeCsv(formatDateDisplay(empleado.fecha_ingreso)),
        escapeCsv(empleado.tipo_pago || ''),
        escapeCsv(formatCurrency(empleado.salario_monto)),
        escapeCsv(formatCurrency(empleado.bonificacion_fija)),
        escapeCsv(empleado.porcentaje_ccss),
        escapeCsv(formatCurrency(empleado.deduccion_fija)),
        escapeCsv(Number(empleado.permitir_marcacion_fuera) === 1 ? 'Permitida' : 'Restringida'),
        escapeCsv(formatEmployeeStatus(empleado.estado)),
      ].join(';');
      lines.push(line);
    });
  } else {
    lines.push('No hay empleados;;;;;;;;;;;;;;;;');
  }

  const sanitizedLines = lines.map((line) => sanitizeCsvLine(line));
  const content = `${CSV_BOM}${sanitizedLines.join('\r\n')}\r\n`;
  await fsPromises.writeFile(filePath, content, 'utf8');
};

// Obtener todos los empleados (solo activos)
const getEmpleados = async (req, res) => {
  try {
    const empleados = await Empleado.getAll();
    res.json(empleados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Obtener un empleado por ID (solo si está activo)
const getEmpleadoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const empleado = await Empleado.getById(id);
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado o inactivo' });

    res.json(empleado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Crear un nuevo empleado (solo admin)
const createEmpleado = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento,
      telefono,
      email,
      fecha_ingreso,
      salario_monto,
      tipo_pago,
      bonificacion_fija,
      porcentaje_ccss,
      usa_deduccion_fija,
      deduccion_fija,
      permitir_marcacion_fuera,
    } = req.body;

    if (
      !nombre ||
      !apellido ||
      !id_puesto ||
      !cedula ||
      !fecha_ingreso ||
      !salario_monto ||
      !tipo_pago
    ) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    if (!['Diario', 'Quincenal'].includes(tipo_pago)) {
      return res.status(400).json({ error: 'Tipo de pago inválido' });
    }

    const bonificacionValue =
      bonificacion_fija !== undefined && bonificacion_fija !== null
        ? Number(bonificacion_fija)
        : 0;

    if (Number.isNaN(bonificacionValue)) {
      return res.status(400).json({ error: 'Bonificación fija inválida' });
    }

    const porcentajeValue =
      porcentaje_ccss !== undefined && porcentaje_ccss !== null
        ? Number(porcentaje_ccss)
        : 9.34;
    if (Number.isNaN(porcentajeValue) || porcentajeValue < 0) {
      return res.status(400).json({ error: 'Porcentaje CCSS inválido' });
    }

    const usaDeduccionFijaValue =
      usa_deduccion_fija !== undefined && usa_deduccion_fija !== null
        ? Number(usa_deduccion_fija) === 1 || usa_deduccion_fija === true
        : false;

    const deduccionFijaValue =
      deduccion_fija !== undefined && deduccion_fija !== null
        ? Number(deduccion_fija)
        : 0;
    if (Number.isNaN(deduccionFijaValue) || deduccionFijaValue < 0) {
      return res.status(400).json({ error: 'Deducción fija inválida' });
    }

    const permitirMarcacionFueraValue =
      permitir_marcacion_fuera !== undefined && permitir_marcacion_fuera !== null
        ? Number(permitir_marcacion_fuera) === 1 || permitir_marcacion_fuera === true
        : false;

    const empleado = await Empleado.create({
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono: telefono || null,
      email: email || null,
      fecha_ingreso,
      salario_monto,
      tipo_pago,
      bonificacion_fija: bonificacionValue,
      porcentaje_ccss: porcentajeValue,
      usa_deduccion_fija: usaDeduccionFijaValue ? 1 : 0,
      deduccion_fija: usaDeduccionFijaValue ? deduccionFijaValue : 0,
      permitir_marcacion_fuera: permitirMarcacionFueraValue ? 1 : 0,
    });

    res.status(201).json({
      message: 'Empleado creado correctamente',
      id_empleado: empleado.id_empleado
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Actualizar un empleado (solo admin)
const updateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const {
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento,
      telefono,
      email,
      fecha_ingreso,
      salario_monto,
      tipo_pago,
      bonificacion_fija,
      porcentaje_ccss,
      usa_deduccion_fija,
      deduccion_fija,
      permitir_marcacion_fuera,
      estado
    } = req.body;

    if (tipo_pago && !['Diario', 'Quincenal'].includes(tipo_pago)) {
      return res.status(400).json({ error: 'Tipo de pago inválido' });
    }

    const bonificacionValue =
      bonificacion_fija !== undefined && bonificacion_fija !== null
        ? Number(bonificacion_fija)
        : null;

    if (bonificacionValue !== null && Number.isNaN(bonificacionValue)) {
      return res.status(400).json({ error: 'Bonificación fija inválida' });
    }

    const porcentajeValue =
      porcentaje_ccss !== undefined && porcentaje_ccss !== null
        ? Number(porcentaje_ccss)
        : null;
    if (porcentajeValue !== null && (Number.isNaN(porcentajeValue) || porcentajeValue < 0)) {
      return res.status(400).json({ error: 'Porcentaje CCSS inválido' });
    }

    const usaDeduccionFijaValue =
      usa_deduccion_fija !== undefined && usa_deduccion_fija !== null
        ? Number(usa_deduccion_fija) === 1 || usa_deduccion_fija === true
        : null;

    const deduccionFijaValue =
      deduccion_fija !== undefined && deduccion_fija !== null
        ? Number(deduccion_fija)
        : null;
    if (deduccionFijaValue !== null && (Number.isNaN(deduccionFijaValue) || deduccionFijaValue < 0)) {
      return res.status(400).json({ error: 'Deducción fija inválida' });
    }

    const permitirMarcacionFueraValue =
      permitir_marcacion_fuera !== undefined && permitir_marcacion_fuera !== null
        ? Number(permitir_marcacion_fuera) === 1 || permitir_marcacion_fuera === true
        : null;

    await Empleado.update(id, {
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono: telefono || null,
      email: email || null,
      fecha_ingreso,
      salario_monto,
      tipo_pago,
      bonificacion_fija: bonificacionValue,
      porcentaje_ccss: porcentajeValue,
      usa_deduccion_fija:
        usaDeduccionFijaValue === null
          ? null
          : usaDeduccionFijaValue
          ? 1
          : 0,
      deduccion_fija:
        deduccionFijaValue === null
          ? null
          : usaDeduccionFijaValue
          ? deduccionFijaValue || 0
          : 0,
      permitir_marcacion_fuera:
        permitirMarcacionFueraValue === null
          ? null
          : permitirMarcacionFueraValue
          ? 1
          : 0,
      estado
    });

    res.json({ message: 'Empleado actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Desactivar un empleado (soft delete)
const deactivateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    await Empleado.deactivate(id);
    res.json({ message: 'Empleado desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Activar un empleado (revertir desactivación)
const activateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    await Empleado.activate(id);
    res.json({ message: 'Empleado activado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const exportEmpleados = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo admin puede exportar empleados' });
    }

    const { format: formatParam = 'pdf', status: statusParam = 'all' } = req.query || {};

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

    const statusOptions = new Map([
      ['all', { predicate: () => true, label: 'Todos los empleados', slug: 'todos' }],
      ['active', { predicate: (empleado) => Number(empleado?.estado) === 1, label: 'Empleados activos', slug: 'activos' }],
      [
        'inactive',
        {
          predicate: (empleado) => Number(empleado?.estado) !== 1,
          label: 'Empleados inactivos',
          slug: 'inactivos',
        },
      ],
    ]);

    const normalizedStatus = (statusParam || 'all').toString().toLowerCase();
    const statusKey = statusOptions.has(normalizedStatus) ? normalizedStatus : 'all';
    const statusConfig = statusOptions.get(statusKey);

    const empleados = await Empleado.getAll();
    const lista = Array.isArray(empleados) ? empleados : [];
    const filtrados = lista.filter((empleado) => {
      try {
        return statusConfig.predicate(empleado);
      } catch (error) {
        return true;
      }
    });

    await ensureExportsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = normalizedFormat === 'pdf' ? 'pdf' : 'csv';
    const filename = `empleados-${statusConfig.slug}-${timestamp}.${extension}`;
    const filePath = path.join(EXPORTS_DIR, filename);

    if (normalizedFormat === 'pdf') {
      await createEmployeesPdf(filePath, filtrados, { statusLabel: statusConfig.label });
    } else {
      await createEmployeesCsv(filePath, filtrados, { statusLabel: statusConfig.label });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/files/${filename}`;

    return res.json({ url: publicUrl, filename, format: normalizedFormat });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getEmpleados,
  getEmpleadoById,
  createEmpleado,
  updateEmpleado,
  deactivateEmpleado,
  activateEmpleado,
  exportEmpleados,
};
