const Prestamos = require('../models/Prestamos');
const Usuario = require('../models/Usuario');

// GET /api/prestamos
// Admin -> todos los préstamos
// Empleado -> solo sus préstamos
const getPrestamos = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(401).json({ error: 'No autenticado' });

    if (user.id_rol === 1) {
      // admin
      const rows = await Prestamos.getAll();
      return res.json(rows);
    } else {
      // empleado
      const usuarioDB = await Usuario.getById(user.id_usuario);
      if (!usuarioDB || !usuarioDB.id_empleado) return res.status(400).json({ error: 'Usuario no vinculado a empleado' });

      const rows = await Prestamos.getByEmpleado(usuarioDB.id_empleado);
      return res.json(rows);
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// GET /api/prestamos/:id
const getPrestamoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const user = req.user;
    const usuarioDB = await Usuario.getById(user.id_usuario);

    const prestamos = user.id_rol === 1
      ? await Prestamos.getAll()
      : await Prestamos.getByEmpleado(usuarioDB.id_empleado);

    const prestamo = prestamos.find(p => p.id_prestamo === id);
    if (!prestamo) return res.status(404).json({ error: 'Préstamo no encontrado' });

    res.json(prestamo);
  } catch (err) {
    res.status(500).json({ error: err.message });
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

    res.status(201).json({ message: 'Préstamo creado', id_prestamo: created.id_prestamo });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json({ message: 'Pago registrado, saldo actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    res.json({ message: 'Estado del préstamo actualizado', id_estado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getPrestamos,
  getPrestamoById,
  createPrestamo,
  pagarPrestamo,
  updateEstadoPrestamo,
};
