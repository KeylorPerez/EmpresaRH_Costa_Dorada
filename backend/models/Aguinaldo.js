const { poolPromise, sql } = require('../db/db');

const toYearMonth = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

class Aguinaldo {
  static async getAll() {
    try {
      const pool = await poolPromise;
      const result = await pool.request().query(`
          SELECT a.*, e.nombre, e.apellido, e.cedula, e.email
          FROM Aguinaldos a
          LEFT JOIN Empleados e ON a.id_empleado = e.id_empleado
          ORDER BY a.anio DESC, e.nombre, e.apellido
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async getByEmpleado(id_empleado) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('id_empleado', sql.Int, id_empleado)
        .query(`
          SELECT a.*, e.nombre, e.apellido, e.cedula, e.email
          FROM Aguinaldos a
          LEFT JOIN Empleados e ON a.id_empleado = e.id_empleado
          WHERE a.id_empleado = @id_empleado
          ORDER BY a.anio DESC
        `);
      return result.recordset;
    } catch (err) {
      throw err;
    }
  }

  static async getById(id_aguinaldo) {
    try {
      const pool = await poolPromise;
      const result = await pool
        .request()
        .input('id_aguinaldo', sql.Int, id_aguinaldo)
        .query(`
          SELECT a.*, e.nombre, e.apellido, e.cedula, e.email
          FROM Aguinaldos a
          LEFT JOIN Empleados e ON a.id_empleado = e.id_empleado
          WHERE a.id_aguinaldo = @id_aguinaldo
        `);
      return result.recordset[0] || null;
    } catch (err) {
      throw err;
    }
  }

  static async calcularYGuardar({ id_empleado, anio }) {
    try {
      const pool = await poolPromise;

      const inicioPeriodo = new Date(anio - 1, 11, 1);
      const finPeriodo = new Date(anio, 10, 30, 23, 59, 59, 997);

      const planillaResult = await pool
        .request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('inicio_periodo', sql.Date, inicioPeriodo)
        .input('fin_periodo', sql.Date, finPeriodo)
        .query(`
          SELECT pago_neto, periodo_inicio, periodo_fin
          FROM Planilla
          WHERE id_empleado = @id_empleado
            AND (
              (periodo_inicio BETWEEN @inicio_periodo AND @fin_periodo)
              OR (periodo_fin BETWEEN @inicio_periodo AND @fin_periodo)
            )
        `);

      const registros = planillaResult.recordset;

      if (!Array.isArray(registros) || registros.length === 0) {
        const error = new Error('No se encontraron planillas para calcular el aguinaldo en el periodo indicado');
        error.statusCode = 404;
        throw error;
      }

      const totalPagos = registros.reduce((sum, row) => {
        const valor = Number(row.pago_neto) || 0;
        return sum + valor;
      }, 0);

      const mesesLaborados = registros.reduce((set, row) => {
        const referencia = row.periodo_fin || row.periodo_inicio;
        const ym = toYearMonth(referencia);
        if (ym) set.add(ym);
        return set;
      }, new Set());

      const mesesCount = mesesLaborados.size > 0 ? mesesLaborados.size : 12;

      const salarioPromedio = Number(
        (mesesCount > 0 ? totalPagos / mesesCount : 0).toFixed(2)
      );
      const montoAguinaldo = Number((totalPagos / 12).toFixed(2));

      const existenteResult = await pool
        .request()
        .input('id_empleado', sql.Int, id_empleado)
        .input('anio', sql.Int, anio)
        .query(`
          SELECT TOP 1 id_aguinaldo, pagado
          FROM Aguinaldos
          WHERE id_empleado = @id_empleado AND anio = @anio
        `);

      const existente = existenteResult.recordset[0];
      let idAguinaldo;
      let pagadoActual = false;

      if (existente) {
        idAguinaldo = Number(existente.id_aguinaldo);
        pagadoActual = Boolean(existente.pagado);

        await pool
          .request()
          .input('id_aguinaldo', sql.Int, idAguinaldo)
          .input('salario_promedio', sql.Decimal(12, 2), salarioPromedio)
          .input('monto_aguinaldo', sql.Decimal(12, 2), montoAguinaldo)
          .query(`
            UPDATE Aguinaldos
            SET salario_promedio = @salario_promedio,
                monto_aguinaldo = @monto_aguinaldo,
                fecha_calculo = GETDATE()
            WHERE id_aguinaldo = @id_aguinaldo
          `);
      } else {
        const insertResult = await pool
          .request()
          .input('id_empleado', sql.Int, id_empleado)
          .input('anio', sql.Int, anio)
          .input('salario_promedio', sql.Decimal(12, 2), salarioPromedio)
          .input('monto_aguinaldo', sql.Decimal(12, 2), montoAguinaldo)
          .query(`
            INSERT INTO Aguinaldos (id_empleado, anio, salario_promedio, monto_aguinaldo, fecha_calculo, pagado)
            VALUES (@id_empleado, @anio, @salario_promedio, @monto_aguinaldo, GETDATE(), 0);
            SELECT SCOPE_IDENTITY() AS id_aguinaldo;
          `);

        idAguinaldo = Number(insertResult.recordset[0]?.id_aguinaldo);
        pagadoActual = false;
      }

      if (!Number.isInteger(idAguinaldo) || idAguinaldo <= 0) {
        throw new Error('No fue posible determinar el identificador del aguinaldo calculado');
      }

      const aguinaldo = await this.getById(idAguinaldo);
      if (!aguinaldo) {
        return {
          id_aguinaldo: idAguinaldo,
          id_empleado,
          anio,
          salario_promedio: salarioPromedio,
          monto_aguinaldo: montoAguinaldo,
          fecha_calculo: new Date().toISOString(),
          pagado: pagadoActual,
        };
      }

      return aguinaldo;
    } catch (err) {
      throw err;
    }
  }

  static async actualizarPago(id_aguinaldo, pagado) {
    try {
      const pool = await poolPromise;
      const resultado = await pool
        .request()
        .input('id_aguinaldo', sql.Int, id_aguinaldo)
        .input('pagado', sql.Bit, pagado ? 1 : 0)
        .query(`
          UPDATE Aguinaldos
          SET pagado = @pagado
          WHERE id_aguinaldo = @id_aguinaldo;
          SELECT @@ROWCOUNT AS filas_afectadas;
        `);

      const filas = Number(resultado.recordset[0]?.filas_afectadas || 0);
      if (filas === 0) {
        const error = new Error('Aguinaldo no encontrado');
        error.statusCode = 404;
        throw error;
      }

      return this.getById(id_aguinaldo);
    } catch (err) {
      throw err;
    }
  }
}

module.exports = Aguinaldo;
