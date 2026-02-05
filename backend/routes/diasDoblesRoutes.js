/**
 * Rutas para consultar el catálogo de días dobles.
 */
const express = require('express');
const router = express.Router();
const {
  getDiasDobles,
  getDiaDobleByFecha,
} = require('../controllers/diasDoblesController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, getDiasDobles);
router.get('/fecha/:fecha', authenticateToken, getDiaDobleByFecha);

module.exports = router;
