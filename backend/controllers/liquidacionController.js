const Liquidacion = require('../models/Liquidacion');
const Empleado = require('../models/Empleado');
const LiquidacionDetalle = require('../models/LiquidacionDetalle');
const Usuario = require('../models/Usuario');
const { calcularDetallesAutomaticos } = require('../utils/liquidacionCalculations');

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
  });

  const salarioPromedio =
    promedioInfo.promedio !== null && promedioInfo.promedio !== undefined
      ? promedioInfo.promedio
      : Number(empleado.salario_monto || 0);

  const detallesAutomaticos = calcularDetallesAutomaticos({
    salarioPromedioMensual: salarioPromedio,
    fechaInicio: fechaInicio,
    fechaFin: fechaFin,
    fechaIngresoEmpleado: empleado.fecha_ingreso,
  });

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
      salario_acumulado: totales.totalIngresos,
      total_pagar: totales.total_pagar,
    },
    detalles: detallesSanitizados,
    totales,
    empleado,
    promedio_planilla: promedioInfo,
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

    const confirmar = Boolean(req.body.confirmar);
    const id_estado = parseId(req.body.id_estado) || (confirmar ? 2 : 1);
    const aprobado_por = confirmar ? user.id_usuario : null;

    const resultado = await Liquidacion.create({
      id_empleado,
      fecha_liquidacion: preview.encabezado.fecha_liquidacion,
      fecha_inicio_periodo: preview.encabezado.fecha_inicio_periodo,
      fecha_fin_periodo: preview.encabezado.fecha_fin_periodo,
      motivo_liquidacion: preview.encabezado.motivo_liquidacion,
      observaciones: preview.encabezado.observaciones,
      id_estado,
      aprobado_por,
      salario_promedio_mensual: preview.encabezado.salario_promedio_mensual,
      salario_acumulado: preview.encabezado.salario_acumulado,
      total_pagar: preview.encabezado.total_pagar,
      detalles: preview.detalles,
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
      salario_acumulado: body.salario_acumulado,
      total_pagar: body.total_pagar,
      detalles: detallesActualizados,
    });

    return res.json({ message: 'Liquidación actualizada correctamente', ...resultado });
  } catch (err) {
    const status = err.statusCode || 500;
    return res.status(status).json({ error: err.message });
  }
};

module.exports = {
  getLiquidaciones,
  getLiquidacionById,
  previsualizarLiquidacion,
  crearLiquidacion,
  actualizarLiquidacion,
};
