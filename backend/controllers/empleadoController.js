const Empleado = require('../models/Empleado');

// Obtener todos los empleados (solo activos)
const getEmpleados = async (req, res) => {
  try {
    const empleados = await Empleado.getAll();
    res.json(empleados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Obtener un empleado por ID (solo si está activo)
const getEmpleadoById = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const empleado = await Empleado.getById(id);
    if (!empleado) return res.status(404).json({ error: 'Empleado no encontrado o inactivo' });

    res.json(empleado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Crear un nuevo empleado (solo admin)
const createEmpleado = async (req, res) => {
  try {
    const {
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento,
      telefono,
      email,
      fecha_ingreso,
      salario_monto,
      tipo_pago,
      bonificacion_fija,
      porcentaje_ccss,
      usa_deduccion_fija,
      deduccion_fija,
      permitir_marcacion_fuera,
    } = req.body;

    if (
      !nombre ||
      !apellido ||
      !id_puesto ||
      !cedula ||
      !fecha_ingreso ||
      !salario_monto ||
      !tipo_pago
    ) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    if (!['Diario', 'Quincenal'].includes(tipo_pago)) {
      return res.status(400).json({ error: 'Tipo de pago inválido' });
    }

    const bonificacionValue =
      bonificacion_fija !== undefined && bonificacion_fija !== null
        ? Number(bonificacion_fija)
        : 0;

    if (Number.isNaN(bonificacionValue)) {
      return res.status(400).json({ error: 'Bonificación fija inválida' });
    }

    const porcentajeValue =
      porcentaje_ccss !== undefined && porcentaje_ccss !== null
        ? Number(porcentaje_ccss)
        : 9.34;
    if (Number.isNaN(porcentajeValue) || porcentajeValue < 0) {
      return res.status(400).json({ error: 'Porcentaje CCSS inválido' });
    }

    const usaDeduccionFijaValue =
      usa_deduccion_fija !== undefined && usa_deduccion_fija !== null
        ? Number(usa_deduccion_fija) === 1 || usa_deduccion_fija === true
        : false;

    const deduccionFijaValue =
      deduccion_fija !== undefined && deduccion_fija !== null
        ? Number(deduccion_fija)
        : 0;
    if (Number.isNaN(deduccionFijaValue) || deduccionFijaValue < 0) {
      return res.status(400).json({ error: 'Deducción fija inválida' });
    }

    const permitirMarcacionFueraValue =
      permitir_marcacion_fuera !== undefined && permitir_marcacion_fuera !== null
        ? Number(permitir_marcacion_fuera) === 1 || permitir_marcacion_fuera === true
        : false;

    const empleado = await Empleado.create({
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono: telefono || null,
      email: email || null,
      fecha_ingreso,
      salario_monto,
      tipo_pago,
      bonificacion_fija: bonificacionValue,
      porcentaje_ccss: porcentajeValue,
      usa_deduccion_fija: usaDeduccionFijaValue ? 1 : 0,
      deduccion_fija: usaDeduccionFijaValue ? deduccionFijaValue : 0,
      permitir_marcacion_fuera: permitirMarcacionFueraValue ? 1 : 0,
    });

    res.status(201).json({
      message: 'Empleado creado correctamente',
      id_empleado: empleado.id_empleado
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Actualizar un empleado (solo admin)
const updateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    const {
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento,
      telefono,
      email,
      fecha_ingreso,
      salario_monto,
      tipo_pago,
      bonificacion_fija,
      porcentaje_ccss,
      usa_deduccion_fija,
      deduccion_fija,
      permitir_marcacion_fuera,
      estado
    } = req.body;

    if (tipo_pago && !['Diario', 'Quincenal'].includes(tipo_pago)) {
      return res.status(400).json({ error: 'Tipo de pago inválido' });
    }

    const bonificacionValue =
      bonificacion_fija !== undefined && bonificacion_fija !== null
        ? Number(bonificacion_fija)
        : null;

    if (bonificacionValue !== null && Number.isNaN(bonificacionValue)) {
      return res.status(400).json({ error: 'Bonificación fija inválida' });
    }

    const porcentajeValue =
      porcentaje_ccss !== undefined && porcentaje_ccss !== null
        ? Number(porcentaje_ccss)
        : null;
    if (porcentajeValue !== null && (Number.isNaN(porcentajeValue) || porcentajeValue < 0)) {
      return res.status(400).json({ error: 'Porcentaje CCSS inválido' });
    }

    const usaDeduccionFijaValue =
      usa_deduccion_fija !== undefined && usa_deduccion_fija !== null
        ? Number(usa_deduccion_fija) === 1 || usa_deduccion_fija === true
        : null;

    const deduccionFijaValue =
      deduccion_fija !== undefined && deduccion_fija !== null
        ? Number(deduccion_fija)
        : null;
    if (deduccionFijaValue !== null && (Number.isNaN(deduccionFijaValue) || deduccionFijaValue < 0)) {
      return res.status(400).json({ error: 'Deducción fija inválida' });
    }

    const permitirMarcacionFueraValue =
      permitir_marcacion_fuera !== undefined && permitir_marcacion_fuera !== null
        ? Number(permitir_marcacion_fuera) === 1 || permitir_marcacion_fuera === true
        : null;

    await Empleado.update(id, {
      nombre,
      apellido,
      id_puesto,
      cedula,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono: telefono || null,
      email: email || null,
      fecha_ingreso,
      salario_monto,
      tipo_pago,
      bonificacion_fija: bonificacionValue,
      porcentaje_ccss: porcentajeValue,
      usa_deduccion_fija:
        usaDeduccionFijaValue === null
          ? null
          : usaDeduccionFijaValue
          ? 1
          : 0,
      deduccion_fija:
        deduccionFijaValue === null
          ? null
          : usaDeduccionFijaValue
          ? deduccionFijaValue || 0
          : 0,
      permitir_marcacion_fuera:
        permitirMarcacionFueraValue === null
          ? null
          : permitirMarcacionFueraValue
          ? 1
          : 0,
      estado
    });

    res.json({ message: 'Empleado actualizado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Desactivar un empleado (soft delete)
const deactivateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    await Empleado.deactivate(id);
    res.json({ message: 'Empleado desactivado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Activar un empleado (revertir desactivación)
const activateEmpleado = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'ID inválido' });

    await Empleado.activate(id);
    res.json({ message: 'Empleado activado correctamente' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getEmpleados,
  getEmpleadoById,
  createEmpleado,
  updateEmpleado,
  deactivateEmpleado,
  activateEmpleado
};
