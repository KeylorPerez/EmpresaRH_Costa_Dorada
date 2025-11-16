/**
 * Rutas de usuarios. Gestionan la creación y administración de cuentas
 * que pueden autenticarse en el sistema.
 */
const express = require('express');
const router = express.Router();
const { getUsuarios, createUsuario, updateUsuario, cambiarEstadoUsuario } = require('../controllers/usuarioController');

// Rutas de usuarios
router.get('/', getUsuarios);
router.post('/', createUsuario);
router.put('/:id', updateUsuario);

// Nueva ruta: activar/desactivar usuario
router.patch('/:id/estado', cambiarEstadoUsuario);

module.exports = router;
