/**
 * Middleware de autenticación JWT. Verifica la validez del token
 * recibido y adjunta al request la información básica del usuario
 * autorizado para ser utilizada en los controladores.
 */
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// Límite de inactividad en milisegundos (por defecto, 15 minutos)
const inactivityLimitMs =
    (parseInt(process.env.SESSION_INACTIVITY_MINUTES || '15', 10) || 15) * 60 * 1000;

// Registro en memoria del último uso por token para forzar cierre de sesión por inactividad
const sessionActivity = new Map();

const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

    if (!token) return res.status(401).json({ error: 'Token no proporcionado' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const usuario = await Usuario.getById(decoded.id_usuario);
        if (!usuario) {
            return res.status(401).json({ error: 'Usuario no encontrado' });
        }

        if (!usuario.estado) {
            return res.status(403).json({ error: 'Usuario inactivo, contacte al administrador' });
        }

        const lastSeen = sessionActivity.get(token);
        const now = Date.now();

        if (lastSeen && now - lastSeen > inactivityLimitMs) {
            sessionActivity.delete(token);
            return res.status(440).json({ error: 'Sesión expirada por inactividad. Vuelva a iniciar sesión.' });
        }

        sessionActivity.set(token, now);

        req.user = decoded; // decoded contiene id_usuario, username, id_rol
        next();
    } catch (err) {
        if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
            return res.status(403).json({ error: 'Token inválido' });
        }

        return res.status(500).json({ error: 'Error al validar el token' });
    }
};

const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.id_rol)) {
            return res.status(403).json({ error: 'No autorizado para esta acción' });
        }
        next();
    };
};

module.exports = { authenticateToken, authorizeRoles };
