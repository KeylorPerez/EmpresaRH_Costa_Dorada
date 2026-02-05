/**
 * Controlador de días dobles. Expone consultas del catálogo de fechas
 * con multiplicador especial para uso administrativo y operativo.
 */
const DiasDobles = require('../models/DiasDobles');

const getDiasDobles = async (req, res) => {
  try {
    const soloActivos = req.query.activo === '1' || req.query.activo === 'true';
    const diasDobles = await DiasDobles.getAll({ soloActivos });
    res.json(diasDobles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDiaDobleByFecha = async (req, res) => {
  try {
    const { fecha } = req.params;
    if (!fecha) return res.status(400).json({ error: 'Fecha inválida' });

    const diaDoble = await DiasDobles.getByFecha(fecha);
    if (!diaDoble) {
      return res.status(404).json({ error: 'No existe día doble para la fecha indicada' });
    }

    res.json(diaDoble);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getDiasDobles,
  getDiaDobleByFecha,
};
