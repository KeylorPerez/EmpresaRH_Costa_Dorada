const express = require('express');
const router = express.Router();
const { getPlanilla, calcularPlanilla, updatePlanilla } = require('../controllers/planillaController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/planilla -> admin: todas / empleado: sus planillas
router.get('/', authenticateToken, getPlanilla);

// POST /api/planilla -> calcular o generar planilla (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), calcularPlanilla);

// PUT /api/planilla/:id -> actualizar planilla existente (solo admin)
router.put('/:id', authenticateToken, authorizeRoles(1), updatePlanilla);

module.exports = router;
