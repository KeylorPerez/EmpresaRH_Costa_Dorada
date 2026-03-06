/**
 * Configuración central de la conexión a SQL Server. Expone el pool
 * de conexiones reutilizable y el objeto `sql` para tipar parámetros
 * en los modelos.
 */
const sql = require('mssql');
require('dotenv').config();

const rawServer = process.env.DB_SERVER || 'localhost';
const [serverName, instanceNameFromServer] = rawServer.split('\\');

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: serverName,
    database: process.env.DB_DATABASE,
    options: {
        encrypt: false, // Cambiar a true si usas Azure
        trustServerCertificate: true // Para desarrollo local
    }
};

const parsedPort = Number.parseInt(process.env.DB_PORT, 10);
if (Number.isInteger(parsedPort)) {
    config.port = parsedPort;
}

const sqlInstanceName = process.env.DB_INSTANCE || instanceNameFromServer;
if (sqlInstanceName) {
    config.options.instanceName = sqlInstanceName;
}

const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Conectado a SQL Server');
        return pool;
    })
    .catch(err => {
        console.error('DB Connection Error:', err);
        throw err;
    });

module.exports = {
    sql, poolPromise
};
