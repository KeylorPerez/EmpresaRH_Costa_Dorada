const express = require('express');
const router = express.Router();
const {
  getEmpleados,
  getEmpleadoById,
  createEmpleado,
  updateEmpleado,
  deactivateEmpleado,
  activateEmpleado
} = require('../controllers/empleadoController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// 📘 Obtener todos los empleados (solo autenticado)
router.get('/', authenticateToken, getEmpleados);

// 📘 Obtener un empleado por ID
router.get('/:id', authenticateToken, getEmpleadoById);

// 🟢 Crear un nuevo empleado (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), createEmpleado);

// 🟡 Actualizar empleado (solo admin)
router.put('/:id', authenticateToken, authorizeRoles(1), updateEmpleado);

// 🔴 Desactivar empleado (soft delete)
router.patch('/:id/desactivar', authenticateToken, authorizeRoles(1), deactivateEmpleado);

// 🟢 Activar empleado (reactivar)
router.patch('/:id/activar', authenticateToken, authorizeRoles(1), activateEmpleado);

module.exports = router;
