/**
 * Rutas de autenticación. Exponen el login y podrían ampliarse con
 * futuras operaciones de recuperación o renovación de tokens.
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { login, getCurrentUser, getSessionStatus, refreshToken } = require('../controllers/authController');

router.post('/login', login);
router.get('/me', authenticateToken, getCurrentUser);
router.get('/status', authenticateToken, getSessionStatus);
router.post('/refresh', authenticateToken, refreshToken);

module.exports = router;
