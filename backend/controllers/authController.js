/**
 * Controlador de autenticación. Se encarga de validar credenciales
 * y emitir el token JWT que respalda las sesiones dentro del sistema.
 */
const Usuario = require('../models/Usuario');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

/**
 * Valida las credenciales del usuario y genera un JWT con los datos
 * esenciales para la autorización posterior.
 */
const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username y contraseña son requeridos' });
        }

        // Buscar usuario por username
        const user = await Usuario.getByUsername(username);
        if (!user) return res.status(400).json({ error: 'Usuario no encontrado' });

        // Verificar si el usuario está activo
        if (!user.estado) {
            return res.status(403).json({ error: 'Usuario inactivo, contacte al administrador' });
        }

        // Verificar contraseña
        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) return res.status(400).json({ error: 'Contraseña incorrecta' });

        // Crear token JWT
        const token = jwt.sign(
            {
                id_usuario: user.id_usuario,
                username: user.username,
                id_rol: user.id_rol,
                id_empleado: user.id_empleado,
            },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

        // Actualizar último login (solo la fecha)
        const pool = await require('../db/db').poolPromise;
        await pool.request()
            .input('id_usuario', require('../db/db').sql.Int, user.id_usuario)
            .query(`UPDATE Usuarios SET ultimo_login = GETDATE() WHERE id_usuario = @id_usuario`);

        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { login };
