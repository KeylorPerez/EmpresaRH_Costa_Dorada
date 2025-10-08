const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Login
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        // Buscar usuario por username
        const user = await Usuario.getByUsername(username);
        if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

        // Verificar contraseña
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ error: 'Contraseña incorrecta' });

        // Crear token JWT
        const token = jwt.sign(
            { id_usuario: user.id_usuario, username: user.username, id_rol: user.id_rol },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Actualizar ultimo_login
        await Usuario.update(user.id_usuario, { 
            username: user.username, 
            password_hash: user.password_hash, 
            id_rol: user.id_rol, 
            id_empleado: user.id_empleado 
        });

        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { login };
