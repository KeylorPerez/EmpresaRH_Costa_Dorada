const express = require('express');
const router = express.Router();
const { getEmpleados } = require('../controllers/empleadoController');

router.get('/', getEmpleados);

module.exports = router;
