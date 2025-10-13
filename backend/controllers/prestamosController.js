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
// body: { id_empleado?, monto, cuotas, interes }
const createPrestamo = async (req, res) => {
  try {
    const { id_empleado: idBody, monto, cuotas, interes } = req.body;
    const user = req.user;
    const usuarioDB = await Usuario.getById(user.id_usuario);

    let id_empleado_final = idBody || (usuarioDB ? usuarioDB.id_empleado : null);
    if (!id_empleado_final) return res.status(400).json({ error: 'id_empleado requerido' });

    if (idBody && user.id_rol !== 1 && idBody !== usuarioDB.id_empleado) {
      return res.status(403).json({ error: 'No autorizado para crear préstamo para otro empleado' });
    }

    if (!monto || !cuotas || !interes) {
      return res.status(400).json({ error: 'Faltan datos requeridos: monto, cuotas, interes' });
    }

    const created = await Prestamos.create({
      id_empleado: id_empleado_final,
      monto,
      cuotas,
      interes
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
    if (isNaN(id) || !monto_pago) return res.status(400).json({ error: 'ID o monto_pago inválido' });

    await Prestamos.updateSaldo(id, monto_pago);
    res.json({ message: 'Pago registrado, saldo actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getPrestamos,
  getPrestamoById,
  createPrestamo,
  pagarPrestamo
};
