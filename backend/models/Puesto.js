/**
 * Modelo de puestos. Gestiona el catálogo de cargos disponibles y sus
 * atributos salariales base.
 */
const { poolPromise, sql } = require('../db/db');

class Puesto {
  // Obtener todos los puestos
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .query(`
          SELECT *
          FROM Puestos
          ORDER BY nombre
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  // Obtener un puesto por ID
  static async getById(id_puesto) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('id_puesto', sql.Int, id_puesto)
        .query(`
          SELECT *
          FROM Puestos
          WHERE id_puesto = @id_puesto
        `);
      return result.recordset[0];
    } catch (err) {
      throw err;
    }
  }

  // Crear un nuevo puesto
  static async create({ nombre }) {
    try {
      const pool = await poolPromise;
      const result = await pool.request()
        .input('nombre', sql.NVarChar(100), nombre)
        .query(`
          INSERT INTO Puestos (nombre)
          VALUES (@nombre);
          SELECT SCOPE_IDENTITY() AS id_puesto;
        `);
      return result.recordset[0]; // { id_puesto: xxx }
    } catch (err) {
      throw err;
    }
  }

  // Actualizar un puesto
  static async update(id_puesto, { nombre }) {
    try {
      const pool = await poolPromise;
      await pool.request()
        .input('id_puesto', sql.Int, id_puesto)
        .input('nombre', sql.NVarChar(100), nombre)
        .query(`
          UPDATE Puestos
          SET nombre = @nombre
          WHERE id_puesto = @id_puesto
        `);
      return { message: 'Puesto actualizado' };
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Puesto;
