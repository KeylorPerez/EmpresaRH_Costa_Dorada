const express = require('express');
const router = express.Router();
const { getEmpleados } = require('../controllers/empleadoController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Solo usuarios autenticados pueden ver empleados
router.get('/', authenticateToken, getEmpleados);

// Solo admins pueden crear empleados (más adelante crearás el POST)
router.post('/', authenticateToken, authorizeRoles(1), (req, res) => {
    res.json({ message: 'Aquí se crearía un nuevo empleado' });
});

module.exports = router;
