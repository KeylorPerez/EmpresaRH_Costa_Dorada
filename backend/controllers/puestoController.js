/**
 * Controlador de puestos. Expone operaciones CRUD simples para mantener
 * el catálogo de cargos y permitir su asociación con los empleados.
 */
const Puesto = require('../models/Puesto');

// Obtener todos los puestos
const getPuestos = async (req, res) => {
  try {
    const puestos = await Puesto.getAll();
    res.json(puestos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Obtener un puesto por ID
const getPuestoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const puesto = await Puesto.getById(id);
    if (!puesto) return res.status(404).json({ error: 'Puesto no encontrado' });

    res.json(puesto);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Crear un nuevo puesto
const createPuesto = async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Falta el nombre del puesto' });

    const puesto = await Puesto.create({ nombre });
    res.status(201).json({
      message: 'Puesto creado correctamente',
      id_puesto: puesto.id_puesto
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Actualizar un puesto
const updatePuesto = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const { nombre } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Falta el nombre del puesto' });

    await Puesto.update(id, { nombre });
    res.json({ message: 'Puesto actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getPuestos,
  getPuestoById,
  createPuesto,
  updatePuesto
};
