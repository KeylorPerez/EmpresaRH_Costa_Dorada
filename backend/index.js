const express = require('express');
const cors = require('cors');
require('dotenv').config();

const empleadoRoutes = require('./routes/empleadoRoutes');
const usuarioRoutes = require('./routes/usuarioRoutes');
const authRoutes = require('./routes/authRoutes');
const asistenciaRoutes = require('./routes/asistenciaRoutes');
const vacacionesRoutes = require('./routes/vacacionesRoutes'); 
const prestamosRoutes = require('./routes/prestamosRoutes');
const planillaRoutes = require('./routes/planillaRoutes');
const liquidacionRoutes = require('./routes/liquidacionRoutes');




const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/empleados', empleadoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/asistencia', asistenciaRoutes);
app.use('/api/vacaciones', vacacionesRoutes); 
app.use('/api/prestamos', prestamosRoutes)
app.use('/api/planilla', planillaRoutes);
app.use('/api/liquidaciones', liquidacionRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
