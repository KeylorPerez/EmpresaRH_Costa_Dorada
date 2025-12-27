/**
 * Rutas de descansos semanales. Devuelve los días libres calculados por periodo.
 */
const express = require('express');
const router = express.Router();
const {
  getDescansosSummary,
  getDescansosByEmpleado,
} = require('../controllers/descansoSemanalController');
const { authenticateToken } = require('../middleware/authMiddleware');

// Obtener descansos por periodo (solo autenticado)
router.get('/', authenticateToken, getDescansosSummary);
router.get('/empleado/:id', authenticateToken, getDescansosByEmpleado);

module.exports = router;
