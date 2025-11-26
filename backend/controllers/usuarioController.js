/**
 * Controlador de usuarios. Maneja la administración de cuentas, cifrado
 * de contraseñas y el control de estados activos/inactivos del personal
 * que accede al sistema.
 */
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
        const { username, password, id_rol, id_empleado, estado = 1 } = req.body;

        const roleId = Number(id_rol);
        const isAdmin = roleId === 1;
        const empleadoId = id_empleado === undefined ? null : id_empleado;

        if (!username || !password || !roleId) {
            return res.status(400).json({ error: 'Faltan datos requeridos' });
        }

        if (!isAdmin && (empleadoId === null || empleadoId === undefined)) {
            return res.status(400).json({ error: 'Empleado asociado requerido para rol empleado' });
        }

        const usernameInUse = await Usuario.isUsernameTaken(username);
        if (usernameInUse) {
            return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
        }

        // Hashear la contraseña
        const salt = await bcrypt.genSalt(10);
        const password_hash = await bcrypt.hash(password, salt);

        const newUser = await Usuario.create({ username, password_hash, id_rol: roleId, id_empleado: empleadoId, estado });
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

        const { username, password, id_rol, id_empleado, estado } = req.body;

        const existingUser = await Usuario.getById(id);
        if (!existingUser) return res.status(404).json({ error: 'Usuario no encontrado' });

        let password_hash;
        if (password) {
            const salt = await bcrypt.genSalt(10);
            password_hash = await bcrypt.hash(password, salt);
        }

        const roleId = id_rol !== undefined ? Number(id_rol) : existingUser.id_rol;
        const empleadoId = id_empleado !== undefined ? id_empleado : existingUser.id_empleado;
        const isAdmin = roleId === 1;

        if (!isAdmin && (empleadoId === null || empleadoId === undefined)) {
            return res.status(400).json({ error: 'Empleado asociado requerido para rol empleado' });
        }

        if (username) {
            const usernameInUse = await Usuario.isUsernameTaken(username, id);
            if (usernameInUse) {
                return res.status(409).json({ error: 'El nombre de usuario ya está en uso' });
            }
        }

        await Usuario.update(id, {
            username,
            password_hash: password_hash || undefined,
            id_rol: roleId,
            id_empleado: empleadoId,
            estado
        });

        res.json({ message: 'Usuario actualizado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// Activar o desactivar un usuario
const cambiarEstadoUsuario = async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        const { estado } = req.body;

        if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });
        if (estado !== 0 && estado !== 1) return res.status(400).json({ error: 'El estado debe ser 0 o 1' });

        const pool = await require('../db/db').poolPromise;
        await pool.request()
            .input('id_usuario', require('../db/db').sql.Int, id)
            .input('estado', require('../db/db').sql.Bit, estado)
            .query(`UPDATE Usuarios SET estado = @estado, updated_at = GETDATE() WHERE id_usuario = @id_usuario`);

        res.json({ message: `Usuario ${estado === 1 ? 'activado' : 'desactivado'} correctamente` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { getUsuarios, createUsuario, updateUsuario, cambiarEstadoUsuario };
