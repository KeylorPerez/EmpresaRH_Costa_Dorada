const Usuario = require('../models/Usuario');
const bcrypt = require('bcrypt');

// Listar todos los usuarios
const getUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario.getAll();
        res.json(usuarios);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Crear usuario
const createUsuario = async (req, res) => {
    try {
        const { username, password, id_rol, id_empleado } = req.body;

        // Hashear la contraseña
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUser = await Usuario.create({ username, password_hash, id_rol, id_empleado });
        res.status(201).json(newUser);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getUsuarios, createUsuario };
