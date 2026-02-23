/**
 * Rutas de descansos de empleados.
 */
const express = require('express');
const router = express.Router();
const {
  getDescansos,
  createDescanso,
  updateDescanso,
  deleteDescanso,
  validarFechaDescanso,
} = require('../controllers/empleadoDescansosController');
const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', authenticateToken, getDescansos);
router.get('/validar/:idEmpleado/:fecha', authenticateToken, validarFechaDescanso);
router.post('/', authenticateToken, authorizeRoles(1), createDescanso);
router.put('/:id', authenticateToken, authorizeRoles(1), updateDescanso);
router.delete('/:id', authenticateToken, authorizeRoles(1), deleteDescanso);

module.exports = router;
