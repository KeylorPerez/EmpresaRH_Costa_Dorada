/**
 * Rutas de días dobles. Controlan la configuración de feriados y días especiales
 * aplicados automáticamente en planillas.
 */
const express = require('express');
const router = express.Router();
const {
  getDiasDobles,
  getDiaDobleById,
  createDiaDoble,
  updateDiaDoble,
  deleteDiaDoble,
} = require('../controllers/diasDoblesController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// Obtener todos los días dobles (solo autenticado)
router.get('/', authenticateToken, getDiasDobles);

// Obtener un día doble por ID
router.get('/:id', authenticateToken, getDiaDobleById);

// Crear un día doble (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), createDiaDoble);

// Actualizar un día doble (solo admin)
router.put('/:id', authenticateToken, authorizeRoles(1), updateDiaDoble);

// Eliminar un día doble (solo admin)
router.delete('/:id', authenticateToken, authorizeRoles(1), deleteDiaDoble);

module.exports = router;
