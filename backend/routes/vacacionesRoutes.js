// routes/vacacionesRoutes.js
const express = require('express');
const router = express.Router();
const {
  getVacaciones,
  createSolicitud,
  aprobarSolicitud,
  rechazarSolicitud,
  exportSolicitudPdf
} = require('../controllers/vacacionesController');

const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// ============================
// RUTAS DE VACACIONES
// ============================

// GET /api/vacaciones
// Admin -> todas las solicitudes
// Empleado -> solo las suyas
router.get('/', authenticateToken, getVacaciones);

// POST /api/vacaciones
// Crear solicitud de vacaciones (empleado o admin)
router.post('/', authenticateToken, createSolicitud);

// GET /api/vacaciones/:id/export
// Generar documento PDF de la solicitud
router.get('/:id/export', authenticateToken, exportSolicitudPdf);

// PUT /api/vacaciones/:id/aprobar
// Aprobar solicitud (solo admin)
router.put('/:id/aprobar', authenticateToken, authorizeRoles(1), aprobarSolicitud);

// PUT /api/vacaciones/:id/rechazar
// Rechazar solicitud (solo admin)
router.put('/:id/rechazar', authenticateToken, authorizeRoles(1), rechazarSolicitud);

module.exports = router;
