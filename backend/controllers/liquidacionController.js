/**
 * Controlador de liquidaciones finales. Coordina la obtención de datos
 * de empleados, genera los comprobantes y exporta la información en
 * múltiples formatos para auditoría y entrega al colaborador.
 */
const fs = require('fs');
const path = require('path');
const Liquidacion = require('../models/Liquidacion');
const Empleado = require('../models/Empleado');
const LiquidacionDetalle = require('../models/LiquidacionDetalle');
const LiquidacionSalarioHistorico = require('../models/LiquidacionSalarioHistorico');
const Usuario = require('../models/Usuario');

const { calcularDetallesAutomaticos, calcularContextoLiquidacion, agruparPlanillaHistoricoPorMes } = require('../utils/liquidacionCalculations');

const { promises: fsPromises } = fs;
const EXPORTS_DIR = path.join(__dirname, '..', 'exports');
const COMPANY_NAME = 'Distribuidora Astua Pirie';
const COMPANY_LEGAL_NAME = 'Inversiones Daring Del Cedral S.R.L';
const COMPANY_JURIDICAL_ID = '3-102-895618';

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

const parseManualDecimal = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(2));
};

const parseManualInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.round(numeric);
};

const mergeEncabezadoManual = (encabezado, overrides) => {
  if (!encabezado || !overrides || typeof overrides !== 'object') {
    return encabezado;
  }

  const result = { ...encabezado };

  const decimalFields = [
    'salario_promedio_mensual',
    'salario_promedio_diario',
    'salario_acumulado',
    'total_pagar',
  ];

  decimalFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(overrides, field)) {
      const parsed = parseManualDecimal(overrides[field]);
      if (parsed !== null) {
        result[field] = parsed;
      }
    }
  });

  const integerFields = ['dias_pendientes_vacaciones', 'dias_preaviso', 'dias_cesantia'];

  integerFields.forEach((field) => {
    if (Object.prototype.hasOwnProperty.call(overrides, field)) {
      const parsed = parseManualInteger(overrides[field]);
      if (parsed !== null) {
        result[field] = parsed;
      }
    }
  });

  return result;
};

const mergeHistoricoManual = (historico, overrides) => {
  if (!overrides || !Array.isArray(overrides) || overrides.length === 0) {
    return historico;
  }
  const sanitized = LiquidacionSalarioHistorico.sanitizeHistorico(overrides);
  return sanitized.length > 0 ? sanitized : historico;
};

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

const currencyFormatter = new Intl.NumberFormat('es-CR', {
  style: 'currency',
  currency: 'CRC',
  minimumFractionDigits: 2,
});

const formatCurrencyCRC = (value, fallback = '₡0.00') => {
  const numero = Number(value);
  if (!Number.isFinite(numero)) {
    return fallback;
  }
  return currencyFormatter.format(numero);
};

const padText = (text, length) => {
  const sanitized = sanitizePdfText(text || '');
  if (sanitized.length >= length) {
    return sanitized.slice(0, length);
  }
  return sanitized + ' '.repeat(length - sanitized.length);
};

const padNumber = (text, length) => {
  const sanitized = sanitizePdfText(text || '');
  if (sanitized.length >= length) {
    return sanitized.slice(0, length);
  }
  return ' '.repeat(length - sanitized.length) + sanitized;
};

const normalizeNumeroEntero = (value) => {
  if (value === null || value === undefined) return null;
  const numero = Number(value);
  if (!Number.isFinite(numero)) return null;
  return Math.max(Math.round(numero), 0);
};

const calcularSalarioPromedioDiarioPorTipoPago = ({ tipoPago, salarioBase }) => {
  const salarioNormalizado = Number(salarioBase);
  if (!Number.isFinite(salarioNormalizado) || salarioNormalizado <= 0) {
    return null;
  }

  const tipoPagoNormalizado = String(tipoPago || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  if (['diario', 'diarios'].includes(tipoPagoNormalizado)) {
    return Number(salarioNormalizado.toFixed(2));
  }

  if (['quincena', 'quincenal', 'quincenales'].includes(tipoPagoNormalizado)) {
    return Number((salarioNormalizado / 15).toFixed(2));
  }

  if (['mensual', 'mensuales'].includes(tipoPagoNormalizado)) {
    return Number((salarioNormalizado / 30).toFixed(2));
  }

  return null;
};

const calcularSalarioPromedioDesdeSalarioBase = ({ tipoPago, salarioBase }) => {
  const salarioNormalizado = Number(salarioBase);
  if (!Number.isFinite(salarioNormalizado) || salarioNormalizado <= 0) {
    return {
      salarioMensual: 0,
      salarioDiario: null,
    };
  }

  const salarioDiario = calcularSalarioPromedioDiarioPorTipoPago({
    tipoPago,
    salarioBase: salarioNormalizado,
  });

  if (salarioDiario !== null) {
    return {
      salarioMensual: Number((salarioDiario * 30).toFixed(2)),
      salarioDiario,
    };
  }

  return {
    salarioMensual: Number(salarioNormalizado.toFixed(2)),
    salarioDiario: Number((salarioNormalizado / 30).toFixed(2)),
  };
};

const calcularPromedioMensualPorDias = (salariosHistoricos = []) => {
  if (!Array.isArray(salariosHistoricos) || salariosHistoricos.length === 0) {
    return null;
  }

  const acumulado = salariosHistoricos.reduce((acc, registro) => {
    const monto = Number(registro?.monto);
    return Number.isFinite(monto) ? acc + monto : acc;
  }, 0);

  const totalDias = salariosHistoricos.reduce((acc, registro) => {
    const dias = Number(registro?.dias);
    return Number.isFinite(dias) && dias > 0 ? acc + dias : acc;
  }, 0);

  const mesesEquivalentes = totalDias > 0 ? totalDias / 30 : salariosHistoricos.length;
  if (!Number.isFinite(mesesEquivalentes) || mesesEquivalentes <= 0) {
    return null;
  }

  const promedioMensual = acumulado / mesesEquivalentes;
  if (!Number.isFinite(promedioMensual) || promedioMensual <= 0) {
    return null;
  }

  return {
    salarioAcumulado: Number(acumulado.toFixed(2)),
    salarioPromedioMensual: Number(promedioMensual.toFixed(2)),
    mesesEquivalentes: Number(mesesEquivalentes.toFixed(4)),
    diasAcumulados: totalDias,
  };
};

const formatPeriodoResumen = (periodo) => {
  if (!periodo) return '';
  if (typeof periodo === 'string' && /^\d{4}-\d{2}$/.test(periodo)) {
    const [year, month] = periodo.split('-').map((segmento) => Number(segmento));
    if (Number.isInteger(year) && Number.isInteger(month)) {
      const date = new Date(year, month - 1, 1);
      return date.toLocaleDateString('es-CR', { month: 'short', year: 'numeric' });
    }
  }
  const parsed = new Date(periodo);
  if (Number.isNaN(parsed.getTime())) return String(periodo);
  return parsed.toLocaleDateString('es-CR', { month: 'short', year: 'numeric' });
};

const buildLiquidacionPdfLines = ({ liquidacion, empleado, detalles, aprobador }) => {
  const lines = [];
  const divider = '-'.repeat(110);
  const titleDivider = '='.repeat(110);

  const nombreCompleto = [liquidacion.nombre, liquidacion.apellido]
    .filter(Boolean)
    .join(' ')
    .trim() || `Colaborador ID ${liquidacion.id_empleado}`;

  const puesto = empleado?.puesto_nombre ? sanitizePdfText(empleado.puesto_nombre) : 'No registrado';
  const cedula = empleado?.cedula ? sanitizePdfText(empleado.cedula) : 'No registrada';
  const salarioPromedio = formatCurrencyCRC(liquidacion.salario_promedio_mensual, 'Sin dato');
  const salarioPromedioDiario = formatCurrencyCRC(liquidacion.salario_promedio_diario, 'Sin dato');
  const salarioAcumulado = formatCurrencyCRC(liquidacion.salario_acumulado, '₡0.00');
  const totales = LiquidacionDetalle.calcularTotales(detalles || []);
  const totalPagar = formatCurrencyCRC(liquidacion.total_pagar ?? totales.total_pagar, '₡0.00');
  const totalIngresos = formatCurrencyCRC(totales.totalIngresos, '₡0.00');
  const totalDescuentos = formatCurrencyCRC(totales.totalDescuentos, '₡0.00');
  const diasVacaciones = normalizeNumeroEntero(liquidacion.dias_pendientes_vacaciones);
  const diasPreaviso = normalizeNumeroEntero(liquidacion.dias_preaviso);
  const diasCesantia = normalizeNumeroEntero(liquidacion.dias_cesantia);
  const historicoSalarios = Array.isArray(liquidacion.salarios_historicos)
    ? liquidacion.salarios_historicos
    : [];

  lines.push(titleDivider);
  lines.push(COMPANY_NAME);
  lines.push(COMPANY_LEGAL_NAME);
  lines.push(`Cédula jurídica: ${COMPANY_JURIDICAL_ID}`);
  lines.push('Constancia de liquidación de prestaciones');
  lines.push(titleDivider);
  lines.push('');

  lines.push(`Liquidación N.º: ${liquidacion.id_liquidacion}`);
  lines.push(`Colaborador: ${sanitizePdfText(nombreCompleto)} (ID ${liquidacion.id_empleado})`);
  lines.push(`Cédula: ${cedula}`);
  lines.push(`Puesto: ${puesto}`);
  const fechaGeneracion =
    formatDateDisplay(liquidacion.fecha_liquidacion || liquidacion.created_at) || '—';

  lines.push(`Fecha de liquidación: ${fechaGeneracion}`);
  lines.push(
    `Periodo liquidado: ${formatDateDisplay(liquidacion.fecha_inicio_periodo) || '—'} al ${
      formatDateDisplay(liquidacion.fecha_fin_periodo) || '—'
    }`,
  );
  if (liquidacion.motivo_liquidacion) {
    wrapText(`Motivo: ${sanitizePdfText(liquidacion.motivo_liquidacion)}`, 95).forEach((linea) =>
      lines.push(linea),
    );
  }
  if (liquidacion.observaciones) {
    wrapText(`Observaciones: ${sanitizePdfText(liquidacion.observaciones)}`, 95).forEach((linea) =>
      lines.push(linea),
    );
  }

  lines.push('');
  lines.push(divider);
  lines.push(`Salario promedio mensual: ${salarioPromedio}`);
  lines.push(`Salario promedio diario: ${salarioPromedioDiario}`);
  lines.push(`Salario acumulado últimos 6 meses: ${salarioAcumulado}`);
  lines.push(`Total de ingresos: ${totalIngresos}`);
  lines.push(`Total de descuentos: ${totalDescuentos}`);
  lines.push(`TOTAL A PAGAR: ${totalPagar}`);
  lines.push(divider);

  if (diasVacaciones !== null || diasPreaviso !== null || diasCesantia !== null) {
    lines.push('Días considerados en el cálculo:');
    if (diasVacaciones !== null) {
      lines.push(`- Vacaciones pendientes: ${diasVacaciones} días`);
    }
    if (diasPreaviso !== null) {
      lines.push(`- Preaviso: ${diasPreaviso} días`);
    }
    if (diasCesantia !== null) {
      lines.push(`- Cesantía: ${diasCesantia} días`);
    }
    lines.push(divider);
  }

  if (historicoSalarios.length > 0) {
    lines.push('Histórico salarial últimos meses:');
    lines.push(padText('Periodo', 20) + padNumber('Monto', 18));
    historicoSalarios.forEach((registro) => {
      const periodoLabel = formatPeriodoResumen(registro.periodo || '') || registro.periodo || '—';
      const monto = formatCurrencyCRC(registro.monto, '₡0.00');
      lines.push(`${padText(periodoLabel, 20)}${padNumber(monto, 18)}`);
    });
    lines.push(divider);
  }

  lines.push('Detalle de conceptos:');
  const headerLine =
    padText('Concepto', 42) + padText('Tipo', 12) + padNumber('Monto calc.', 18) + padNumber('Monto final', 18);
  lines.push(headerLine);
  lines.push(divider);

  if (Array.isArray(detalles) && detalles.length > 0) {
    detalles.forEach((detalle) => {
      const concepto = padText(detalle.concepto || '—', 42);
      const tipo = padText(detalle.tipo === 'DESCUENTO' ? 'Descuento' : 'Ingreso', 12);
      const montoCalculado = padNumber(formatCurrencyCRC(detalle.monto_calculado, '₡0.00'), 18);
      const montoFinal = padNumber(
        formatCurrencyCRC(
          detalle.monto_final !== null && detalle.monto_final !== undefined
            ? detalle.monto_final
            : detalle.monto_calculado,
          '₡0.00',
        ),
        18,
      );
      lines.push(`${concepto}${tipo}${montoCalculado}${montoFinal}`);

      if (detalle.comentario) {
        wrapText(`Comentario: ${sanitizePdfText(detalle.comentario)}`, 95).forEach((linea) =>
          lines.push(`  ${linea}`),
        );
      }
    });
  } else {
    lines.push('No se registran conceptos detallados para esta liquidación.');
  }

  lines.push(divider);
  lines.push('Declaración del colaborador:');
  wrapText(
    'Declaro haber recibido la suma indicada en concepto de liquidación de prestaciones, renunciando a cualquier otra reclamación vinculada a mi relación laboral.',
    95,
  ).forEach((linea) => lines.push(`  ${linea}`));
  lines.push('');
  wrapText(
    'Manifiesto que los montos reflejados corresponden a los conceptos detallados y que he sido informado sobre la forma de cálculo utilizada por la empresa.',
    95,
  ).forEach((linea) => lines.push(`  ${linea}`));
  lines.push('');
  wrapText(
    'Cualquier observación adicional deberá comunicarse por escrito al departamento de Recursos Humanos dentro de los tres días hábiles posteriores a la firma de este documento.',
    95,
  ).forEach((linea) => lines.push(`  ${linea}`));
  lines.push(divider);

  lines.push('Firma del colaborador: ________________________________');
  lines.push('Cédula: ______________________________________________');
  lines.push('Fecha de firma: ____ / ____ / ______');
  lines.push('');
  lines.push('Firma de autorización (RRHH / Dirección): __________________');
  if (aprobador?.nombre || aprobador?.apellido) {
    const nombreAprobador = [aprobador.nombre, aprobador.apellido]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (nombreAprobador) {
      lines.push(`Aprobado por: ${sanitizePdfText(nombreAprobador)} (Usuario ID ${aprobador.id_usuario})`);
    }
  }
  lines.push('Fecha: ____ / ____ / ______');
  lines.push('');
  lines.push('Observaciones internas:');
  lines.push('______________________________________________________________');
  lines.push('______________________________________________________________');
  lines.push('');
  lines.push('Documento generado automáticamente por EmpresaRH.');
  lines.push(titleDivider);

  return lines;
};
const sanitizeText = (value, maxLength) => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  if (text.length > maxLength) return text.slice(0, maxLength);
  return text;
};

const parseDateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().split('T')[0];
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().split('T')[0];
};

const toValidDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const parseId = (value) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

const mergeDetallesAutomaticos = (automaticos, manuales) => {
  if (!Array.isArray(automaticos)) return LiquidacionDetalle.sanitizeDetalles(manuales);

  const manualSanitizados = LiquidacionDetalle.sanitizeDetalles(manuales);
  const resultado = automaticos.map((auto) => {
    const match = manualSanitizados.find(
      (manual) => manual.concepto.toLowerCase() === auto.concepto.toLowerCase()
    );

    if (!match) return auto;

    return {
      ...auto,
      ...match,
      tipo: match.tipo || auto.tipo,
      monto_calculado:
        match.monto_calculado !== undefined && match.monto_calculado !== null
          ? match.monto_calculado
          : auto.monto_calculado,
      monto_final:
        match.monto_final !== undefined && match.monto_final !== null
          ? match.monto_final
          : auto.monto_final,
      editable: match.editable !== undefined ? (match.editable ? 1 : 0) : auto.editable,
      formula_usada: match.formula_usada || auto.formula_usada,
      comentario: match.comentario || auto.comentario,
      id_prestamo: match.id_prestamo || auto.id_prestamo,
    };
  });

  manualSanitizados.forEach((manual) => {
    const exists = automaticos.some(
      (auto) => auto.concepto.toLowerCase() === manual.concepto.toLowerCase()
    );
    if (!exists) {
      resultado.push(manual);
    }
  });

  return resultado;
};

const prepararLiquidacion = async ({
  id_empleado,
  fecha_inicio_periodo,
  fecha_fin_periodo,
  fecha_liquidacion,
  motivo_liquidacion,
  observaciones,
  detalles,
}) => {
  const empleado = await Empleado.getById(id_empleado);
  if (!empleado) {
    const error = new Error('Empleado no encontrado');
    error.statusCode = 404;
    throw error;
  }

  const fechaFin = toValidDate(fecha_fin_periodo) || new Date();
  const fechaIngresoDistribuidora = toValidDate(empleado.fecha_ingreso);

  const fechaInicio =
    fechaIngresoDistribuidora ||
    toValidDate(fecha_inicio_periodo) ||
    new Date(fechaFin.getTime() - 29 * 24 * 60 * 60 * 1000);

  const promedioInfo = await Liquidacion.calcularPromedioSalario(id_empleado, {
    meses: 6,
    fechaReferencia: fechaFin,
    fechaIngreso: empleado.fecha_ingreso,
  });

  const salariosHistoricos = agruparPlanillaHistoricoPorMes(promedioInfo.historico, { maxPeriodos: 6 });
  const promedioHistorico = calcularPromedioMensualPorDias(salariosHistoricos);
  const salarioAcumulado = promedioHistorico?.salarioAcumulado ?? null;
  const salarioBaseAjustado = calcularSalarioPromedioDesdeSalarioBase({
    tipoPago: empleado.tipo_pago,
    salarioBase: empleado.salario_monto,
  });
  const salarioPromedio =
    promedioHistorico?.salarioPromedioMensual ?? salarioBaseAjustado.salarioMensual;

  const contextoLiquidacion = calcularContextoLiquidacion({
    salarioPromedioMensual: salarioPromedio,
    fechaInicio,
    fechaFin,
    fechaIngresoEmpleado: empleado.fecha_ingreso,
  });

  const detallesAutomaticos = calcularDetallesAutomaticos({
    salarioPromedioMensual: salarioPromedio,
    fechaInicio,
    fechaFin,
    fechaIngresoEmpleado: empleado.fecha_ingreso,
    contexto: contextoLiquidacion,
  });

  const salarioDiarioPorTipoPago =
    promedioHistorico && Number.isFinite(promedioHistorico.salarioPromedioMensual)
      ? Number((promedioHistorico.salarioPromedioMensual / 30).toFixed(2))
      : salarioBaseAjustado.salarioDiario;
  const salarioPromedioDiario =
    salarioDiarioPorTipoPago !== null
      ? salarioDiarioPorTipoPago
      : contextoLiquidacion.salarioDiario !== null && contextoLiquidacion.salarioDiario !== undefined
        ? Number(Number(contextoLiquidacion.salarioDiario).toFixed(2))
        : salarioPromedio > 0
          ? Number((salarioPromedio / 30).toFixed(2))
          : null;
  const diasVacaciones = normalizeNumeroEntero(contextoLiquidacion.vacacionesDias);
  const diasPreaviso = normalizeNumeroEntero(contextoLiquidacion.diasPreaviso);
  const diasCesantia = normalizeNumeroEntero(contextoLiquidacion.diasCesantia);

  const detallesCombinados = mergeDetallesAutomaticos(detallesAutomaticos, detalles);
  const detallesSanitizados = LiquidacionDetalle.sanitizeDetalles(detallesCombinados);
  const totales = LiquidacionDetalle.calcularTotales(detallesSanitizados);

  return {
    encabezado: {
      id_empleado,
      empleado_nombre: empleado.nombre,
      empleado_apellido: empleado.apellido,
      empleado_puesto: empleado.puesto_nombre,
      fecha_liquidacion: parseDateValue(fecha_liquidacion) || parseDateValue(fechaFin),
      fecha_inicio_periodo: parseDateValue(fechaInicio),
      fecha_fin_periodo: parseDateValue(fechaFin),
      motivo_liquidacion: sanitizeText(motivo_liquidacion, 300),
      observaciones: sanitizeText(observaciones, 500),
      salario_promedio_mensual: salarioPromedio,
      salario_promedio_diario: salarioPromedioDiario,
      salario_acumulado: salarioAcumulado,
      dias_pendientes_vacaciones: diasVacaciones,
      dias_preaviso: diasPreaviso,
      dias_cesantia: diasCesantia,
      total_pagar: totales.total_pagar,
    },
    detalles: detallesSanitizados,
    totales,
    empleado,
    promedio_planilla: promedioInfo,
    salarios_historicos: salariosHistoricos,
  };
};

const getLiquidaciones = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const rows = await Liquidacion.getAll();

    if (user.id_rol === 1) {
      return res.json(rows);
    }

    const usuarioDb = await Usuario.getById(user.id_usuario);
    if (!usuarioDb || !usuarioDb.id_empleado) {
      return res.status(403).json({ error: 'El usuario no está vinculado a un colaborador' });
    }

    return res.json(rows.filter((row) => row.id_empleado === usuarioDb.id_empleado));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const getLiquidacionById = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identificador inválido' });

    const liquidacion = await Liquidacion.getById(id);
    if (!liquidacion) return res.status(404).json({ error: 'Liquidación no encontrada' });

    if (user.id_rol !== 1) {
      const usuarioDb = await Usuario.getById(user.id_usuario);
      if (!usuarioDb || !usuarioDb.id_empleado || usuarioDb.id_empleado !== liquidacion.id_empleado) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }

    return res.json(liquidacion);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

const previsualizarLiquidacion = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo el administrador puede generar liquidaciones' });

    const id_empleado = parseId(req.body.id_empleado);
    if (!id_empleado) return res.status(400).json({ error: 'Debe indicar el colaborador' });

    const preview = await prepararLiquidacion({
      id_empleado,
      fecha_inicio_periodo: req.body.fecha_inicio_periodo,
      fecha_fin_periodo: req.body.fecha_fin_periodo,
      fecha_liquidacion: req.body.fecha_liquidacion,
      motivo_liquidacion: req.body.motivo_liquidacion,
      observaciones: req.body.observaciones,
      detalles: req.body.detalles,
    });

    return res.json(preview);
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

const crearLiquidacion = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    if (user.id_rol !== 1) return res.status(403).json({ error: 'Solo el administrador puede crear liquidaciones' });

    const id_empleado = parseId(req.body.id_empleado);
    if (!id_empleado) return res.status(400).json({ error: 'Debe indicar el colaborador' });

    const preview = await prepararLiquidacion({
      id_empleado,
      fecha_inicio_periodo: req.body.fecha_inicio_periodo,
      fecha_fin_periodo: req.body.fecha_fin_periodo,
      fecha_liquidacion: req.body.fecha_liquidacion,
      motivo_liquidacion: req.body.motivo_liquidacion,
      observaciones: req.body.observaciones,
      detalles: req.body.detalles,
    });

    const encabezadoAplicado = mergeEncabezadoManual(preview.encabezado, req.body.encabezado_manual);
    const historicosAplicados = mergeHistoricoManual(
      preview.salarios_historicos,
      req.body.salarios_historicos_manual,
    );

    const confirmar = Boolean(req.body.confirmar);
    const id_estado = parseId(req.body.id_estado) || (confirmar ? 2 : 1);
    const aprobado_por = confirmar ? user.id_usuario : null;

    const resultado = await Liquidacion.create({
      id_empleado,
      fecha_liquidacion: encabezadoAplicado.fecha_liquidacion,
      fecha_inicio_periodo: encabezadoAplicado.fecha_inicio_periodo,
      fecha_fin_periodo: encabezadoAplicado.fecha_fin_periodo,
      motivo_liquidacion: encabezadoAplicado.motivo_liquidacion,
      observaciones: encabezadoAplicado.observaciones,
      id_estado,
      aprobado_por,
      salario_promedio_mensual: encabezadoAplicado.salario_promedio_mensual,
      salario_promedio_diario: encabezadoAplicado.salario_promedio_diario,
      salario_acumulado: encabezadoAplicado.salario_acumulado,
      dias_pendientes_vacaciones: encabezadoAplicado.dias_pendientes_vacaciones,
      dias_preaviso: encabezadoAplicado.dias_preaviso,
      dias_cesantia: encabezadoAplicado.dias_cesantia,
      total_pagar: encabezadoAplicado.total_pagar,
      detalles: preview.detalles,
      salarios_historicos: historicosAplicados,
    });

    return res.status(201).json({
      message: 'Liquidación registrada correctamente',
      ...resultado,
    });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

const actualizarLiquidacion = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identificador inválido' });

    const body = req.body || {};

    if (user.id_rol !== 1) {
      const usuarioDb = await Usuario.getById(user.id_usuario);
      if (!usuarioDb || !usuarioDb.id_empleado) {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const liquidacion = await Liquidacion.getById(id);
      if (!liquidacion) return res.status(404).json({ error: 'Liquidación no encontrada' });
      if (liquidacion.id_empleado !== usuarioDb.id_empleado) {
        return res.status(403).json({ error: 'No autorizado' });
      }
      if (body.detalles) {
        return res.status(403).json({ error: 'No autorizado para modificar los detalles' });
      }
    }

    let detallesActualizados = null;
    if (Array.isArray(body.detalles)) {
      detallesActualizados = LiquidacionDetalle.sanitizeDetalles(body.detalles);
    }

    const estadoParsed = parseId(body.id_estado);
    const aprobadoPorParsed = parseId(body.aprobado_por);

    const resultado = await Liquidacion.update(id, {
      fecha_liquidacion: body.fecha_liquidacion,
      fecha_inicio_periodo: body.fecha_inicio_periodo,
      fecha_fin_periodo: body.fecha_fin_periodo,
      motivo_liquidacion: body.motivo_liquidacion,
      observaciones: body.observaciones,
      id_estado: estadoParsed,
      aprobado_por: aprobadoPorParsed,
      salario_promedio_mensual: body.salario_promedio_mensual,
      salario_promedio_diario: body.salario_promedio_diario,
      salario_acumulado: body.salario_acumulado,
      dias_pendientes_vacaciones: body.dias_pendientes_vacaciones,
      dias_preaviso: body.dias_preaviso,
      dias_cesantia: body.dias_cesantia,
      total_pagar: body.total_pagar,
      detalles: detallesActualizados,
      salarios_historicos: body.salarios_historicos,
    });

    return res.json({ message: 'Liquidación actualizada correctamente', ...resultado });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

const exportLiquidacionPdf = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identificador inválido' });

    const liquidacion = await Liquidacion.getById(id);
    if (!liquidacion) return res.status(404).json({ error: 'Liquidación no encontrada' });

    if (user.id_rol !== 1) {
      const usuarioDb = await Usuario.getById(user.id_usuario);
      if (!usuarioDb || !usuarioDb.id_empleado || usuarioDb.id_empleado !== liquidacion.id_empleado) {
        return res.status(403).json({ error: 'No autorizado' });
      }
    }

    if (Number(liquidacion.id_estado) !== 2) {
      return res.status(400).json({ error: 'El documento solo está disponible para liquidaciones confirmadas' });
    }

    await ensureExportsDir();

    const empleado = await Empleado.getById(liquidacion.id_empleado);
    const aprobador = liquidacion.aprobado_por ? await Usuario.getById(liquidacion.aprobado_por) : null;
    const detalles = Array.isArray(liquidacion.detalles) ? liquidacion.detalles : [];

    const lines = buildLiquidacionPdfLines({
      liquidacion,
      empleado,
      detalles,
      aprobador,
    });

    const pages = chunkArray(lines, 40).map((pageLines) => buildPdfContentStream(pageLines));
    const pdfBuffer = buildPdfBuffer(pages);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `liquidacion-${liquidacion.id_liquidacion}-${timestamp}.pdf`;
    const filePath = path.join(EXPORTS_DIR, filename);

    await fsPromises.writeFile(filePath, pdfBuffer);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const publicUrl = `${baseUrl}/files/${filename}`;

    return res.json({ url: publicUrl, filename, format: 'pdf' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getLiquidaciones,
  getLiquidacionById,
  previsualizarLiquidacion,
  crearLiquidacion,
  actualizarLiquidacion,
  exportLiquidacionPdf,
};
