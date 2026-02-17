/**
 * Rutas para consultar y administrar el catálogo de días dobles.
 */
const express = require('express');
const router = express.Router();
const {
  getDiasDobles,
  getDiaDobleByFecha,
  createDiaDoble,
  updateDiaDoble,
  deleteDiaDoble,
} = require('../controllers/diasDoblesController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, getDiasDobles);
router.get('/fecha/:fecha', authenticateToken, getDiaDobleByFecha);
router.post('/', authenticateToken, createDiaDoble);
router.put('/:id', authenticateToken, updateDiaDoble);
router.delete('/:id', authenticateToken, deleteDiaDoble);

module.exports = router;
