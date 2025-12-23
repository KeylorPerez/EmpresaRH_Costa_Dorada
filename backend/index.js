/**
 * Punto de arranque del API de recursos humanos. Configura la aplicación
 * Express, registra los middlewares comunes y expone todas las rutas
 * especializadas que atienden los módulos del sistema.
 */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Rutas
const empleadoRoutes = require('./routes/empleadoRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const authRoutes = require('./routes/authRoutes');
const asistenciaRoutes = require('./routes/asistenciaRoutes');
const vacacionesRoutes = require('./routes/vacacionesRoutes');
const prestamosRoutes = require('./routes/prestamosRoutes');
const planillaRoutes = require('./routes/planillaRoutes');
const liquidacionRoutes = require('./routes/liquidacionRoutes');
const puestoRoutes = require('./routes/puestoRoutes');
const aguinaldoRoutes = require('./routes/aguinaldoRoutes');
const diasDoblesRoutes = require('./routes/diasDoblesRoutes');

const app = express();

// Directorio donde se almacenan los archivos generados (PDF, Excel, etc.)
// y que será expuesto estáticamente.
const EXPORTS_DIR = path.join(__dirname, 'exports');
if (!fs.existsSync(EXPORTS_DIR)) {
  fs.mkdirSync(EXPORTS_DIR, { recursive: true });
}

// Middlewares
// Confiar en los encabezados de proxy para detectar correctamente el esquema
// (http/https) cuando la app está detrás de un balanceador o servicio de hosting.
// Esto evita que se generen URLs con http que luego los navegadores bloquean
// como descargas inseguras.
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use('/files', express.static(EXPORTS_DIR));

// Endpoints
app.use('/api/empleados', empleadoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/vacaciones', vacacionesRoutes);
app.use('/api/prestamos', prestamosRoutes);
app.use('/api/planilla', planillaRoutes);
app.use('/api/liquidaciones', liquidacionRoutes);
app.use('/api/puestos', puestoRoutes);
app.use('/api/aguinaldos', aguinaldoRoutes);
app.use('/api/dias-dobles', diasDoblesRoutes);

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
