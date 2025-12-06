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
const buildJwtPayload = (user) => ({
    id_usuario: user.id_usuario,
    username: user.username,
    id_rol: user.id_rol,
    id_empleado: user.id_empleado,
});

const signSessionToken = (payload) => {
    const tokenTtl = process.env.JWT_EXPIRES_IN || '1h';

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: tokenTtl });

    return { token, tokenTtl };
};

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

        const { token, tokenTtl } = signSessionToken(buildJwtPayload(user));

        // Actualizar último login (solo la fecha)
        const pool = await require('../db/db').poolPromise;
        await pool.request()
            .input('id_usuario', require('../db/db').sql.Int, user.id_usuario)
            .query(`UPDATE Usuarios SET ultimo_login = GETDATE() WHERE id_usuario = @id_usuario`);

        const profile = await Usuario.getProfileById(user.id_usuario);

        res.json({ token, user: profile, expiresIn: tokenTtl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getCurrentUser = async (req, res) => {
    try {
        const profile = await Usuario.getProfileById(req.user.id_usuario);

        if (!profile) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(profile);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getSessionStatus = (req, res) => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    const expiration = req.user?.exp;

    if (!expiration) {
        return res.status(400).json({ error: 'El token no incluye fecha de expiración' });
    }

    const secondsRemaining = Math.max(expiration - nowInSeconds, 0);

    res.json({
        valid: secondsRemaining > 0,
        secondsRemaining,
        expiresAt: new Date(expiration * 1000).toISOString(),
        serverTime: new Date().toISOString(),
        user: {
            id_usuario: req.user.id_usuario,
            username: req.user.username,
            id_rol: req.user.id_rol,
            id_empleado: req.user.id_empleado,
        },
    });
};

const refreshToken = async (req, res) => {
    try {
        const user = await Usuario.getById(req.user.id_usuario);

        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (!user.estado) {
            return res.status(403).json({ error: 'Usuario inactivo, contacte al administrador' });
        }

        const profile = await Usuario.getProfileById(user.id_usuario);
        const { token, tokenTtl } = signSessionToken(buildJwtPayload(user));

        res.json({ token, user: profile, expiresIn: tokenTtl });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { login, getCurrentUser, getSessionStatus, refreshToken };
