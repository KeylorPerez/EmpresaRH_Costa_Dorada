/**
 * Rutas de asistencia. Definen los puntos de entrada para registrar marcas,
 * consultar periodos y gestionar justificaciones, siempre protegidos por JWT.
 */
const express = require('express');
const router = express.Router();
const {
  getAsistencia,
  getByRange,
  createMarca,
  updateMarca,
  exportAsistencia,
  createJustificacionSolicitud,
  createJustificacionManual,
  resolverJustificacionSolicitud,
  getGeofenceConfig,
} = require('../controllers/asistenciaController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/asistencia  -> admin: todo / empleado: sus marcas
router.get('/', authenticateToken, getAsistencia);

// GET /api/asistencia/range?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/range', authenticateToken, getByRange);

// GET /api/asistencia/config -> configuración de la geocerca
router.get('/config', authenticateToken, getGeofenceConfig);

// GET /api/asistencia/export?start=&end=&id_empleado?&format?
router.get('/export', authenticateToken, authorizeRoles(1), exportAsistencia);

// POST /api/asistencia  -> crear marca (empleado puede crear la suya; admin puede crear para cualquiera)
router.post('/', authenticateToken, createMarca);

// PUT /api/asistencia/:id -> modificar (solo admin)
router.put('/:id', authenticateToken, authorizeRoles(1), updateMarca);

// POST /api/asistencia/justificaciones/manual -> crear solicitud sin marca registrada
router.post('/justificaciones/manual', authenticateToken, createJustificacionManual);

// POST /api/asistencia/:id/justificaciones -> crear solicitud de justificación (empleado o admin)
router.post('/:id/justificaciones', authenticateToken, createJustificacionSolicitud);

// PATCH /api/asistencia/justificaciones/:id -> resolver solicitud (solo admin)
router.patch('/justificaciones/:id', authenticateToken, authorizeRoles(1), resolverJustificacionSolicitud);

module.exports = router;
