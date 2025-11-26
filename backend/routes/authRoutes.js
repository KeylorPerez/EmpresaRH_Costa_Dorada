/**
 * Rutas de autenticación. Exponen el login y podrían ampliarse con
 * futuras operaciones de recuperación o renovación de tokens.
 */
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { login, getCurrentUser } = require('../controllers/authController');

router.post('/login', login);
router.get('/me', authenticateToken, getCurrentUser);

module.exports = router;
