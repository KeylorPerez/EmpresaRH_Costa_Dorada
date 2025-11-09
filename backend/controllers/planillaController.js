const fs = require('fs');
const path = require('path');
const Planilla = require('../models/Planilla');
const Usuario = require('../models/Usuario');
const Asistencia = require('../models/Asistencia');
const Empleado = require('../models/Empleado');
const DetallePlanilla = require('../models/DetallePlanilla');

const EXPORTS_DIR = path.join(__dirname, '..', 'exports');
const { promises: fsPromises } = fs;

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
  // Helvetica (fuente estándar en el PDF) no contiene el símbolo de colón costarricense,
  // por lo que lo reemplazamos por la abreviatura de la moneda para evitar caracteres extraños.
  return sanitized.replace(/₡/g, 'CRC ');
};

const formatDateValue = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toISOString().slice(0, 10);
};

const formatDateDisplay = (value) => {
  const iso = formatDateValue(value);
  if (!iso || iso === '-') return '-';
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

const capitalize = (text = '') => {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const stripDiacritics = (text = '') => {
  if (!text) return '';
  if (typeof text.normalize !== 'function') return String(text);
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const sanitizePdfText = (text = '') =>
  String(text)
    .replace(/\u00A0/g, ' ')
    .replace(/\u202F/g, ' ')
    .replace(/\u2007/g, ' ')
    .replace(/\s+/g, ' ');

const normalizePdfEncoding = (text = '') =>
  Array.from(stripDiacritics(text))
    .map((char) => {
      const code = char.codePointAt(0);
      if (code === undefined) return '';
      if (code <= 0xff) {
        return String.fromCharCode(code);
      }
      return '?';
    })
    .join('');

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

const escapePdfText = (text = '') =>
  normalizePdfEncoding(text)
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');

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

const ensureExportsDir = async () => {
  if (!fs.existsSync(EXPORTS_DIR)) {
    await fsPromises.mkdir(EXPORTS_DIR, { recursive: true });
  }
};

const buildPdfLines = (planilla, detalles) => {
  const lines = [];
  const nombreColaborador = [planilla.nombre, planilla.apellido]
    .filter(Boolean)
    .join(' ')
    .trim() || `ID ${planilla.id_empleado}`;

  const sectionDivider = '-'.repeat(100);
  const titleDivider = '='.repeat(100);
  const labelWidth = 22;

  lines.push(titleDivider);
  lines.push(`Detalle de planilla #${planilla.id_planilla}`);
  lines.push(titleDivider);
  lines.push('');

  const generalInfo = [
    ['Colaborador', nombreColaborador],
    ['Identificación', planilla.cedula || 'No registrada'],
    ['Correo', planilla.email || 'No registrado'],
    [
      'Periodo',
      `${formatDateDisplay(planilla.periodo_inicio)} - ${formatDateDisplay(planilla.periodo_fin)}`,
    ],
    ['Fecha de pago', formatDateDisplay(planilla.fecha_pago)],
    ['Tipo de pago', planilla.tipo_pago || planilla.tipo_pago_empleado || 'No especificado'],
  ];

  generalInfo.forEach(([label, value]) => {
    const sanitizedValue = sanitizePdfText(value || '');
    lines.push(`${label.padEnd(labelWidth, ' ')}: ${sanitizedValue}`);
  });

  lines.push('');
  lines.push('Resumen financiero');
  lines.push(sectionDivider);

  const resumenFinanciero = [
    ['Salario base', formatCurrency(planilla.salario_monto)],
    ['Horas extras', formatCurrency(planilla.horas_extras)],
    ['Bonificaciones', formatCurrency(planilla.bonificaciones)],
    ['Salario bruto', formatCurrency(planilla.salario_bruto)],
    ['CCSS', formatCurrency(planilla.ccss_deduccion)],
    ['Otras deducciones', formatCurrency(planilla.deducciones)],
  ];

  const totalDeducciones = (Number(planilla.deducciones) || 0) + (Number(planilla.ccss_deduccion) || 0);
  resumenFinanciero.push(['Total deducciones', formatCurrency(totalDeducciones)]);
  resumenFinanciero.push(['Pago neto', formatCurrency(planilla.pago_neto)]);

  const summaryLabelWidth = 24;
  const summaryValueWidth = 18;
  const summaryLineWidth = 80;
  resumenFinanciero.forEach(([label, value]) => {
    const sanitizedValue = sanitizePdfText(value);
    const paddedLabel = label.padEnd(summaryLabelWidth, ' ');
    const paddedValue = sanitizedValue.padStart(summaryValueWidth, ' ');
    const dottedLineLength = Math.max(
      4,
      summaryLineWidth - (paddedLabel.length + paddedValue.length + 1),
    );
    const dottedLine = '.'.repeat(dottedLineLength);
    lines.push(`${paddedLabel}${dottedLine} ${paddedValue}`);
  });

  lines.push('');
  lines.push('Detalle diario');
  lines.push(sectionDivider);
  const columnWidths = {
    fecha: 12,
    dia: 13,
    asistencia: 13,
    tipo: 12,
    salario: 18,
  };
  const headerLine = [
    'Fecha'.padEnd(columnWidths.fecha, ' '),
    'Día'.padEnd(columnWidths.dia, ' '),
    'Asistencia'.padEnd(columnWidths.asistencia, ' '),
    'Tipo'.padEnd(columnWidths.tipo, ' '),
    'Salario día'.padEnd(columnWidths.salario, ' '),
    'Observación',
  ].join(' | ');
  lines.push(headerLine);
  lines.push(sectionDivider);

  if (!Array.isArray(detalles) || detalles.length === 0) {
    lines.push('Sin registros de detalle para esta planilla.');
    return lines;
  }

  detalles.forEach((detalle) => {
    const fecha = formatDateDisplay(detalle.fecha).padEnd(columnWidths.fecha, ' ');
    const dia = capitalize(detalle.dia_semana || '').padEnd(columnWidths.dia, ' ');
    const asistencia = (detalle.asistio ? 'Asistió' : 'Faltó').padEnd(
      columnWidths.asistencia,
      ' ',
    );
    const tipo = (detalle.es_dia_doble ? 'Día doble' : 'Normal').padEnd(
      columnWidths.tipo,
      ' ',
    );
    const salario = formatCurrency(detalle.salario_dia).padEnd(columnWidths.salario, ' ');
    const observacion = sanitizePdfText(detalle.observacion ? detalle.observacion.trim() : '');
    const basePrefix = [fecha, dia, asistencia, tipo, salario].join(' | ');
    const maxObservationWidth = Math.max(0, 95 - (basePrefix.length + 3));
    const observationLines =
      observacion && maxObservationWidth > 0
        ? wrapText(observacion, maxObservationWidth)
        : [observacion];

    observationLines.forEach((obsLine, index) => {
      if (index === 0) {
        lines.push(`${basePrefix} | ${obsLine}`.trimEnd());
      } else {
        const continuedObservation = obsLine ? obsLine : '';
        lines.push(`${' '.repeat(basePrefix.length)} | ${continuedObservation}`.trimEnd());
      }
    });
    lines.push(sectionDivider);
  });

  return lines;
};

const buildPdfContentStream = (lines) => {
  const safeLines = lines.length > 0 ? lines : [''];
  const instructions = ['BT', '/F1 12 Tf', '50 780 Td'];
  instructions.push(`(${escapePdfText(safeLines[0])}) Tj`);
  for (let i = 1; i < safeLines.length; i += 1) {
    instructions.push('0 -16 Td');
    instructions.push(`(${escapePdfText(safeLines[i])}) Tj`);
  }
  instructions.push('ET');
  return instructions.join('\n');
};

const buildPdfBuffer = (pagesContent) => {
  const contentStreams = pagesContent.length > 0 ? pagesContent : ['BT\n/F1 12 Tf\n50 780 Td\n() Tj\nET'];
  const objects = [];

  const addObject = (value) => {
    objects.push(value);
    return objects.length;
  };

  const catalogId = addObject(null);
  const pagesId = addObject(null);
  const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

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
      const streamString =
        typeof obj.stream === 'string' ? obj.stream : obj.stream.toString();
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

const createPdfFile = async (filePath, planilla, detalles) => {
  const lines = buildPdfLines(planilla, detalles);
  const pages = chunkArray(lines, 40);
  const contentStreams = pages.map((pageLines) => buildPdfContentStream(pageLines));
  const pdfBuffer = buildPdfBuffer(contentStreams);
  await fsPromises.writeFile(filePath, pdfBuffer);
};

const escapeCsv = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[";\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const createCsvFile = async (filePath, planilla, detalles) => {
  const nombreColaborador = [planilla.nombre, planilla.apellido]
    .filter(Boolean)
    .join(' ')
    .trim() || `ID ${planilla.id_empleado}`;
  const totalDeducciones = (Number(planilla.deducciones) || 0) + (Number(planilla.ccss_deduccion) || 0);

  const lines = [];
  lines.push(`Planilla #${planilla.id_planilla}`);
  lines.push(`Colaborador;${escapeCsv(nombreColaborador)}`);
  lines.push(`Identificación;${escapeCsv(planilla.cedula || 'No registrada')}`);
  lines.push(`Correo;${escapeCsv(planilla.email || 'No registrado')}`);
  lines.push(`Periodo;${formatDateDisplay(planilla.periodo_inicio)} - ${formatDateDisplay(planilla.periodo_fin)}`);
  lines.push(`Fecha de pago;${formatDateDisplay(planilla.fecha_pago)}`);
  lines.push(`Tipo de pago;${escapeCsv(planilla.tipo_pago || planilla.tipo_pago_empleado || 'No especificado')}`);
  lines.push('');
  lines.push('Resumen financiero');
  lines.push(`Salario base;${formatCurrency(planilla.salario_monto)}`);
  lines.push(`Horas extras;${formatCurrency(planilla.horas_extras)}`);
  lines.push(`Bonificaciones;${formatCurrency(planilla.bonificaciones)}`);
  lines.push(`Salario bruto;${formatCurrency(planilla.salario_bruto)}`);
  lines.push(`CCSS;${formatCurrency(planilla.ccss_deduccion)}`);
  lines.push(`Otras deducciones;${formatCurrency(planilla.deducciones)}`);
  lines.push(`Total deducciones;${formatCurrency(totalDeducciones)}`);
  lines.push(`Pago neto;${formatCurrency(planilla.pago_neto)}`);
  lines.push('');
  lines.push('Detalle');
  lines.push('Fecha;Día;Asistencia;Tipo;Salario día;Observación');

  if (Array.isArray(detalles) && detalles.length > 0) {
    detalles.forEach((detalle) => {
      const fila = [
        formatDateValue(detalle.fecha),
        capitalize(detalle.dia_semana || ''),
        detalle.asistio ? 'Asistió' : 'Faltó',
        detalle.es_dia_doble ? 'Día doble' : 'Normal',
        Number(detalle.salario_dia || 0).toFixed(2),
        escapeCsv(detalle.observacion || ''),
      ].join(';');
      lines.push(fila);
    });
  } else {
    lines.push('Sin registros;;;;;');
  }

  const content = `${lines.join('\n')}\n`;
  await fsPromises.writeFile(filePath, content, 'utf8');
};

// 🔹 Obtener planillas
const getPlanilla = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    if (user.id_rol === 1) {
      // Admin: todas las planillas
      const rows = await Planilla.getAll();
      return res.json(rows);
    } else {
      // Empleado: solo sus planillas
      const usuario = await Usuario.getById(user.id_usuario);
      if (!usuario || !usuario.id_empleado)
        return res.status(400).json({ error: 'Usuario no vinculado a empleado' });

      const rows = await Planilla.getByEmpleado(usuario.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    if (err.message === 'Planilla no encontrada') {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

// 🔹 Crear / Calcular planilla (solo admin)
const calcularPlanilla = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede calcular planilla' });

    const {
      id_empleado,
      periodo_inicio,
      periodo_fin,
      horas_extras = 0,
      bonificaciones = 0,
      deducciones = 0,
      fecha_pago,
      prestamos = [],
      dias_trabajados = null,
      dias_descuento = 0,
      monto_descuento_dias = null,
      dias_dobles = 0,
      monto_dias_dobles = null,
      detalles = [],
    } = req.body;

    if (!id_empleado || !periodo_inicio || !periodo_fin) {
      return res.status(400).json({ error: 'Faltan datos requeridos: id_empleado, periodo_inicio y periodo_fin' });
    }

    const fechaPagoFinal = fecha_pago || periodo_fin;

    const planilla = await Planilla.calcularPlanilla({
      id_empleado,
      periodo_inicio,
      periodo_fin,
      horas_extras,
      bonificaciones,
      deducciones,
      fecha_pago: fechaPagoFinal,
      prestamos,
      dias_trabajados,
      dias_descuento,
      monto_descuento_dias,
      dias_dobles,
      monto_dias_dobles,
      detalles,
    });

    return res.status(201).json({
      message: 'Planilla generada correctamente',
      id_planilla: planilla.id_planilla
    });
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ error: err.message });
    }
    return res.status(500).json({ error: err.message });
  }
};

// 🔹 Actualizar planilla (solo admin)
const updatePlanilla = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.id_rol !== 1) return res.status(403).json({ error: 'Solo admin puede actualizar planillas' });

    const id_planilla = parseInt(req.params.id, 10);
    if (isNaN(id_planilla)) return res.status(400).json({ error: 'ID inválido' });

    const { horas_extras = 0, bonificaciones = 0, deducciones = 0, fecha_pago } = req.body;

    await Planilla.update(id_planilla, {
      horas_extras,
      bonificaciones,
      deducciones,
      fecha_pago,
    });

    return res.json({ message: 'Planilla actualizada correctamente' });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getPlanillaAttendance = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo admin puede consultar asistencia para planilla' });
    }

    const { id_empleado, periodo_inicio, periodo_fin } = req.query;

    const empleadoId = Number(id_empleado);
    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      return res.status(400).json({ error: 'id_empleado inválido' });
    }

    if (!periodo_inicio || !periodo_fin) {
      return res.status(400).json({ error: 'periodo_inicio y periodo_fin son requeridos' });
    }

    const inicio = new Date(periodo_inicio);
    const fin = new Date(periodo_fin);

    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) {
      return res.status(400).json({ error: 'Las fechas proporcionadas no son válidas' });
    }

    if (fin < inicio) {
      return res.status(400).json({ error: 'El periodo es inválido: la fecha fin debe ser mayor o igual a la fecha inicio' });
    }

    const empleado = await Empleado.getById(empleadoId);
    if (!empleado) {
      return res.status(404).json({ error: 'Empleado no encontrado' });
    }

    if (empleado.tipo_pago !== 'Diario') {
      return res.json({ dias: 0 });
    }

    const fechas = await Asistencia.getDistinctAttendanceDays(empleadoId, periodo_inicio, periodo_fin);
    const dias = Array.isArray(fechas) ? fechas.length : 0;

    return res.json({ dias, fechas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getPlanillaDetalle = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo admin puede consultar el detalle de la planilla' });
    }

    const id_planilla = parseInt(req.params.id, 10);
    if (Number.isNaN(id_planilla)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const detalles = await DetallePlanilla.getByPlanilla(id_planilla);
    return res.json(detalles);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const exportPlanillaArchivo = async (req, res) => {
  try {
    const user = req.user;
    if (!user || user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo admin puede exportar planillas' });
    }

    const id_planilla = parseInt(req.params.id, 10);
    if (Number.isNaN(id_planilla)) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const formatParam = (req.query.format || 'pdf').toLowerCase();
    const formatMap = new Map([
      ['pdf', 'pdf'],
      ['excel', 'excel'],
      ['xls', 'excel'],
      ['xlsx', 'excel'],
      ['csv', 'excel'],
    ]);
    const format = formatMap.get(formatParam);

    if (!format) {
      return res.status(400).json({ error: 'Formato de exportación no soportado' });
    }

    const planilla = await Planilla.getById(id_planilla);
    if (!planilla) {
      return res.status(404).json({ error: 'Planilla no encontrada' });
    }

    const detalles = await DetallePlanilla.getByPlanilla(id_planilla);

    await ensureExportsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `planilla-${id_planilla}-${timestamp}`;
    const extension = format === 'pdf' ? 'pdf' : 'csv';
    const filename = `${baseName}.${extension}`;
    const filePath = path.join(EXPORTS_DIR, filename);

    if (format === 'pdf') {
      await createPdfFile(filePath, planilla, detalles);
    } else {
      await createCsvFile(filePath, planilla, detalles);
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/files/${filename}`;

    return res.json({ url: publicUrl, filename, format });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getPlanilla,
  calcularPlanilla,
  updatePlanilla,
  getPlanillaAttendance,
  getPlanillaDetalle,
  exportPlanillaArchivo,
};
