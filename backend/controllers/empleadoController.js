const Empleado = require('../models/Empleado');

// Obtener todos los empleados (solo activos)
const getEmpleados = async (req, res) => {
  try {
    const empleados = await Empleado.getAll();
    res.json(empleados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Obtener un empleado por ID (solo si está activo)
const getEmpleadoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const empleado = await Empleado.getById(id);
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado o inactivo' });

    res.json(empleado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Crear un nuevo empleado (solo admin)
const createEmpleado = async (req, res) => {
  try {
    const { nombre, apellido, id_puesto, cedula, fecha_nacimiento, telefono, email, fecha_ingreso, salario_base } = req.body;

    if (!nombre || !apellido || !id_puesto || !cedula || !fecha_ingreso || !salario_base) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const empleado = await Empleado.create({
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono: telefono || null,
      email: email || null,
      fecha_ingreso,
      salario_base
    });

    res.status(201).json({
      message: 'Empleado creado correctamente',
      id_empleado: empleado.id_empleado
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Actualizar un empleado (solo admin)
const updateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const {
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento,
      telefono,
      email,
      fecha_ingreso,
      salario_base,
      estado
    } = req.body;

    await Empleado.update(id, {
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono: telefono || null,
      email: email || null,
      fecha_ingreso,
      salario_base,
      estado
    });

    res.json({ message: 'Empleado actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Desactivar un empleado (soft delete)
const deactivateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    await Empleado.deactivate(id);
    res.json({ message: 'Empleado desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Activar un empleado (revertir desactivación)
const activateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    await Empleado.activate(id);
    res.json({ message: 'Empleado activado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getEmpleados,
  getEmpleadoById,
  createEmpleado,
  updateEmpleado,
  deactivateEmpleado,
  activateEmpleado
};
