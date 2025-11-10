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

    const metodoRaw = typeof req.body?.metodo === 'string' ? req.body.metodo.trim().toLowerCase() : 'automatico';
    const metodo = metodoRaw === 'manual' ? 'manual' : 'automatico';

    const incluirBonificaciones =
      req.body?.incluir_bonificaciones !== undefined
        ? Boolean(req.body.incluir_bonificaciones)
        : true;
    const incluirHorasExtra =
      req.body?.incluir_horas_extra !== undefined
        ? Boolean(req.body.incluir_horas_extra)
        : false;

    let salarioQuincenalManual = null;
    let fechaIngresoManual = null;
    let tipoPagoManual = null;

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
  actualizarPago,
};
