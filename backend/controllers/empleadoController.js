const Empleado = require('../models/Empleado');

const getEmpleados = async (req, res) => {
    try {
        const empleados = await Empleado.getAll();
        res.json(empleados);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getEmpleados };

