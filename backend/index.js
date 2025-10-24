const express = require('express');
const cors = require('cors');
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

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

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

// Puerto
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
