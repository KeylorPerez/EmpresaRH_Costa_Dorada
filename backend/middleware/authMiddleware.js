const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

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
