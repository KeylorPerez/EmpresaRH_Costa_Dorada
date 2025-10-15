const express = require('express');
const router = express.Router();
const { getLiquidaciones, generarLiquidacion, updateLiquidacion } = require('../controllers/liquidacionController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/liquidaciones -> admin: todas / empleado: sus liquidaciones
router.get('/', authenticateToken, getLiquidaciones);

// POST /api/liquidaciones -> generar liquidación (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), generarLiquidacion);

// PUT /api/liquidaciones/:id -> actualizar liquidación existente (solo admin)
router.put('/:id', authenticateToken, authorizeRoles(1), updateLiquidacion);

module.exports = router;
