const express = require('express');
const router = express.Router();
const {
    getEmpleados,
    getEmpleadoById,
    createEmpleado,
    updateEmpleado,
    deactivateEmpleado
} = require('../controllers/empleadoController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/empleados -> todos los empleados (autenticado)
router.get('/', authenticateToken, getEmpleados);

// GET /api/empleados/:id -> un empleado por ID (autenticado)
router.get('/:id', authenticateToken, getEmpleadoById);

// POST /api/empleados -> crear un empleado (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), createEmpleado);

// PUT /api/empleados/:id -> actualizar empleado (solo admin)
router.put('/:id', authenticateToken, authorizeRoles(1), updateEmpleado);

// DELETE /api/empleados/:id -> desactivar empleado (soft delete, solo admin)
router.delete('/:id', authenticateToken, authorizeRoles(1), deactivateEmpleado);

module.exports = router;
