const express = require('express');
const router = express.Router();
const { getAsistencia, getByRange, createMarca, updateMarca } = require('../controllers/asistenciaController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/asistencia  -> admin: todo / empleado: sus marcas
router.get('/', authenticateToken, getAsistencia);

// GET /api/asistencia/range?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/range', authenticateToken, getByRange);

// POST /api/asistencia  -> crear marca (empleado puede crear la suya; admin puede crear para cualquiera)
router.post('/', authenticateToken, createMarca);

// PUT /api/asistencia/:id -> modificar (solo admin)
router.put('/:id', authenticateToken, authorizeRoles(1), updateMarca);

module.exports = router;
