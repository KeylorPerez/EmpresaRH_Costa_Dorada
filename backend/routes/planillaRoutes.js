const express = require('express');
const router = express.Router();
const { getPlanilla, calcularPlanilla, updatePlanilla, getPlanillaAttendance } = require('../controllers/planillaController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/planilla -> admin: todas / empleado: sus planillas
router.get('/', authenticateToken, getPlanilla);

// GET /api/planilla/asistencia -> resumen de días laborados para colaboradores con pago diario (solo admin)
router.get('/asistencia', authenticateToken, authorizeRoles(1), getPlanillaAttendance);

// POST /api/planilla -> calcular o generar planilla (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), calcularPlanilla);

// PUT /api/planilla/:id -> actualizar planilla existente (solo admin)
router.put('/:id', authenticateToken, authorizeRoles(1), updatePlanilla);

module.exports = router;
