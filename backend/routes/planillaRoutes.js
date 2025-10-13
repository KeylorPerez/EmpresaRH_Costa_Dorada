const express = require('express');
const router = express.Router();
const { getPlanilla, calcularPlanilla } = require('../controllers/planillaController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/planilla -> admin: todas / empleado: sus planillas
router.get('/', authenticateToken, getPlanilla);

// POST /api/planilla -> calcular o generar planilla (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), calcularPlanilla);

module.exports = router;
