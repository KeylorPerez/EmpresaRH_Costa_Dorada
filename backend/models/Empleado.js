const { poolPromise, sql } = require('../db/db');

class Empleado {
    static async getAll() {
        try {
            const pool = await poolPromise;
            const result = await pool.request()
                .query('SELECT * FROM Empleados');
            return result.recordset;
        } catch (err) {
            throw err;
        }
    }
}

module.exports = Empleado;
