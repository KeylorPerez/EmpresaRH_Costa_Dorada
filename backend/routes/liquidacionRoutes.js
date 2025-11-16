/**
 * Rutas de liquidaciones. Concentran los endpoints para previsualizar,
 * crear y exportar los finiquitos generados para cada colaborador.
 */
const express = require('express');
const router = express.Router();
const {
  getLiquidaciones,
  getLiquidacionById,
  previsualizarLiquidacion,
  crearLiquidacion,
  actualizarLiquidacion,
  exportLiquidacionPdf,
} = require('../controllers/liquidacionController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/liquidaciones -> admin: todas / empleado: sus liquidaciones
router.get('/', authenticateToken, getLiquidaciones);

// GET /api/liquidaciones/:id/export -> generar constancia en PDF
router.get('/:id/export', authenticateToken, exportLiquidacionPdf);

// GET /api/liquidaciones/:id -> obtener detalle con conceptos
router.get('/:id', authenticateToken, getLiquidacionById);

// POST /api/liquidaciones/previsualizar -> genera datos automáticos sin guardar (solo admin)
router.post('/previsualizar', authenticateToken, authorizeRoles(1), previsualizarLiquidacion);

// POST /api/liquidaciones -> crear liquidación (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), crearLiquidacion);

// PUT /api/liquidaciones/:id -> actualizar liquidación existente (solo admin)
router.put('/:id', authenticateToken, actualizarLiquidacion);

module.exports = router;
