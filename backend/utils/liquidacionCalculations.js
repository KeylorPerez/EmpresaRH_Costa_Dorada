/**
 * Utilidades para cálculo de liquidaciones laborales. Incluye helpers
 * de fechas y funciones matemáticas reutilizadas por los controladores.
 */
const differenceInDays = (a, b) => {
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) {
    return 0;
  }
  const diff = dateB.getTime() - dateA.getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
};

const differenceInMonths = (a, b) => {
  const start = new Date(a);
  const end = new Date(b);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return 0;
  }

  const years = end.getFullYear() - start.getFullYear();
  const months = end.getMonth() - start.getMonth();
  const totalMonths = years * 12 + months;

  const dayDifference = end.getDate() - start.getDate();
  return totalMonths + dayDifference / 30;
};

const clampNumber = (value, min = 0) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return min;
  if (numeric < min) return min;
  return numeric;
};

const roundCurrency = (value) => {
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return Number(numeric.toFixed(2));
};

const calcularDiasCesantia = (mesesAntiguedad) => {
  if (!Number.isFinite(mesesAntiguedad) || mesesAntiguedad <= 0) return 0;
  const tabla = [
    { max: 3, dias: 7 },
    { max: 6, dias: 14 },
    { max: 12, dias: 19.5 },
    { max: 24, dias: 20 },
    { max: 36, dias: 21 },
    { max: 48, dias: 22 },
    { max: 60, dias: 23 },
    { max: 72, dias: 24 },
    { max: 84, dias: 25 },
    { max: 96, dias: 26 },
    { max: 108, dias: 27 },
    { max: 120, dias: 28 },
    { max: 132, dias: 29 },
    { max: 144, dias: 30 },
  ];

  for (const tramo of tabla) {
    if (mesesAntiguedad <= tramo.max) {
      return tramo.dias;
    }
  }

  return 30;
};

const calcularDiasPreaviso = (mesesAntiguedad) => {
  if (!Number.isFinite(mesesAntiguedad) || mesesAntiguedad <= 0) return 0;
  if (mesesAntiguedad < 3) return 7;
  if (mesesAntiguedad < 6) return 15;
  return 30;
};

const calcularContextoLiquidacion = ({
  salarioPromedioMensual,
  fechaInicio,
  fechaFin,
  fechaIngresoEmpleado,
}) => {
  const salarioPromedio = roundCurrency(salarioPromedioMensual);

  const fechaFinValid = (() => {
    if (!fechaFin) return new Date();
    const parsed = new Date(fechaFin);
    return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  })();

  const fechaInicioValid = (() => {
    if (!fechaInicio) return null;
    const parsed = new Date(fechaInicio);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  })();

  const fechaIngreso = (() => {
    if (!fechaIngresoEmpleado) return null;
    const parsed = new Date(fechaIngresoEmpleado);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  })();

  const diasPeriodo = (() => {
    if (fechaInicioValid && fechaFinValid) {
      const dias = differenceInDays(fechaInicioValid, fechaFinValid) + 1;
      return dias > 0 ? dias : 30;
    }
    return 30;
  })();

  const mesesPeriodo = diasPeriodo / 30;

  const salarioDiario = salarioPromedio > 0 ? salarioPromedio / 30 : 0;

  const aguinaldoMonto = roundCurrency((salarioPromedio / 12) * Math.max(mesesPeriodo, 1));
  const vacacionesDias = roundCurrency(mesesPeriodo * 1.25);
  const vacacionesMonto = roundCurrency(salarioDiario * vacacionesDias);

  let diasCesantia = 0;
  let cesantiaMonto = 0;
  let diasPreaviso = 0;
  let preavisoMonto = 0;
  let mesesAntiguedad = null;

  if (fechaIngreso) {
    mesesAntiguedad = differenceInMonths(fechaIngreso, fechaFinValid) * 1;
    diasCesantia = calcularDiasCesantia(mesesAntiguedad);
    cesantiaMonto = roundCurrency(salarioDiario * diasCesantia);
    diasPreaviso = calcularDiasPreaviso(mesesAntiguedad);
    preavisoMonto = roundCurrency(salarioDiario * diasPreaviso);
  }

  return {
    salarioPromedio,
    salarioDiario: roundCurrency(salarioDiario),
    fechaInicioCalculado: fechaInicioValid || fechaFinValid,
    fechaFinCalculado: fechaFinValid,
    diasPeriodo,
    mesesPeriodo,
    aguinaldoMonto,
    vacacionesDias,
    vacacionesMonto,
    diasCesantia,
    cesantiaMonto,
    diasPreaviso,
    preavisoMonto,
    mesesAntiguedad,
  };
};

const calcularDetallesAutomaticos = ({
  salarioPromedioMensual,
  fechaInicio,
  fechaFin,
  fechaIngresoEmpleado,
  contexto = null,
}) => {
  const detalles = [];
  const calculoBase =
    contexto ||
    calcularContextoLiquidacion({
      salarioPromedioMensual,
      fechaInicio,
      fechaFin,
      fechaIngresoEmpleado,
    });

  const salarioPromedio = calculoBase.salarioPromedio;
  const salarioDiario = calculoBase.salarioDiario;

  detalles.push({
    concepto: 'Deducción salario pendiente',
    tipo: 'DESCUENTO',
    monto_calculado: 0,
    monto_final: 0,
    editable: true,
    formula_usada:
      'Salario promedio diario x días pendientes (valor editable, predeterminado en 0)',
  });

  const aguinaldo = calculoBase.aguinaldoMonto;
  detalles.push({
    concepto: 'Aguinaldo proporcional',
    tipo: 'INGRESO',
    monto_calculado: aguinaldo,
    monto_final: aguinaldo,
    editable: true,
    formula_usada: 'Salario promedio mensual / 12 x meses del periodo',
  });

  const vacacionesDias = calculoBase.vacacionesDias;
  const vacacionesMonto = calculoBase.vacacionesMonto;
  detalles.push({
    concepto: 'Vacaciones no gozadas',
    tipo: 'INGRESO',
    monto_calculado: vacacionesMonto,
    monto_final: vacacionesMonto,
    editable: true,
    formula_usada: '1.25 días por mes laborado x salario diario promedio',
  });

  if (calculoBase.mesesAntiguedad !== null) {
    const diasCesantia = calculoBase.diasCesantia;
    const cesantiaMonto = calculoBase.cesantiaMonto;
    detalles.push({
      concepto: 'Cesantía',
      tipo: 'INGRESO',
      monto_calculado: cesantiaMonto,
      monto_final: cesantiaMonto,
      editable: true,
      formula_usada: 'Días de cesantía según antigüedad x salario diario promedio',
    });

    const diasPreaviso = calculoBase.diasPreaviso;
    const preavisoMonto = calculoBase.preavisoMonto;

    detalles.push({
      concepto: 'Preaviso',
      tipo: 'INGRESO',
      monto_calculado: preavisoMonto,
      monto_final: preavisoMonto,
      editable: true,
      formula_usada: 'Días de preaviso según antigüedad x salario diario promedio',
    });
  }

  return detalles;
};

const formatPeriodoClave = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const agruparPlanillaHistoricoPorMes = (historico = [], { maxPeriodos = 6 } = {}) => {
  if (!Array.isArray(historico) || historico.length === 0) {
    return [];
  }

  const periodos = [];
  const acumuladoPorPeriodo = new Map();

  historico.forEach((row) => {
    const periodo =
      formatPeriodoClave(row?.periodo_fin) ||
      formatPeriodoClave(row?.fecha_pago) ||
      formatPeriodoClave(row?.periodo_inicio);

    if (!periodo) return;

    const baseMonto = (() => {
      if (row?.pago_neto !== null && row?.pago_neto !== undefined) {
        const numero = Number(row.pago_neto);
        return Number.isFinite(numero) ? numero : null;
      }
      if (row?.salario_bruto !== null && row?.salario_bruto !== undefined) {
        const numero = Number(row.salario_bruto);
        return Number.isFinite(numero) ? numero : null;
      }
      if (row?.monto !== undefined) {
        const numero = Number(row.monto);
        return Number.isFinite(numero) ? numero : null;
      }
      return null;
    })();

    if (baseMonto === null) return;

    const diasPeriodo = (() => {
      if (!row?.periodo_inicio || !row?.periodo_fin) return 0;
      const inicio = new Date(row.periodo_inicio);
      const fin = new Date(row.periodo_fin);
      if (Number.isNaN(inicio.getTime()) || Number.isNaN(fin.getTime())) return 0;
      const dias = differenceInDays(inicio, fin) + 1;
      return dias > 0 ? dias : 0;
    })();

    if (!acumuladoPorPeriodo.has(periodo)) {
      acumuladoPorPeriodo.set(periodo, { periodo, monto: 0, dias: 0 });
      periodos.push(periodo);
    }

    const registro = acumuladoPorPeriodo.get(periodo);
    registro.monto = roundCurrency((registro.monto || 0) + baseMonto);
    if (Number.isFinite(diasPeriodo) && diasPeriodo > 0) {
      registro.dias += diasPeriodo;
    }
  });

  const items = periodos.map((periodo) => acumuladoPorPeriodo.get(periodo));
  items.sort((a, b) => b.periodo.localeCompare(a.periodo));
  return items.slice(0, maxPeriodos);
};

module.exports = {
  differenceInDays,
  differenceInMonths,
  clampNumber,
  roundCurrency,
  calcularDiasCesantia,
  calcularDiasPreaviso,
  calcularDetallesAutomaticos,
  calcularContextoLiquidacion,
  agruparPlanillaHistoricoPorMes,
};
