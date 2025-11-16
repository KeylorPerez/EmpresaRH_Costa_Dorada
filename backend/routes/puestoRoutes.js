/**
 * Rutas de puestos. Controlan el catálogo de cargos y lo protegen
 * mediante autenticación y roles antes de permitir cambios.
 */
const express = require('express');
const router = express.Router();
const {
  getPuestos,
  getPuestoById,
  createPuesto,
  updatePuesto,
  deletePuesto
} = require('../controllers/puestoController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Obtener todos los puestos (solo autenticado)
router.get('/', authenticateToken, getPuestos);

// Obtener un puesto por ID
router.get('/:id', authenticateToken, getPuestoById);

// Crear un nuevo puesto (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), createPuesto);

// Actualizar puesto (solo admin)
router.put('/:id', authenticateToken, authorizeRoles(1), updatePuesto);

// Eliminar un puesto
router.delete('/:id', authenticateToken, authorizeRoles(1), deletePuesto);

module.exports = router;
