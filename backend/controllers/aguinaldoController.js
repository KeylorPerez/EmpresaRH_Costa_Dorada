const Aguinaldo = require('../models/Aguinaldo');
const Usuario = require('../models/Usuario');

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

const calcularAguinaldo = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (user.id_rol !== 1) {
      return res.status(403).json({ error: 'Solo administradores pueden calcular aguinaldos' });
    }

    const { id_empleado, anio } = req.body;
    const empleadoId = Number(id_empleado);
    const anioNumero = Number(anio);

    if (!Number.isInteger(empleadoId) || empleadoId <= 0) {
      return res.status(400).json({ error: 'id_empleado inválido' });
    }

    if (!Number.isInteger(anioNumero) || anioNumero < 2000) {
      return res.status(400).json({ error: 'Año inválido para el cálculo' });
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
          const date = new Date(
            Date.UTC(Number(year), Number(month) - 1, Number(day))
          );
          if (!Number.isNaN(date.getTime())) {
            return date;
          }
        }
      }

      const fecha = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
      if (Number.isNaN(fecha.getTime())) return null;

      return new Date(
        Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate())
      );
    };

    const fechaInicioPeriodo = parseFecha(req.body?.fecha_inicio_periodo);
    const fechaFinPeriodo = parseFecha(req.body?.fecha_fin_periodo);

    if (fechaInicioPeriodo && fechaFinPeriodo && fechaFinPeriodo < fechaInicioPeriodo) {
      return res.status(400).json({ error: 'La fecha fin del periodo no puede ser anterior a la fecha de inicio' });
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
        return res
          .status(400)
          .json({ error: 'Salario quincenal inválido para el cálculo manual' });
      }

      salarioQuincenalManual = salarioNumero;

      if (req.body?.fecha_ingreso) {
        const fechaIngreso = new Date(req.body.fecha_ingreso);
        if (Number.isNaN(fechaIngreso.getTime())) {
          return res.status(400).json({ error: 'Fecha de ingreso inválida' });
        }
        fechaIngresoManual = fechaIngreso.toISOString();
      }

      if (req.body?.tipo_pago) {
        tipoPagoManual = String(req.body.tipo_pago);
      }

      const montoPromedioDiario = Number(req.body?.monto_promedio_diario);
      const diasPromedioDiario = Number(req.body?.dias_promedio_diario);
      const periodoPromedio = (() => {
        const texto = String(req.body?.periodo_promedio_diario || "")
          .trim()
          .toLowerCase();
        return texto === "mes" ? "mes" : "quincena";
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

    const aguinaldo = await Aguinaldo.calcularYGuardar({
      id_empleado: empleadoId,
      anio: anioNumero,
      metodo,
      incluirBonificaciones,
      incluirHorasExtra,
      salarioQuincenal: salarioQuincenalManual,
      fechaIngresoManual,
      tipoPagoManual,
      promedioManual,
      fechaInicioPeriodo,
      fechaFinPeriodo,
      observacion: observacionTexto,
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

module.exports = {
  getAguinaldos,
  calcularAguinaldo,
  actualizarAguinaldo,
  actualizarPago,
};
