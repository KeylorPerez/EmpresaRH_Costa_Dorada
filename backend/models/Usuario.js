const { poolPromise, sql } = require('../db/db');

class Usuario {
    // Obtener todos los usuarios
    static async getAll() {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .query(`SELECT u.id_usuario, u.username, u.id_rol, u.id_empleado, u.ultimo_login,
                               r.nombre AS rol
                        FROM Usuarios u
                        INNER JOIN CatalogoRoles r ON u.id_rol = r.id_rol`);
            return result.recordset;
        } catch (err) {
            throw err;
        }
    }

    // Obtener un usuario por ID
    static async getById(id_usuario) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('id_usuario', sql.Int, id_usuario)
                .query(`SELECT * FROM Usuarios WHERE id_usuario = @id_usuario`);
            return result.recordset[0];
        } catch (err) {
            throw err;
        }
    }

    // Obtener un usuario por username (para login)
    static async getByUsername(username) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('username', sql.VarChar, username)
                .query(`SELECT * FROM Usuarios WHERE username = @username`);
            return result.recordset[0];
        } catch (err) {
            throw err;
        }
    }

    // Crear un usuario
    static async create({ username, password_hash, id_rol, id_empleado }) {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .input('username', sql.VarChar, username)
                .input('password_hash', sql.VarChar, password_hash)
                .input('id_rol', sql.Int, id_rol)
                .input('id_empleado', sql.Int, id_empleado)
                .query(`INSERT INTO Usuarios (username, password_hash, id_rol, id_empleado)
                        VALUES (@username, @password_hash, @id_rol, @id_empleado);
                        SELECT SCOPE_IDENTITY() AS id_usuario;`);
            return result.recordset[0];
        } catch (err) {
            throw err;
        }
    }

    static async updateLastLogin(id_usuario) {
    const pool = await poolPromise;
    await pool.request()
        .input('id_usuario', sql.Int, id_usuario)
        .query(`UPDATE Usuarios SET ultimo_login = GETDATE() WHERE id_usuario = @id_usuario`);
}

    // Actualizar un usuario
    static async update(id_usuario, { username, password_hash, id_rol, id_empleado }) {
        try {
            const pool = await poolPromise;
            await pool.request()
                .input('id_usuario', sql.Int, id_usuario)
                .input('username', sql.VarChar, username)
                .input('password_hash', sql.VarChar, password_hash)
                .input('id_rol', sql.Int, id_rol)
                .input('id_empleado', sql.Int, id_empleado)
                .query(`UPDATE Usuarios
                        SET username = @username,
                            password_hash = @password_hash,
                            id_rol = @id_rol,
                            id_empleado = @id_empleado
                        WHERE id_usuario = @id_usuario`);
            return { message: 'Usuario actualizado' };
        } catch (err) {
            throw err;
        }
    }
}

module.exports = Usuario;
