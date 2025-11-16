/**
 * Rutas de autenticación. Exponen el login y podrían ampliarse con
 * futuras operaciones de recuperación o renovación de tokens.
 */
const express = require('express');
const router = express.Router();
const { login } = require('../controllers/authController');

router.post('/login', login);

module.exports = router;
