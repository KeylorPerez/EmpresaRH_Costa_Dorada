/**
 * Rutas de planillas. Controlan la generación, consulta y exportación
 * de cada periodo de pago, protegiendo la información sensible con JWT.
 */
const express = require('express');
const router = express.Router();
const {
  getPlanilla,
  calcularPlanilla,
  updatePlanilla,
  getPlanillaAttendance,
  getPlanillaDetalle,
  exportPlanillaArchivo,
} = require('../controllers/planillaController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/planilla -> admin: todas / empleado: sus planillas
router.get('/', authenticateToken, getPlanilla);

// GET /api/planilla/asistencia -> resumen de días laborados para colaboradores con pago diario (solo admin)
router.get('/asistencia', authenticateToken, authorizeRoles(1), getPlanillaAttendance);

// GET /api/planilla/:id/export -> exportar planilla en PDF o Excel (admin o empleado dueño)
router.get('/:id/export', authenticateToken, authorizeRoles(1, 2), exportPlanillaArchivo);

// GET /api/planilla/:id/detalle -> detalle diario de una planilla (admin o empleado dueño)
router.get('/:id/detalle', authenticateToken, authorizeRoles(1, 2), getPlanillaDetalle);

// POST /api/planilla -> calcular o generar planilla (solo admin)
router.post('/', authenticateToken, authorizeRoles(1), calcularPlanilla);

// PUT /api/planilla/:id -> actualizar planilla existente (solo admin)
router.put('/:id', authenticateToken, authorizeRoles(1), updatePlanilla);

module.exports = router;
