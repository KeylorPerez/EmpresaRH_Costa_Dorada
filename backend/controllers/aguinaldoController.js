/**
 * Controlador de aguinaldos. Calcula y exporta los pagos anuales,
 * además de exponer los listados en diferentes formatos descargables.
 */
const fs = require('fs');
const path = require('path');
const Aguinaldo = require('../models/Aguinaldo');
const Usuario = require('../models/Usuario');

const { promises: fsPromises } = fs;
const EXPORTS_DIR = path.join(__dirname, '..', 'exports');

const COMPANY_NAME = 'Distribuidora Astua Pirie';
const EMPLOYER_NAME = 'Inversiones Daring Del Cedral';

const ensureExportsDir = async () => {
  if (!fs.existsSync(EXPORTS_DIR)) {
    await fsPromises.mkdir(EXPORTS_DIR, { recursive: true });
  }
};

const formatDateValue = (value) => {
  if (!value) return '';
  if (value instanceof Date) {
    const year = value.getUTCFullYear();
    const month = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
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
      const postamble = Buffer.from('\nendstream\nendobj\n', 'ascii');
      bodyBuffer = Buffer.concat([preamble, streamBuffer, postamble]);
    } else {
      const objectBody = obj === null ? 'null' : obj;
      bodyBuffer = Buffer.from(`${objectBody}\nendobj\n`, 'ascii');
    }
    const objectBuffer = Buffer.concat([Buffer.from(objectHeader, 'ascii'), bodyBuffer]);
    buffers.push(objectBuffer);
    offset += objectBuffer.length;
  });

  const xrefStart = offset;
  const xrefHeader = `xref\n0 ${objects.length + 1}\n`;
  buffers.push(Buffer.from(xrefHeader, 'ascii'));
  let xrefBody = '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    const position = xrefPositions[i];
    xrefBody += `${String(position).padStart(10, '0')} 00000 n \n`;
  }
  buffers.push(Buffer.from(xrefBody, 'ascii'));
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  buffers.push(Buffer.from(trailer, 'ascii'));

  return Buffer.concat(buffers);
};

const formatCurrencyCRC = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return '₡0.00';
  return `₡${number.toFixed(2)}`;
};

const buildAguinaldoPdfLines = (registro) => {
  const lines = [];
  const divider = ''.padEnd(95, '-');

  const nombreEmpleado = sanitizePdfText(
    `${registro.nombre || ''} ${registro.apellido || ''}`.trim() || 'Empleado'
  );

  lines.push('CONSTANCIA DE PAGO DE AGUINALDO');
  lines.push(divider);
  lines.push(`Empresa: ${sanitizePdfText(COMPANY_NAME)}`);
  lines.push(`Patrono: ${sanitizePdfText(EMPLOYER_NAME)}`);
  lines.push(divider);

  lines.push(`Colaborador: ${nombreEmpleado} (ID ${registro.id_empleado})`);
  if (registro.cedula) {
    lines.push(`Cédula: ${sanitizePdfText(registro.cedula)}`);
  }
  if (registro.email) {
    lines.push(`Correo: ${sanitizePdfText(registro.email)}`);
  }
  lines.push(`Año de cálculo: ${registro.anio}`);

  const periodoInicio = formatDateDisplay(registro.fecha_inicio_periodo) || '—';
  const periodoFin = formatDateDisplay(registro.fecha_fin_periodo) || '—';
  lines.push(`Periodo evaluado: ${periodoInicio} al ${periodoFin}`);

  const fechaCalculo = formatDateDisplay(registro.fecha_calculo) || '—';
  lines.push(`Fecha de cálculo: ${fechaCalculo}`);
  lines.push(`Salario promedio reconocido: ${formatCurrencyCRC(registro.salario_promedio)}`);
  lines.push(`Monto de aguinaldo calculado: ${formatCurrencyCRC(registro.monto_aguinaldo)}`);
  lines.push(`Estado de pago: ${registro.pagado ? 'Pagado' : 'Pendiente'}`);
  lines.push(divider);

  const observacion = sanitizePdfText(registro.observacion || 'Sin observaciones adicionales.');
  lines.push('Observaciones:');
  wrapText(observacion, 95).forEach((line) => lines.push(`  ${line}`));
  lines.push(divider);

  const acknowledgementText =
    'Mediante la presente constancia, el colaborador confirma que ha recibido la información del cálculo del aguinaldo correspondiente al periodo indicado y reconoce el monto señalado.';
  wrapText(acknowledgementText, 95).forEach((line) => lines.push(line));
  wrapText('Se firma para los efectos legales correspondientes.', 95).forEach((line) =>
    lines.push(line)
  );
  lines.push('');
  lines.push('Firma del colaborador: ________________________________');
  lines.push('Fecha de firma: ____ / ____ / ______');
  lines.push('');
  lines.push('Firma de la empresa: __________________________________');
  lines.push('Fecha: ____ / ____ / ______');

  return lines;
};

const createAguinaldoPdf = async (filePath, registro) => {
  const lines = buildAguinaldoPdfLines(registro);
  const pages = chunkArray(lines, 40).map((pageLines) => buildPdfContentStream(pageLines));
  const pdfBuffer = buildPdfBuffer(pages);
  await fsPromises.writeFile(filePath, pdfBuffer);
};

const getAguinaldos = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (user.id_rol === 1) {
      const rows = await Aguinaldo.getAll();
      return res.json(rows);
    }

    const usuario = await Usuario.getById(user.id_usuario);
    if (!usuario || !usuario.id_empleado) {
      return res.status(400).json({ error: 'Usuario no vinculado a un empleado' });
    }

    const rows = await Aguinaldo.getByEmpleado(usuario.id_empleado);
    return res.json(rows);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

const construirParametrosCalculo = (req) => {
  const { id_empleado, anio } = req.body;
  const empleadoId = Number(id_empleado);
  const anioNumero = Number(anio);

  if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
    const error = new Error('id_empleado inválido');
    error.statusCode = 400;
    throw error;
  }

  if (!Number.isInteger(anioNumero) || anioNumero < 2000) {
    const error = new Error('Año inválido para el cálculo');
    error.statusCode = 400;
    throw error;
  }

  const metodoRaw =
    typeof req.body?.metodo === 'string' ? req.body.metodo.trim().toLowerCase() : 'automatico';
  const metodo = metodoRaw === 'manual' ? 'manual' : 'automatico';

  const incluirBonificaciones =
    req.body?.incluir_bonificaciones !== undefined
      ? Boolean(req.body.incluir_bonificaciones)
      : true;
  const incluirHorasExtra =
    req.body?.incluir_horas_extra !== undefined
      ? Boolean(req.body.incluir_horas_extra)
      : false;

  const parseFecha = (valor) => {
    if (!valor) return null;

    if (typeof valor === 'string') {
      const match = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (match) {
        const [, year, month, day] = match;
        const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
        if (!Number.isNaN(date.getTime())) {
          return date;
        }
      }
    }

    const fecha = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
    if (Number.isNaN(fecha.getTime())) return null;

    return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  };

  const fechaInicioPeriodo = parseFecha(req.body?.fecha_inicio_periodo);
  const fechaFinPeriodo = parseFecha(req.body?.fecha_fin_periodo);

  if (fechaInicioPeriodo && fechaFinPeriodo && fechaFinPeriodo < fechaInicioPeriodo) {
    const error = new Error('La fecha fin del periodo no puede ser anterior a la fecha de inicio');
    error.statusCode = 400;
    throw error;
  }

  const observacionTexto = (() => {
    if (typeof req.body?.observacion !== 'string') return null;
    const trimmed = req.body.observacion.trim();
    if (!trimmed) return null;
    return trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed;
  })();

  let salarioQuincenalManual = null;
  let fechaIngresoManual = null;
  let tipoPagoManual = null;
  let promedioManual = null;

  if (metodo === 'manual') {
    const salarioNumero = Number(req.body?.salario_quincenal);
    if (!Number.isFinite(salarioNumero) || salarioNumero <= 0) {
      const error = new Error('Salario quincenal inválido para el cálculo manual');
      error.statusCode = 400;
      throw error;
    }

    salarioQuincenalManual = salarioNumero;

    if (req.body?.fecha_ingreso) {
      const fechaIngreso = new Date(req.body.fecha_ingreso);
      if (Number.isNaN(fechaIngreso.getTime())) {
        const error = new Error('Fecha de ingreso inválida');
        error.statusCode = 400;
        throw error;
      }
      fechaIngresoManual = fechaIngreso.toISOString();
    }

    if (req.body?.tipo_pago) {
      tipoPagoManual = String(req.body.tipo_pago);
    }

    const montoPromedioDiario = Number(req.body?.monto_promedio_diario);
    const diasPromedioDiario = Number(req.body?.dias_promedio_diario);
    const periodoPromedio = (() => {
      const texto = String(req.body?.periodo_promedio_diario || '')
        .trim()
        .toLowerCase();
      return texto === 'mes' ? 'mes' : 'quincena';
    })();

    const promedioManualData = {};

    if (Number.isFinite(montoPromedioDiario) && montoPromedioDiario > 0) {
      promedioManualData.monto = Number(montoPromedioDiario.toFixed(2));
    }

    if (Number.isFinite(diasPromedioDiario) && diasPromedioDiario > 0) {
      promedioManualData.dias = Number(diasPromedioDiario.toFixed(2));
    }

    if (Object.keys(promedioManualData).length > 0) {
      promedioManual = {
        ...promedioManualData,
        periodo: periodoPromedio,
      };
    }
  }

  return {
    empleadoId,
    anioNumero,
    metodo,
    incluirBonificaciones,
    incluirHorasExtra,
    salarioQuincenalManual,
    fechaIngresoManual,
    tipoPagoManual,
    promedioManual,
    fechaInicioPeriodo,
    fechaFinPeriodo,
    observacionTexto,
  };
};

const calcularAguinaldo = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo administradores pueden calcular aguinaldos' });
    }

    const parametros = construirParametrosCalculo(req);

    const aguinaldo = await Aguinaldo.calcularYGuardar({
      id_empleado: parametros.empleadoId,
      anio: parametros.anioNumero,
      metodo: parametros.metodo,
      incluirBonificaciones: parametros.incluirBonificaciones,
      incluirHorasExtra: parametros.incluirHorasExtra,
      salarioQuincenal: parametros.salarioQuincenalManual,
      fechaIngresoManual: parametros.fechaIngresoManual,
      tipoPagoManual: parametros.tipoPagoManual,
      promedioManual: parametros.promedioManual,
      fechaInicioPeriodo: parametros.fechaInicioPeriodo,
      fechaFinPeriodo: parametros.fechaFinPeriodo,
      observacion: parametros.observacionTexto,
    });

    return res.status(201).json({
      message: 'Aguinaldo calculado correctamente',
      aguinaldo,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

const previsualizarAguinaldo = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo administradores pueden calcular aguinaldos' });
    }

    const parametros = construirParametrosCalculo(req);

    const preview = await Aguinaldo.previsualizar({
      id_empleado: parametros.empleadoId,
      anio: parametros.anioNumero,
      metodo: parametros.metodo,
      incluirBonificaciones: parametros.incluirBonificaciones,
      incluirHorasExtra: parametros.incluirHorasExtra,
      salarioQuincenal: parametros.salarioQuincenalManual,
      fechaIngresoManual: parametros.fechaIngresoManual,
      tipoPagoManual: parametros.tipoPagoManual,
      promedioManual: parametros.promedioManual,
      fechaInicioPeriodo: parametros.fechaInicioPeriodo,
      fechaFinPeriodo: parametros.fechaFinPeriodo,
      observacion: parametros.observacionTexto,
    });

    return res.json({
      message: 'Previsualización generada correctamente',
      preview,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

const actualizarAguinaldo = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo administradores pueden actualizar aguinaldos' });
    }

    const id_aguinaldo = Number(req.params.id);
    if (!Number.isInteger(id_aguinaldo) || id_aguinaldo <= 0) {
      return res.status(400).json({ error: 'Identificador de aguinaldo inválido' });
    }

    const existente = await Aguinaldo.getById(id_aguinaldo);
    if (!existente) {
      return res.status(404).json({ error: 'Aguinaldo no encontrado' });
    }

    const campos = {};
    let hayCambios = false;

    const tienePropiedad = (prop) => Object.prototype.hasOwnProperty.call(req.body, prop);

    if (tienePropiedad('monto_aguinaldo')) {
      const monto = Number(req.body.monto_aguinaldo);
      if (!Number.isFinite(monto) || monto < 0) {
        return res.status(400).json({ error: 'Monto de aguinaldo inválido' });
      }
      campos.monto_aguinaldo = Number(monto.toFixed(2));
      hayCambios = true;
    }

    if (tienePropiedad('salario_promedio')) {
      const salario = Number(req.body.salario_promedio);
      if (!Number.isFinite(salario) || salario < 0) {
        return res.status(400).json({ error: 'Salario promedio inválido' });
      }
      campos.salario_promedio = Number(salario.toFixed(2));
      hayCambios = true;
    }

    const parseFecha = (valor) => {
      if (valor === null || valor === undefined || valor === '') {
        return null;
      }

      if (typeof valor === 'string') {
        const match = valor.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (match) {
          const [, year, month, day] = match;
          const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
          if (!Number.isNaN(date.getTime())) {
            return date;
          }
        }
      }

      const fecha = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
      if (Number.isNaN(fecha.getTime())) {
        return null;
      }

      return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
    };

    const fechaInicioActual = parseFecha(existente.fecha_inicio_periodo);
    const fechaFinActual = parseFecha(existente.fecha_fin_periodo);

    let fechaInicioEvaluar = fechaInicioActual;
    let fechaFinEvaluar = fechaFinActual;

    if (tienePropiedad('fecha_inicio_periodo')) {
      const fechaInicio = parseFecha(req.body.fecha_inicio_periodo);
      if (!fechaInicio) {
        return res.status(400).json({ error: 'Fecha de inicio del periodo inválida' });
      }
      campos.fecha_inicio_periodo = fechaInicio;
      fechaInicioEvaluar = fechaInicio;
      hayCambios = true;
    }

    if (tienePropiedad('fecha_fin_periodo')) {
      const fechaFin = parseFecha(req.body.fecha_fin_periodo);
      if (!fechaFin) {
        return res.status(400).json({ error: 'Fecha de fin del periodo inválida' });
      }
      campos.fecha_fin_periodo = fechaFin;
      fechaFinEvaluar = fechaFin;
      hayCambios = true;
    }

    if (fechaInicioEvaluar && fechaFinEvaluar && fechaFinEvaluar < fechaInicioEvaluar) {
      return res.status(400).json({
        error: 'La fecha fin del periodo no puede ser anterior a la fecha de inicio',
      });
    }

    if (tienePropiedad('observacion')) {
      const valor = req.body.observacion;
      if (valor === null || valor === undefined) {
        campos.observacion = null;
      } else if (typeof valor === 'string') {
        const trimmed = valor.trim();
        campos.observacion = trimmed ? (trimmed.length > 200 ? trimmed.slice(0, 200) : trimmed) : null;
      } else {
        campos.observacion = null;
      }
      hayCambios = true;
    }

    if (!hayCambios) {
      return res.status(400).json({ error: 'No se recibieron cambios para actualizar' });
    }

    const aguinaldoActualizado = await Aguinaldo.actualizar(id_aguinaldo, campos);
    if (!aguinaldoActualizado) {
      return res.status(404).json({ error: 'Aguinaldo no encontrado' });
    }

    return res.json({ message: 'Aguinaldo actualizado correctamente', aguinaldo: aguinaldoActualizado });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

const actualizarPago = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo administradores pueden actualizar el pago del aguinaldo' });
    }

    const id_aguinaldo = Number(req.params.id);
    if (!Number.isInteger(id_aguinaldo) || id_aguinaldo <= 0) {
      return res.status(400).json({ error: 'Identificador de aguinaldo inválido' });
    }

    const pagado = Boolean(req.body?.pagado);
    const aguinaldoActualizado = await Aguinaldo.actualizarPago(id_aguinaldo, pagado);

    const mensaje = pagado
      ? 'Aguinaldo marcado como pagado'
      : 'El estado de pago del aguinaldo se actualizó correctamente';

    return res.json({ message: mensaje, aguinaldo: aguinaldoActualizado });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

const exportAguinaldoPdf = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const id_aguinaldo = Number(req.params.id);
    if (!Number.isInteger(id_aguinaldo) || id_aguinaldo <= 0) {
      return res.status(400).json({ error: 'Identificador de aguinaldo inválido' });
    }

    const aguinaldo = await Aguinaldo.getById(id_aguinaldo);
    if (!aguinaldo) {
      return res.status(404).json({ error: 'Aguinaldo no encontrado' });
    }

    if (user.id_rol !== 1) {
      const usuarioDb = await Usuario.getById(user.id_usuario);
      if (!usuarioDb || !usuarioDb.id_empleado || usuarioDb.id_empleado !== aguinaldo.id_empleado) {
        return res.status(403).json({ error: 'No autorizado para acceder a este documento' });
      }
    }

    await ensureExportsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `aguinaldo-${aguinaldo.id_aguinaldo}-${timestamp}.pdf`;
    const filePath = path.join(EXPORTS_DIR, filename);

    await createAguinaldoPdf(filePath, aguinaldo);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/files/${filename}`;

    return res.json({ url: publicUrl, filename, format: 'pdf' });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

module.exports = {
  getAguinaldos,
  calcularAguinaldo,
  previsualizarAguinaldo,
  actualizarAguinaldo,
  actualizarPago,
  exportAguinaldoPdf,
};
