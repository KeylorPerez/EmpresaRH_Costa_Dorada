const NESTED_SOURCES = [
  "empleado",
  "colaborador",
  "employee",
  "worker",
  "persona",
  "empleadoInfo",
  "employeeInfo",
  "colaboradorInfo",
  "datosEmpleado",
  "datosColaborador",
];

const isUsableValue = (value, allowEmptyString = true) => {
  if (value === undefined || value === null) {
    return false;
  }

  if (!allowEmptyString && typeof value === "string" && value.trim() === "") {
    return false;
  }

  return true;
};

const pickFromObject = (source, keys, allowEmptyString) => {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(source, key) || key in source) {
      const value = source[key];
      if (isUsableValue(value, allowEmptyString)) {
        return value;
      }
    }
  }

  return undefined;
};

export const pickPlanillaValue = (
  planilla,
  keys,
  { includeNested = false, allowEmptyString = true } = {}
) => {
  const candidates = Array.isArray(keys) ? keys : [keys];

  const direct = pickFromObject(planilla, candidates, allowEmptyString);
  if (direct !== undefined) {
    return direct;
  }

  if (includeNested) {
    for (const nestedKey of NESTED_SOURCES) {
      const nested = pickFromObject(planilla?.[nestedKey], candidates, allowEmptyString);
      if (nested !== undefined) {
        return nested;
      }
    }
  }

  return undefined;
};

const assignCanonicalValue = (
  normalized,
  original,
  targetKey,
  keys,
  { includeNested = false, allowEmptyString = true } = {}
) => {
  const currentValue = normalized[targetKey];
  if (isUsableValue(currentValue, allowEmptyString)) {
    return;
  }

  const candidate = pickPlanillaValue(original, keys, { includeNested, allowEmptyString });
  if (isUsableValue(candidate, allowEmptyString)) {
    normalized[targetKey] = candidate;
  }
};

export const ensurePlanillaCanonical = (planilla) => {
  if (!planilla || typeof planilla !== "object") {
    return planilla ?? null;
  }

  const normalized = { ...planilla };

  assignCanonicalValue(normalized, planilla, "id_planilla", [
    "id_planilla",
    "idPlanilla",
    "planilla_id",
    "planillaId",
    "id",
  ], { includeNested: false, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "id_empleado", [
    "id_empleado",
    "idEmpleado",
    "empleado_id",
    "empleadoId",
  ], { includeNested: true, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "periodo_inicio", [
    "periodo_inicio",
    "periodoInicio",
  ], { includeNested: false, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "periodo_fin", [
    "periodo_fin",
    "periodoFin",
  ], { includeNested: false, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "fecha_pago", [
    "fecha_pago",
    "fechaPago",
  ], { includeNested: false, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "horas_extras", [
    "horas_extras",
    "horasExtras",
  ], { includeNested: false, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "bonificaciones", [
    "bonificaciones",
    "bonos",
    "bono",
    "bonificacion",
    "bonificacion_total",
    "bonificacionesTotales",
  ], { includeNested: false, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "deducciones", [
    "deducciones",
    "otras_deducciones",
    "otrasDeducciones",
  ], { includeNested: false, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "salario_monto", [
    "salario_monto",
    "salarioMonto",
    "salario_base",
    "salarioBase",
  ], { includeNested: true, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "salario_bruto", [
    "salario_bruto",
    "salarioBruto",
  ], { includeNested: false, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "ccss_deduccion", [
    "ccss_deduccion",
    "ccssDeduccion",
  ], { includeNested: false, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "pago_neto", [
    "pago_neto",
    "pagoNeto",
  ], { includeNested: false, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "nombre", ["nombre"], {
    includeNested: true,
    allowEmptyString: false,
  });

  assignCanonicalValue(normalized, planilla, "apellido", ["apellido"], {
    includeNested: true,
    allowEmptyString: false,
  });

  assignCanonicalValue(normalized, planilla, "nombre_completo", [
    "nombre_completo",
    "nombreCompleto",
    "nombre_colaborador",
    "nombreColaborador",
  ], { includeNested: true, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "tipo_pago_empleado", [
    "tipo_pago_empleado",
    "tipoPagoEmpleado",
  ], { includeNested: true, allowEmptyString: false });

  assignCanonicalValue(normalized, planilla, "tipo_pago", [
    "tipo_pago",
    "tipoPago",
  ], { includeNested: true, allowEmptyString: false });

  return normalized;
};

export const resolvePlanillaId = (planilla) => {
  const normalized = ensurePlanillaCanonical(planilla);
  const value = pickPlanillaValue(normalized, [
    "id_planilla",
    "idPlanilla",
    "planilla_id",
    "planillaId",
    "id",
  ], { allowEmptyString: false });
  return value ?? null;
};

export const resolveEmpleadoId = (planilla) => {
  const normalized = ensurePlanillaCanonical(planilla);
  const value = pickPlanillaValue(normalized, [
    "id_empleado",
    "idEmpleado",
    "empleado_id",
    "empleadoId",
  ], { includeNested: true, allowEmptyString: false });
  return value ?? null;
};

export const getPlanillaNumericField = (planilla, keys, { includeNested = false } = {}) => {
  const normalized = ensurePlanillaCanonical(planilla);
  const value = pickPlanillaValue(normalized, keys, {
    includeNested,
    allowEmptyString: false,
  });

  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string" && value.trim() === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const getPlanillaDateField = (planilla, keys) => {
  const normalized = ensurePlanillaCanonical(planilla);
  const value = pickPlanillaValue(normalized, keys, { allowEmptyString: false });
  return value ?? null;
};

export const getPlanillaTipoPagoValue = (planilla) =>
  pickPlanillaValue(ensurePlanillaCanonical(planilla), [
    "tipo_pago_empleado",
    "tipoPagoEmpleado",
    "tipo_pago",
    "tipoPago",
  ], { includeNested: true, allowEmptyString: false });

export const buildPlanillaDisplayName = (planilla) => {
  const normalized = ensurePlanillaCanonical(planilla);
  if (!normalized) {
    return "";
  }

  const parts = [normalized.nombre, normalized.apellido]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter((value) => value.length > 0);

  if (parts.length > 0) {
    return parts.join(" ");
  }

  const fullName = pickPlanillaValue(normalized, [
    "nombre_completo",
    "nombreCompleto",
    "nombre_colaborador",
    "nombreColaborador",
  ], { includeNested: true, allowEmptyString: false });

  if (typeof fullName === "string" && fullName.trim().length > 0) {
    return fullName.trim();
  }

  const empleadoId = resolveEmpleadoId(normalized);
  if (empleadoId !== null && empleadoId !== undefined) {
    return `ID ${empleadoId}`;
  }

  return "Sin nombre";
};

export const clonePlanillaWithCanonicalFields = (planilla) => {
  const normalized = ensurePlanillaCanonical(planilla);
  return normalized ? { ...normalized } : normalized;
};

export const ensurePlanillaArrayCanonical = (planillas) => {
  if (!Array.isArray(planillas)) {
    return [];
  }

  return planillas
    .map((item) => ensurePlanillaCanonical(item))
    .filter((item) => item && typeof item === "object");
};

export default ensurePlanillaCanonical;
