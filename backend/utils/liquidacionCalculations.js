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

const calcularDetallesAutomaticos = ({
  salarioPromedioMensual,
  fechaInicio,
  fechaFin,
  fechaIngresoEmpleado,
}) => {
  const detalles = [];
  const salarioPromedio = roundCurrency(salarioPromedioMensual);

  const fechaInicioValid = fechaInicio ? new Date(fechaInicio) : null;
  const fechaFinValid = fechaFin ? new Date(fechaFin) : new Date();
  const fechaIngreso = fechaIngresoEmpleado ? new Date(fechaIngresoEmpleado) : null;

  const diasPeriodo = (() => {
    if (fechaInicioValid && fechaFinValid) {
      const dias = differenceInDays(fechaInicioValid, fechaFinValid) + 1;
      return dias > 0 ? dias : 30;
    }
    return 30;
  })();

  const mesesPeriodo = diasPeriodo / 30;

  const salarioDiario = salarioPromedio > 0 ? salarioPromedio / 30 : 0;
  const salarioPendiente = roundCurrency(salarioDiario * diasPeriodo);

  detalles.push({
    concepto: 'Salario pendiente',
    tipo: 'INGRESO',
    monto_calculado: salarioPendiente,
    monto_final: salarioPendiente,
    editable: true,
    formula_usada: 'Salario promedio diario x días pendientes',
  });

  const aguinaldo = roundCurrency((salarioPromedio / 12) * Math.max(mesesPeriodo, 1));
  detalles.push({
    concepto: 'Aguinaldo proporcional',
    tipo: 'INGRESO',
    monto_calculado: aguinaldo,
    monto_final: aguinaldo,
    editable: true,
    formula_usada: 'Salario promedio mensual / 12 x meses del periodo',
  });

  const vacacionesDias = roundCurrency(mesesPeriodo * 1.25);
  const vacacionesMonto = roundCurrency(salarioDiario * vacacionesDias);
  detalles.push({
    concepto: 'Vacaciones no gozadas',
    tipo: 'INGRESO',
    monto_calculado: vacacionesMonto,
    monto_final: vacacionesMonto,
    editable: true,
    formula_usada: '1.25 días por mes laborado x salario diario promedio',
  });

  if (fechaIngreso) {
    const mesesAntiguedad = differenceInMonths(fechaIngreso, fechaFinValid) * 1;
    const diasCesantia = calcularDiasCesantia(mesesAntiguedad);
    const cesantiaMonto = roundCurrency(salarioDiario * diasCesantia);

    detalles.push({
      concepto: 'Cesantía',
      tipo: 'INGRESO',
      monto_calculado: cesantiaMonto,
      monto_final: cesantiaMonto,
      editable: true,
      formula_usada: 'Días de cesantía según antigüedad x salario diario promedio',
    });

    const diasPreaviso = calcularDiasPreaviso(mesesAntiguedad);
    const preavisoMonto = roundCurrency(salarioDiario * diasPreaviso);

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

module.exports = {
  differenceInDays,
  differenceInMonths,
  clampNumber,
  roundCurrency,
  calcularDiasCesantia,
  calcularDiasPreaviso,
  calcularDetallesAutomaticos,
};
