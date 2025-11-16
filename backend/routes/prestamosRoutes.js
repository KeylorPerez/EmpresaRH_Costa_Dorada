/**
 * Rutas de préstamos. Exponen los endpoints para solicitar, actualizar
 * y cancelar adelantos, además de permitir la exportación del detalle.
 */
const express = require('express');
const router = express.Router();
const {
  getPrestamos,
  getPrestamoById,
  createPrestamo,
  pagarPrestamo,
  updateEstadoPrestamo,
  exportPrestamoPdf,
} = require('../controllers/prestamosController');

const { authenticateToken, authorizeRoles } = require('../middleware/authMiddleware');

// GET /api/prestamos -> admin: todos / empleado: solo los suyos
router.get('/', authenticateToken, getPrestamos);

// GET /api/prestamos/:id/export -> generar constancia en PDF
router.get('/:id/export', authenticateToken, exportPrestamoPdf);

// GET /api/prestamos/:id -> préstamo específico
router.get('/:id', authenticateToken, getPrestamoById);

// POST /api/prestamos -> crear préstamo (empleado solo para sí, admin puede para cualquiera)
router.post('/', authenticateToken, createPrestamo);

// PUT /api/prestamos/:id/pagar -> registrar pago de préstamo (autenticado)
router.put('/:id/pagar', authenticateToken, pagarPrestamo);

// PUT /api/prestamos/:id/estado -> actualizar estado (solo admin)
router.put('/:id/estado', authenticateToken, authorizeRoles(1), updateEstadoPrestamo);

module.exports = router;
