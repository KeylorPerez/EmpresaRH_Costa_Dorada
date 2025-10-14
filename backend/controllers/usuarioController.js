const Usuario = require('../models/Usuario');
const bcrypt = require('bcrypt');

// Obtener todos los usuarios
const getUsuarios = async (req, res) => {
    try {
        const usuarios = await Usuario.getAll();
        res.json(usuarios);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Crear un usuario
const createUsuario = async (req, res) => {
    try {
        const { username, password, id_rol, id_empleado } = req.body;

        if (!username || !password || !id_rol || !id_empleado) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        // Hashear la contraseña
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUser = await Usuario.create({ username, password_hash, id_rol, id_empleado });
        res.status(201).json({ message: 'Usuario creado', id_usuario: newUser.id_usuario });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Actualizar un usuario
const updateUsuario = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

        const { username, password, id_rol, id_empleado } = req.body;

        let password_hash;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            password_hash = await bcrypt.hash(password, salt);
        }

        await Usuario.update(id, { 
            username, 
            password_hash: password_hash || undefined, 
            id_rol, 
            id_empleado 
        });

        res.json({ message: 'Usuario actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getUsuarios, createUsuario, updateUsuario };
