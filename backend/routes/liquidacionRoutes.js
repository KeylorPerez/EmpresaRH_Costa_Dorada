const express = require('express');
const router = express.Router();
const { getLiquidaciones, generarLiquidacion } = require('../controllers/liquidacionController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/liquidaciones
router.get('/', authenticateToken, getLiquidaciones);

// POST /api/liquidaciones (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), generarLiquidacion);

module.exports = router;
