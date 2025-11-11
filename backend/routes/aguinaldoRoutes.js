const express = require('express');
const router = express.Router();
const {
  getAguinaldos,
  calcularAguinaldo,
  actualizarAguinaldo,
  actualizarPago,
  exportAguinaldoPdf,
} = require('../controllers/aguinaldoController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, getAguinaldos);
router.get('/:id/export', authenticateToken, exportAguinaldoPdf);
router.post('/calcular', authenticateToken, authorizeRoles(1), calcularAguinaldo);
router.put('/:id', authenticateToken, authorizeRoles(1), actualizarAguinaldo);
router.put('/:id/pago', authenticateToken, authorizeRoles(1), actualizarPago);

module.exports = router;
