const Empleado = require('../models/Empleado');

// Obtener todos los empleados
const getEmpleados = async (req, res) => {
  try {
    const empleados = await Empleado.getAll();
    res.json(empleados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Obtener un empleado por ID
const getEmpleadoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const empleado = await Empleado.getById(id);
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado' });
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
    const empleado = await Empleado.create({ nombre, apellido, id_puesto, cedula, fecha_nacimiento, telefono, email, fecha_ingreso, salario_base });
    res.status(201).json({ message: 'Empleado creado', id_empleado: empleado.id_empleado });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Actualizar un empleado (solo admin)
const updateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { nombre, apellido, id_puesto, cedula, fecha_nacimiento, telefono, email, fecha_ingreso, salario_base, estado } = req.body;
    await Empleado.update(id, { nombre, apellido, id_puesto, cedula, fecha_nacimiento, telefono, email, fecha_ingreso, salario_base, estado });
    res.json({ message: 'Empleado actualizado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Desactivar un empleado (soft delete) (solo admin)
const deactivateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    await Empleado.deactivate(id);
    res.json({ message: 'Empleado desactivado' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { 
  getEmpleados, 
  getEmpleadoById, 
  createEmpleado, 
  updateEmpleado, 
  deactivateEmpleado 
};
