import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import planillaService from "../services/planillaService";
import empleadoService from "../services/empleadoService";
import prestamosService from "../services/prestamosService";
import asistenciaService from "../services/asistenciaService";
import diasDoblesService from "../services/diasDoblesService";
import empleadoDescansosService from "../services/empleadoDescansosService";
import { parseDateValue } from "../utils/dateUtils";
import { parseNumberInput, toPositiveNumber } from "../utils/numberUtils";
import {
  ensurePlanillaArrayCanonical,
  ensurePlanillaCanonical,
  resolvePlanillaId,
} from "../utils/planillaUtils";

const ESTADOS_ASISTENCIA = [
  "Presente",
  "Ausente",
  "Permiso",
  "Vacaciones",
  "Incapacidad",
];

export const detalleEstadoOptions = ESTADOS_ASISTENCIA.map((estado) => ({
  value: estado,
  label: estado,
}));

const estadoAsistenciaSet = new Set(ESTADOS_ASISTENCIA);
const ESTADO_PRESENTE = "Presente";
const ESTADO_AUSENTE = "Ausente";
const ESTADO_PERMISO = "Permiso";
const ESTADO_VACACIONES = "Vacaciones";
const ESTADO_INCAPACIDAD = "Incapacidad";
const ESTADO_DESCANSO = "Descanso";
const ESTADO_PAGADO = "Pagado";
const ESTADO_FIJO_SEMANAL = "FIJO_SEMANAL";
const ESTADO_ALTERNADO_SEMANAL = "ALTERNADO_SEMANAL";
const ESTADO_FECHA_UNICA = "FECHA_UNICA";
const ESTADO_RANGO_FECHAS = "RANGO_FECHAS";
const SALARIO_CERO_TEXTO = Number(0).toFixed(2);
const DIAS_POR_QUINCENA = 15;
const DIAS_POR_MES = 30;
const MS_POR_DIA = 1000 * 60 * 60 * 24;
const MAX_AUSENCIAS_PAGADAS = 2;
const MAX_AUSENCIAS_SIN_JUSTIFICAR = 3;

const obtenerDiasReferencia = (tipoPago) =>
  tipoPago === "Mensual" ? DIAS_POR_MES : DIAS_POR_QUINCENA;

const parseDateSafe = (value) => parseDateValue(value);

const matchesDetalleKey = (currentKey, baseKey) =>
  Boolean(currentKey) &&
  (currentKey === baseKey || currentKey.startsWith(`${baseKey}-`));

const calcularDiasPeriodo = (inicio, fin) => {
  if (!inicio || !fin) return 0;
  const fechaInicio = parseDateSafe(inicio);
  const fechaFin = parseDateSafe(fin);
  if (!fechaInicio || !fechaFin) return 0;
  const diferencia = Math.floor((fechaFin - fechaInicio) / MS_POR_DIA) + 1;
  return Math.max(diferencia, 0);
};

const isEmptyValue = (value) => value === "" || value === null || value === undefined;

const estadosAsistenciaManual = new Set([
  ESTADO_AUSENTE,
  ESTADO_PERMISO,
  ESTADO_VACACIONES,
  ESTADO_INCAPACIDAD,
]);

const prioridadEstadoAsistenciaManual = {
  [ESTADO_INCAPACIDAD]: 4,
  [ESTADO_VACACIONES]: 3,
  [ESTADO_PERMISO]: 2,
  [ESTADO_AUSENTE]: 1,
};

const formatMontoPositivo = (valor) => {
  const numero = parseNumberInput(valor);
  if (Number.isNaN(numero)) {
    return Number(0).toFixed(2);
  }
  return Math.max(numero, 0).toFixed(2);
};

const formatDateKey = (value) => {
  if (!value) return "";
  if (typeof value === "string") {
    const texto = value.trim();
    if (!texto) return "";
    return texto.split("T")[0];
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return "";
};



const getDayOfWeekMonToSun = (value) => {
  const date = parseDateSafe(value);
  if (!date) return null;
  const day = date.getDay();
  return day === 0 ? 7 : day;
};

const resolveEsDescansoPorReglas = (fecha, reglas = []) => {
  const fechaDate = parseDateSafe(fecha);
  if (!fechaDate) return false;
  const fechaKey = formatDateKey(fechaDate);
  const dow = getDayOfWeekMonToSun(fechaDate);

  const activas = Array.isArray(reglas)
    ? reglas.filter((item) => item && (item.estado === true || Number(item.estado) === 1))
    : [];

  const inRange = (regla) => {
    const inicio = parseDateSafe(regla?.fecha_inicio);
    if (!inicio || fechaDate < inicio) return false;
    const fin = regla?.fecha_fin ? parseDateSafe(regla.fecha_fin) : null;
    if (fin && fechaDate > fin) return false;
    return true;
  };

  if (activas.some((regla) => regla.tipo_descanso === ESTADO_FECHA_UNICA && formatDateKey(regla.fecha_inicio) === fechaKey)) {
    return true;
  }

  if (activas.some((regla) => regla.tipo_descanso === ESTADO_RANGO_FECHAS && inRange(regla))) {
    return true;
  }

  if (
    activas.some((regla) => {
      if (regla.tipo_descanso !== ESTADO_ALTERNADO_SEMANAL || !inRange(regla)) return false;
      const inicio = parseDateSafe(regla.fecha_inicio);
      if (!inicio) return false;
      const diffDays = Math.floor((fechaDate - inicio) / MS_POR_DIA);
      if (diffDays < 0) return false;
      const esSemanaPar = Math.floor(diffDays / 7) % 2 === 0;
      const diaObjetivo = esSemanaPar ? Number(regla.dia_semana) : Number(regla.dia_semana_alterno);
      return Number.isInteger(diaObjetivo) && diaObjetivo === dow;
    })
  ) {
    return true;
  }

  return activas.some((regla) => {
    if (regla.tipo_descanso !== ESTADO_FIJO_SEMANAL || !inRange(regla)) return false;
    return Number(regla.dia_semana) === dow;
  });
};

const normalizeSalarioBase = (valor) => {
  const numero = parseNumberInput(valor);
  if (Number.isNaN(numero) || numero < 0) {
    return 0;
  }
  return Number(numero.toFixed(2));
};

const normalizeDetallePlanillaRegistro = (detalle) => {
  if (!detalle || typeof detalle !== "object") {
    return null;
  }

  const fechaRaw = detalle.fecha;
  const fecha = (() => {
    if (!fechaRaw) return "";
    if (fechaRaw instanceof Date) {
      const year = fechaRaw.getFullYear();
      const month = String(fechaRaw.getMonth() + 1).padStart(2, "0");
      const day = String(fechaRaw.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
    if (typeof fechaRaw === "string") {
      const texto = fechaRaw.trim();
      if (!texto) return "";
      return texto.split("T")[0];
    }
    return "";
  })();

  if (!fecha) {
    return null;
  }

  const diaSemana = typeof detalle.dia_semana === "string" ? detalle.dia_semana : "";

  const asistio = Boolean(
    detalle.asistio === true || Number(detalle.asistio) === 1,
  );
  const esDiaDoble = Boolean(
    detalle.es_dia_doble === true || Number(detalle.es_dia_doble) === 1,
  );

  const multiplicadorDiaDoble = (() => {
    const raw = detalle.multiplicador_dia_doble ?? detalle.multiplicador;
    const valor = Number(raw);
    if (Number.isFinite(valor) && valor >= 1) {
      return valor;
    }
    return esDiaDoble ? 2 : null;
  })();

  const salarioDiaNumero = (() => {
    const numero = parseNumberInput(detalle.salario_dia);
    if (Number.isNaN(numero)) {
      return 0;
    }
    return Math.max(numero, 0);
  })();

  const salarioDiaTexto = formatMontoPositivo(salarioDiaNumero);

  const salarioBase = (() => {
    const baseRegistro = parseNumberInput(detalle.salario_base);
    if (!Number.isNaN(baseRegistro) && baseRegistro > 0) {
      return Number(baseRegistro.toFixed(2));
    }
    if (salarioDiaNumero > 0) {
      const divisor = esDiaDoble ? 2 : 1;
      if (divisor > 0) {
        return Number((salarioDiaNumero / divisor).toFixed(2));
      }
    }
    return 0;
  })();

  const estado = (() => {
    if (typeof detalle.estado === "string") {
      const texto = detalle.estado.trim();
      if (estadoAsistenciaSet.has(texto) || texto === ESTADO_PAGADO) {
        return texto;
      }
    }
    return asistio ? ESTADO_PRESENTE : ESTADO_AUSENTE;
  })();

  const esDescanso = Boolean(
    detalle.es_descanso === true || Number(detalle.es_descanso) === 1,
  );
  const estadoFinal = esDescanso ? ESTADO_DESCANSO : estado;

  const justificado = Boolean(
    detalle.justificado === true || Number(detalle.justificado) === 1,
  );

  const justificacion = justificado
    ? detalle.justificacion !== undefined && detalle.justificacion !== null
      ? String(detalle.justificacion)
      : ""
    : "";

  const observacion =
    detalle.observacion !== undefined && detalle.observacion !== null
      ? String(detalle.observacion)
      : "";
  const horaEntradaRaw = detalle.hora_entrada ?? detalle.horaEntrada ?? null;
  const horaSalidaRaw = detalle.hora_salida ?? detalle.horaSalida ?? null;
  const hora_entrada =
    typeof horaEntradaRaw === "string" ? horaEntradaRaw.trim() : horaEntradaRaw;
  const hora_salida =
    typeof horaSalidaRaw === "string" ? horaSalidaRaw.trim() : horaSalidaRaw;

  return {
    fecha,
    dia_semana: diaSemana,
    salario_base: normalizeSalarioBase(salarioBase),
    salario_dia: salarioDiaTexto,
    asistio,
    es_dia_doble: esDiaDoble,
    multiplicador_dia_doble: multiplicadorDiaDoble,
    es_descanso: esDescanso || estadoFinal === ESTADO_DESCANSO,
    estado: estadoFinal,
    justificado,
    justificacion,
    observacion,
    hora_entrada,
    hora_salida,
    autoJustificacion: false,
    asistenciaManual: true,
    dia_doble_manual: false,
  };
};

const obtenerSalarioBaseDetalle = (detalle) => {
  if (!detalle) return 0;

  const base = normalizeSalarioBase(detalle.salario_base);
  if (base > 0) {
    return base;
  }

  const salarioActual = normalizeSalarioBase(detalle.salario_dia);
  if (salarioActual > 0) {
    const multiplicador = (() => {
      const valor = Number(detalle.multiplicador_dia_doble);
      if (Number.isFinite(valor) && valor > 1) {
        return valor;
      }
      return detalle.es_dia_doble ? 2 : 1;
    })();

    const divisor = multiplicador > 1 ? multiplicador : 1;
    return salarioActual / divisor;
  }

  return 0;
};

const DETALLE_JUSTIFICACIONES_INICIAL = {
  key: "",
  loading: false,
  registros: [],
  error: "",
};

const normalizeEstado = (value) => {
  if (typeof value !== "string") return ESTADO_PRESENTE;
  const trimmed = value.trim();
  if (trimmed === ESTADO_PAGADO) {
    return ESTADO_DESCANSO;
  }
  return estadoAsistenciaSet.has(trimmed) ? trimmed : ESTADO_PRESENTE;
};

const resolveEstadoPersistencia = (detalle) => {
  if (detalle?.es_descanso && !detalle?.asistio) {
    return ESTADO_DESCANSO;
  }
  return normalizeEstado(detalle?.estado);
};

const ajustarEstadoPorAsistencia = (estadoActual, asistio) => {
  const normalizado = normalizeEstado(estadoActual);
  if (asistio) {
    if (normalizado === ESTADO_DESCANSO) {
      return ESTADO_PRESENTE;
    }
    if (!estadoAsistenciaSet.has(normalizado) || normalizado === ESTADO_AUSENTE) {
      return ESTADO_PRESENTE;
    }
    return normalizado;
  }

  if (normalizado === ESTADO_DESCANSO) {
    return ESTADO_DESCANSO;
  }

  if (!estadoAsistenciaSet.has(normalizado) || normalizado === ESTADO_PRESENTE) {
    return ESTADO_AUSENTE;
  }
  return normalizado;
};

const resolveJustificacionTexto = (registro) => {
  const texto =
    registro.justificacion === undefined || registro.justificacion === null
      ? ""
      : String(registro.justificacion).trim();

  if (texto) return texto;

  const tipo =
    registro.justificacion_solicitud_tipo === undefined ||
    registro.justificacion_solicitud_tipo === null
      ? ""
      : String(registro.justificacion_solicitud_tipo).trim();

  const respuesta =
    registro.justificacion_solicitud_respuesta === undefined ||
    registro.justificacion_solicitud_respuesta === null
      ? ""
      : String(registro.justificacion_solicitud_respuesta).trim();

  const descripcion =
    registro.justificacion_solicitud_descripcion === undefined ||
    registro.justificacion_solicitud_descripcion === null
      ? ""
      : String(registro.justificacion_solicitud_descripcion).trim();

  const partes = [tipo, descripcion, respuesta].filter((parte) => parte.length > 0);
  if (partes.length > 0) {
    return partes.join(" - ");
  }

  return "";
};

const normalizarJustificacionRegistro = (registro) => {
  if (!registro) return null;

  const fecha = typeof registro.fecha === "string" ? registro.fecha.trim() : "";
  if (!fecha) return null;

  const justificado =
    registro.justificado === true ||
    registro.justificado === 1 ||
    registro.justificado === "1";

  if (!justificado) {
    return null;
  }

  const estadoNormalizado = normalizeEstado(registro.estado);

  const estadoFinal = estadoNormalizado === ESTADO_PRESENTE ? ESTADO_AUSENTE : estadoNormalizado;

  const justificacionTexto = resolveJustificacionTexto(registro);

  return {
    fecha,
    estado: estadoFinal,
    justificacion: justificacionTexto,
  };
};

const normalizarAsistenciaManualRegistro = (registro) => {
  if (!registro) return null;

  const fecha = typeof registro.fecha === "string" ? registro.fecha.trim() : "";
  if (!fecha) return null;

  const estadoNormalizado = normalizeEstado(registro.estado);
  if (!estadosAsistenciaManual.has(estadoNormalizado)) {
    return null;
  }

  const justificado =
    registro.justificado === true ||
    registro.justificado === 1 ||
    registro.justificado === "1";

  return {
    fecha,
    estado: estadoNormalizado,
    justificado,
    justificacion: resolveJustificacionTexto(registro),
  };
};

const calcularSalarioDiaDesdeDetalle = (detalle) => {
  const base = normalizeSalarioBase(detalle.salario_base);
  if (base > 0) {
    const multiplicador = (() => {
      const valor = Number(detalle.multiplicador_dia_doble);
      if (Number.isFinite(valor) && valor >= 1) {
        return valor;
      }
      return detalle.es_dia_doble ? 2 : 1;
    })();
    const factor = detalle.es_dia_doble ? multiplicador : 1;
    return formatMontoPositivo(base * factor);
  }

  const actual = normalizeSalarioBase(detalle.salario_dia);
  if (actual > 0) {
    return formatMontoPositivo(actual);
  }

  return SALARIO_CERO_TEXTO;
};

const aplicarJustificacionesAuto = (detalles, registros) => {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    return detalles;
  }

  const mapa = new Map();
  if (Array.isArray(registros)) {
    registros.forEach((item) => {
      if (item && item.fecha) {
        mapa.set(item.fecha, item);
      }
    });
  }

  return detalles.map((detalle) => {
    const info = mapa.get(detalle.fecha);

    if (info) {
      const debeAplicar = detalle.autoJustificacion || (!detalle.justificado && detalle.asistio);
      if (!debeAplicar) {
        return detalle;
      }

      const justificacionTexto = info.justificacion || "";
      const estadoFinal = info.estado || ESTADO_AUSENTE;

      if (
        detalle.asistio === false &&
        detalle.salario_dia === SALARIO_CERO_TEXTO &&
        detalle.estado === estadoFinal &&
        detalle.justificado === true &&
        (detalle.justificacion || "") === justificacionTexto &&
        detalle.autoJustificacion === true
      ) {
        return detalle;
      }

      return {
        ...detalle,
        asistio: false,
        salario_dia: SALARIO_CERO_TEXTO,
        estado: estadoFinal,
        justificado: true,
        justificacion: justificacionTexto,
        autoJustificacion: true,
      };
    }

    if (!detalle.autoJustificacion) {
      return detalle;
    }

    const salarioRestaurado = calcularSalarioDiaDesdeDetalle(detalle);
    const estadoRestaurado = ESTADO_PRESENTE;

    return {
      ...detalle,
      asistio: true,
      salario_dia: salarioRestaurado,
      estado: estadoRestaurado,
      justificado: false,
      justificacion: "",
      autoJustificacion: false,
    };
  });
};

const createEmptyForm = (defaults = {}) => ({
  id_empleado: "",
  periodo_inicio: "",
  periodo_fin: "",
  horas_extras: "0",
  bonificaciones: "0",
  deducciones: "0",
  fecha_pago: "",
  dias_trabajados: "",
  dias_descuento: "0",
  monto_descuento_dias: "",
  dias_dobles: "",
  monto_dias_dobles: "",
  es_automatica: "0",
  ...defaults,
});

const normalizeFlag = (value, fallback = "0") => {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value ? "1" : "0";
  }
  const numericValue = Number(value);
  if (Number.isNaN(numericValue)) {
    return fallback;
  }
  return numericValue === 1 ? "1" : "0";
};

const sanitizeObjectArray = (records) => {
  if (!Array.isArray(records)) {
    return [];
  }

  return records.filter((item) => item && typeof item === "object");
};

const formatInputDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const hasOverlappingPlanilla = (planillas, idEmpleado, inicio, fin) => {
  const inicioDate = parseDateSafe(inicio);
  const finDate = parseDateSafe(fin);

  if (!inicioDate || !finDate) {
    return false;
  }

  return planillas.some((planilla) => {
    if (Number(planilla.id_empleado) !== Number(idEmpleado)) {
      return false;
    }

    const planillaInicio = parseDateSafe(planilla.periodo_inicio);
    const planillaFin = parseDateSafe(planilla.periodo_fin);

    if (!planillaInicio || !planillaFin) {
      return false;
    }

    return !(finDate < planillaInicio || inicioDate > planillaFin);
  });
};

export const usePlanilla = () => {
  const [planillas, setPlanillas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [prestamos, setPrestamos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlanilla, setEditingPlanilla] = useState(null);
  const [formData, setFormData] = useState(() => createEmptyForm(calculateQuincenaDefaults()));
  const [prestamoSelections, setPrestamoSelections] = useState({});
  const [attendanceState, setAttendanceState] = useState({
    loading: false,
    dias: null,
    fechas: [],
    error: "",
    message: "",
  });
  const [attendanceReloadKey, setAttendanceReloadKey] = useState(0);
  const [detalleAsistencia, setDetalleAsistencia] = useState({
    key: "",
    loading: false,
    fechas: [],
    registros: [],
    error: "",
  });
  const [detalleNonDiarioReloadKey, setDetalleNonDiarioReloadKey] = useState(0);
  const [descansosEmpleado, setDescansosEmpleado] = useState([]);
  const [diasDoblesActivos, setDiasDoblesActivos] = useState([]);
  const [detalleDias, setDetalleDias] = useState([]);
  const [detalleJustificaciones, setDetalleJustificaciones] = useState(
    DETALLE_JUSTIFICACIONES_INICIAL,
  );
  const detalleContextRef = useRef({ empleadoId: null, inicio: "", fin: "" });
  const autoDiasRef = useRef(null);
  const attendanceCacheRef = useRef(new Map());
  const attendanceDebounceRef = useRef(null);

  const empleadoDetalleActivo = useMemo(() => {
    if (!formData.id_empleado) {
      return null;
    }

    return (
      empleados.find((empleado) => String(empleado.id_empleado) === String(formData.id_empleado)) ||
      null
    );
  }, [empleados, formData.id_empleado]);

  const descansoProgramadoActivo = Array.isArray(descansosEmpleado) && descansosEmpleado.length > 0;

  const salarioDetalleReferencia = useMemo(() => {
    if (!empleadoDetalleActivo) {
      return 0;
    }

    const salarioBaseEmpleado = Number(empleadoDetalleActivo.salario_monto);

    if (!Number.isFinite(salarioBaseEmpleado) || salarioBaseEmpleado <= 0) {
      return 0;
    }

    const tipoPagoEmpleado = (empleadoDetalleActivo.tipo_pago || "")
      .toString()
      .trim()
      .toLowerCase();

    if (tipoPagoEmpleado === "diario") {
      return Number(salarioBaseEmpleado.toFixed(2));
    }

    if (tipoPagoEmpleado === "mensual") {
      return Number((salarioBaseEmpleado / DIAS_POR_MES).toFixed(2));
    }

    const diasPeriodo =
      tipoPagoEmpleado === "quincenal"
        ? calcularDiasPeriodo(formData.periodo_inicio, formData.periodo_fin)
        : 0;
    const divisor = diasPeriodo > 0 ? diasPeriodo : DIAS_POR_QUINCENA;
    return Number((salarioBaseEmpleado / divisor).toFixed(2));
  }, [empleadoDetalleActivo, formData.periodo_inicio, formData.periodo_fin]);

  const diasDoblesMap = useMemo(() => {
    const mapa = new Map();
    diasDoblesActivos.forEach((diaDoble) => {
      const fechaKey = formatDateKey(diaDoble?.fecha);
      if (!fechaKey) return;
      const multiplicador = Number(diaDoble?.multiplicador);
      mapa.set(fechaKey, Number.isFinite(multiplicador) && multiplicador >= 1 ? multiplicador : 2);
    });
    return mapa;
  }, [diasDoblesActivos]);

  useEffect(() => {
    if (!modalOpen || !formData.id_empleado) {
      setDescansosEmpleado([]);
      return;
    }

    let cancelado = false;

    const fetchDescansos = async () => {
      try {
        const data = await empleadoDescansosService.getAll({
          id_empleado: Number(formData.id_empleado),
          estado: true,
        });
        if (!cancelado) {
          setDescansosEmpleado(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelado) {
          setDescansosEmpleado([]);
        }
      }
    };

    fetchDescansos();

    return () => {
      cancelado = true;
    };
  }, [modalOpen, formData.id_empleado]);

  const esPagoQuincenal = useMemo(() => {
    if (!empleadoDetalleActivo) {
      return false;
    }

    const tipoPago = (empleadoDetalleActivo.tipo_pago || "").toString().trim().toLowerCase();
    return tipoPago === "quincenal";
  }, [empleadoDetalleActivo]);

  const esPagoDiario = useMemo(() => {
    if (!empleadoDetalleActivo) {
      return false;
    }

    const tipoPago = (empleadoDetalleActivo.tipo_pago || "").toString().trim().toLowerCase();
    return tipoPago === "diario";
  }, [empleadoDetalleActivo]);

  const applySalarioBaseFallback = useCallback(
    (valor) => {
      const normalizado = normalizeSalarioBase(valor);

      if (normalizado > 0) {
        return normalizado;
      }

      if (salarioDetalleReferencia > 0) {
        return normalizeSalarioBase(salarioDetalleReferencia);
      }

      return normalizado;
    },
    [salarioDetalleReferencia],
  );

  const resolveAusenciaSalario = useCallback(
    (detalle) => {
      const baseReferencia = obtenerSalarioBaseDetalle(detalle);
      const baseNormalizado = applySalarioBaseFallback(baseReferencia);
      if (esPagoDiario) {
        if (detalle?.es_descanso) {
          return {
            salario: formatMontoPositivo(baseNormalizado),
            salarioBase: baseNormalizado,
          };
        }
        return {
          salario: SALARIO_CERO_TEXTO,
          salarioBase: baseNormalizado,
        };
      }
      if (esPagoQuincenal && !detalle?.es_descanso) {
        return {
          salario: SALARIO_CERO_TEXTO,
          salarioBase: baseNormalizado,
        };
      }
      return {
        salario: formatMontoPositivo(baseNormalizado),
        salarioBase: baseNormalizado,
      };
    },
    [applySalarioBaseFallback, esPagoDiario, esPagoQuincenal],
  );

  const aplicarPoliticaAusencias = useCallback(
    (detalles) => {
      if (!Array.isArray(detalles) || detalles.length === 0) {
        return detalles;
      }

      const permitirAusenciasPagadas = !descansoProgramadoActivo && !esPagoQuincenal;

      if (esPagoDiario) {
        const updates = new Map();

        detalles.forEach((detalle, index) => {
          if (detalle.asistio) {
            return;
          }

          if (detalle.es_descanso) {
            const baseReferencia = obtenerSalarioBaseDetalle(detalle);
            const baseNormalizado = applySalarioBaseFallback(baseReferencia);
            const salarioTexto = formatMontoPositivo(baseNormalizado);

            if (detalle.salario_dia !== salarioTexto || detalle.salario_base !== baseNormalizado) {
              updates.set(index, {
                salario_dia: salarioTexto,
                salario_base: baseNormalizado,
              });
            }
            return;
          }

          const baseReferencia = obtenerSalarioBaseDetalle(detalle);
          const baseNormalizado = applySalarioBaseFallback(baseReferencia);
          const salarioTexto = SALARIO_CERO_TEXTO;

          if (detalle.salario_dia !== salarioTexto || detalle.salario_base !== baseNormalizado) {
            updates.set(index, {
              salario_dia: salarioTexto,
              salario_base: baseNormalizado,
            });
          }
        });

        if (updates.size === 0) {
          return detalles;
        }

        return detalles.map((detalle, index) => {
          const update = updates.get(index);
          return update ? { ...detalle, ...update } : detalle;
        });
      }

      const ordenados = detalles
        .map((detalle, index) => ({ detalle, index }))
        .sort((a, b) => a.detalle.fecha.localeCompare(b.detalle.fecha));

      let ausenciasPagadas = 0;
      let ausenciasSinJustificar = 0;
      const updates = new Map();

      ordenados.forEach(({ detalle, index }) => {
        if (detalle.asistio) {
          return;
        }

        if (detalle.es_descanso) {
          const baseReferencia = obtenerSalarioBaseDetalle(detalle);
          const baseNormalizado = applySalarioBaseFallback(baseReferencia);
          const salarioTexto = formatMontoPositivo(baseNormalizado);

          if (detalle.salario_dia !== salarioTexto || detalle.salario_base !== baseNormalizado) {
            updates.set(index, {
              salario_dia: salarioTexto,
              salario_base: baseNormalizado,
            });
          }
          return;
        }

        const estado = normalizeEstado(detalle.estado);
        const baseReferencia = obtenerSalarioBaseDetalle(detalle);
        const baseNormalizado = applySalarioBaseFallback(baseReferencia);
        let salarioCalculado = baseNormalizado;

        const esVacaciones = estado === ESTADO_VACACIONES;
        const esIncapacidad = estado === ESTADO_INCAPACIDAD;
        const esPermiso = estado === ESTADO_PERMISO;
        const esAusenteSinJustificar = estado === ESTADO_AUSENTE && !detalle.justificado;

        if (esAusenteSinJustificar) {
          ausenciasSinJustificar += 1;
        }

        if (esPermiso) {
          salarioCalculado = 0;
        } else if (esVacaciones) {
          salarioCalculado = baseNormalizado;
        } else if (esIncapacidad) {
          salarioCalculado = baseNormalizado / 2;
        } else if (detalle.es_dia_doble) {
          salarioCalculado = baseNormalizado;
        } else if (permitirAusenciasPagadas && ausenciasPagadas < MAX_AUSENCIAS_PAGADAS) {
          salarioCalculado = baseNormalizado;
          ausenciasPagadas += 1;
        } else if (esAusenteSinJustificar && ausenciasSinJustificar >= MAX_AUSENCIAS_SIN_JUSTIFICAR) {
          salarioCalculado = 0;
        } else {
          salarioCalculado = 0;
        }

        const salarioTexto = formatMontoPositivo(salarioCalculado);

        if (detalle.salario_dia !== salarioTexto || detalle.salario_base !== baseNormalizado) {
          updates.set(index, {
            salario_dia: salarioTexto,
            salario_base: baseNormalizado,
          });
        }
      });

      if (updates.size === 0) {
        return detalles;
      }

      return detalles.map((detalle, index) => {
        const update = updates.get(index);
        return update ? { ...detalle, ...update } : detalle;
      });
    },
    [applySalarioBaseFallback, descansoProgramadoActivo, esPagoDiario, esPagoQuincenal],
  );

  const aplicarAsistenciaDetalle = useCallback((detalles, fechasAsistidas) => {
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return detalles;
    }

    if (!Array.isArray(fechasAsistidas)) {
      return detalles;
    }

    const fechasNormalizadas = fechasAsistidas
      .map((fecha) => (typeof fecha === "string" ? fecha.trim() : ""))
      .filter((fecha) => fecha.length > 0);

    const asistenciaSet = new Set(fechasNormalizadas);
    const salarioCero = Number(0).toFixed(2);

    if (asistenciaSet.size === 0) {
      return detalles.map((detalle) => {
        if (detalle.asistenciaManual || detalle.es_descanso) {
          return detalle;
        }

        const ausenciaSalario = resolveAusenciaSalario(detalle);

        if (!detalle.asistio && toPositiveNumber(detalle.salario_dia) === 0) {
          return detalle.salario_dia === salarioCero
            ? detalle
            : {
                ...detalle,
                salario_dia: ausenciaSalario.salario,
                ...(ausenciaSalario.salarioBase !== null && {
                  salario_base: ausenciaSalario.salarioBase,
                }),
                estado: ajustarEstadoPorAsistencia(detalle.estado, false),
                asistenciaManual: false,
              };
        }

        return {
          ...detalle,
          asistio: false,
          salario_dia: ausenciaSalario.salario,
          ...(ausenciaSalario.salarioBase !== null && {
            salario_base: ausenciaSalario.salarioBase,
          }),
          estado: ajustarEstadoPorAsistencia(detalle.estado, false),
          asistenciaManual: false,
        };
      });
    }

    return detalles.map((detalle) => {
      if (detalle.asistenciaManual) {
        return detalle;
      }

      const asistio = asistenciaSet.has(detalle.fecha);
      if (detalle.es_descanso && !asistio) {
        return detalle;
      }

      if (!asistio) {
        const ausenciaSalario = resolveAusenciaSalario(detalle);

        if (!detalle.asistio && toPositiveNumber(detalle.salario_dia) === 0) {
          return detalle.salario_dia === salarioCero
            ? detalle
            : {
                ...detalle,
                salario_dia: ausenciaSalario.salario,
                ...(ausenciaSalario.salarioBase !== null && {
                  salario_base: ausenciaSalario.salarioBase,
                }),
                estado: ajustarEstadoPorAsistencia(detalle.estado, false),
                asistenciaManual: false,
              };
        }

        return {
          ...detalle,
          asistio: false,
          salario_dia: ausenciaSalario.salario,
          ...(ausenciaSalario.salarioBase !== null && {
            salario_base: ausenciaSalario.salarioBase,
          }),
          estado: ajustarEstadoPorAsistencia(detalle.estado, false),
          asistenciaManual: false,
        };
      }

      const salarioBase = parseNumberInput(detalle.salario_base);
      const multiplicadorManual = Number(detalle.multiplicador_dia_doble);
      const factorBase =
        Number.isFinite(multiplicadorManual) && multiplicadorManual >= 1
          ? multiplicadorManual
          : 2;
      const debeAplicarDoblePorDescanso = detalle.es_descanso && asistio;
      const esDiaDoble = detalle.es_dia_doble || debeAplicarDoblePorDescanso;
      const factor = esDiaDoble ? factorBase : 1;
      const salarioCalculado = (() => {
        if (Number.isFinite(salarioBase) && salarioBase >= 0) {
          return salarioBase * factor;
        }
        const actual = parseNumberInput(detalle.salario_dia);
        return Number.isFinite(actual) && actual >= 0 ? actual : 0;
      })();

      const salarioTexto = Number(salarioCalculado).toFixed(2);

      if (
        detalle.asistio &&
        detalle.salario_dia === salarioTexto &&
        detalle.es_dia_doble === esDiaDoble
      ) {
        return detalle;
      }

      return {
        ...detalle,
        asistio: esDescanso ? false : true,
        es_dia_doble: esDiaDoble,
        multiplicador_dia_doble: esDiaDoble ? factor : detalle.multiplicador_dia_doble,
        salario_dia: salarioTexto,
        estado: ajustarEstadoPorAsistencia(detalle.estado, true),
        asistenciaManual: false,
      };
    });
  }, [resolveAusenciaSalario]);

  const aplicarAsistenciaManual = useCallback((detalles, registrosAsistencia) => {
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return detalles;
    }

    if (!Array.isArray(registrosAsistencia) || registrosAsistencia.length === 0) {
      return detalles;
    }

    const mapa = new Map();

    registrosAsistencia.forEach((registro) => {
      if (!registro) return;
      const anterior = mapa.get(registro.fecha);
      if (!anterior) {
        mapa.set(registro.fecha, registro);
        return;
      }

      const prioridadActual = prioridadEstadoAsistenciaManual[registro.estado] || 0;
      const prioridadAnterior = prioridadEstadoAsistenciaManual[anterior.estado] || 0;
      if (prioridadActual > prioridadAnterior) {
        mapa.set(registro.fecha, registro);
      }
    });

    return detalles.map((detalle) => {
      if (detalle.asistenciaManual || detalle.es_descanso) {
        return detalle;
      }

      const registro = mapa.get(detalle.fecha);
      if (!registro) {
        return detalle;
      }

      return {
        ...detalle,
        asistio: false,
        estado: registro.estado,
        justificado: registro.justificado,
        justificacion: registro.justificacion || "",
        autoJustificacion: false,
      };
    });
  }, []);


  const fetchPlanillas = useCallback(async () => {
    try {
      setLoading(true);
      const data = await planillaService.getAll();
      setPlanillas(ensurePlanillaArrayCanonical(data));
      setError("");
    } catch (err) {
      console.error(err);
      setError("Error al cargar planillas");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmpleados = useCallback(async () => {
    try {
      const data = await empleadoService.getAll();
      setEmpleados(sanitizeObjectArray(data));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchPrestamos = useCallback(async () => {
    try {
      const data = await prestamosService.getAll();
      setPrestamos(sanitizeObjectArray(data));
    } catch (err) {
      console.error(err);
    }
  }, []);

  const fetchDiasDobles = useCallback(async () => {
    try {
      const data = await diasDoblesService.getAll({ activo: true });
      setDiasDoblesActivos(sanitizeObjectArray(data));
    } catch (err) {
      console.error(err);
      setDiasDoblesActivos([]);
    }
  }, []);

  useEffect(() => {
    fetchPlanillas();
    fetchEmpleados();
    fetchPrestamos();
    fetchDiasDobles();
  }, [fetchPlanillas, fetchEmpleados, fetchPrestamos, fetchDiasDobles]);

  const selectedEmpleado = useMemo(
    () =>
      empleados.find(
        (empleado) => String(empleado.id_empleado) === String(formData.id_empleado)
      ),
    [empleados, formData.id_empleado]
  );

  const employeeAllowsAutoAttendance = useMemo(() => {
    if (!selectedEmpleado) return true;
    const value =
      selectedEmpleado.es_automatica !== undefined && selectedEmpleado.es_automatica !== null
        ? selectedEmpleado.es_automatica
        : selectedEmpleado.planilla_automatica;
    if (value === undefined || value === null) return true;
    return normalizeFlag(value, "1") === "1";
  }, [selectedEmpleado]);

  const handleChange = useCallback((event) => {
    const { name, value } = event.target;
    let nextValue = value;

    if (name === "id_empleado") {
      const empleadoSeleccionado = empleados.find(
        (empleado) => String(empleado.id_empleado) === String(value)
      );
      const bonificacionDefault = empleadoSeleccionado?.bonificacion_fija;
      const esAutomaticaDefault =
        empleadoSeleccionado?.es_automatica !== undefined &&
        empleadoSeleccionado?.es_automatica !== null
          ? normalizeFlag(empleadoSeleccionado.es_automatica, "0")
          : empleadoSeleccionado?.planilla_automatica !== undefined &&
            empleadoSeleccionado?.planilla_automatica !== null
          ? normalizeFlag(empleadoSeleccionado.planilla_automatica, "0")
          : "0";
      const bonificacionNormalizada =
        bonificacionDefault === undefined || bonificacionDefault === null
          ? "0"
          : normalizeNumber(bonificacionDefault);
      autoDiasRef.current = null;
      setAttendanceState({ loading: false, dias: null, fechas: [], error: "", message: "" });
      setFormData((prev) => ({
        ...prev,
        id_empleado: value,
        bonificaciones: bonificacionNormalizada,
        es_automatica: esAutomaticaDefault,
        dias_trabajados: "",
        dias_descuento: "0",
        monto_descuento_dias: "",
        dias_dobles: "",
        monto_dias_dobles: "",
      }));
      return;
    }

    if (name === "periodo_inicio" || name === "periodo_fin") {
      autoDiasRef.current = null;
      setAttendanceState((prev) => ({ ...prev, dias: null, fechas: [], error: "", message: "" }));
    }

    if (name === "es_automatica") {
      autoDiasRef.current = null;
      setAttendanceState({ loading: false, dias: null, fechas: [], error: "", message: "" });
      if (!employeeAllowsAutoAttendance) {
        nextValue = "0";
      }
      if (nextValue === "1") {
        setDetalleDias((prev) =>
          prev.map((detalle) => ({ ...detalle, asistenciaManual: false }))
        );
      }
    }

    setFormData((prev) => ({ ...prev, [name]: nextValue }));
  }, [empleados, employeeAllowsAutoAttendance]);

  const resetForm = () => {
    setFormData(createEmptyForm(calculateQuincenaDefaults()));
    setEditingPlanilla(null);
    setError("");
    setPrestamoSelections({});
    setAttendanceState({ loading: false, dias: null, fechas: [], error: "", message: "" });
    setAttendanceReloadKey(0);
    autoDiasRef.current = null;
    setDetalleDias([]);
    detalleContextRef.current = { empleadoId: null, inicio: "", fin: "" };
    setDetalleJustificaciones(DETALLE_JUSTIFICACIONES_INICIAL);
    setDetalleAsistencia({ key: "", loading: false, fechas: [], registros: [], error: "" });
    setDetalleNonDiarioReloadKey(0);
  };

  const openCreateModal = () => {
    resetForm();
    setModalOpen(true);
  };

  const selectEmpleado = useCallback(
    (idEmpleado) => {
      const value = idEmpleado ? String(idEmpleado) : "";
      handleChange({ target: { name: "id_empleado", value } });
    },
    [handleChange]
  );

  const handleEdit = async (planilla) => {
    const canonicalPlanilla = ensurePlanillaCanonical(planilla);
    setEditingPlanilla(canonicalPlanilla);
    const idEmpleado = canonicalPlanilla?.id_empleado
      ? String(canonicalPlanilla.id_empleado)
      : "";
    const periodoInicio = normalizeDate(canonicalPlanilla?.periodo_inicio);
    const periodoFin = normalizeDate(canonicalPlanilla?.periodo_fin);

    setFormData({
      id_empleado: idEmpleado,
      periodo_inicio: periodoInicio,
      periodo_fin: periodoFin,
      horas_extras: normalizeNumber(canonicalPlanilla?.horas_extras),
      bonificaciones: normalizeNumber(canonicalPlanilla?.bonificaciones),
      deducciones: normalizeNumber(canonicalPlanilla?.deducciones),
      fecha_pago: normalizeDate(canonicalPlanilla?.fecha_pago),
      dias_trabajados: "",
      dias_descuento: "0",
      monto_descuento_dias: "",
      dias_dobles: "",
      monto_dias_dobles: "",
      es_automatica:
        canonicalPlanilla?.es_automatica !== undefined &&
        canonicalPlanilla?.es_automatica !== null
          ? normalizeFlag(canonicalPlanilla.es_automatica, "0")
          : "0",
    });
    setError("");
    setPrestamoSelections({});
    setDetalleJustificaciones(DETALLE_JUSTIFICACIONES_INICIAL);
    autoDiasRef.current = null;
    setAttendanceState({
      loading: false,
      dias: null,
      fechas: [],
      error: "",
      message: "Cargando detalle guardado...",
    });
    setDetalleDias([]);
    detalleContextRef.current = {
      empleadoId: idEmpleado,
      inicio: periodoInicio,
      fin: periodoFin,
    };
    setModalOpen(true);

    const planillaIdValue = resolvePlanillaId(canonicalPlanilla);
    if (!planillaIdValue) {
      setAttendanceState({
        loading: false,
        dias: null,
        fechas: [],
        error: "",
        message: "No se pudo identificar la planilla seleccionada.",
      });
      return;
    }

    try {
      const data = await planillaService.getDetalle(planillaIdValue);
      const detalles = Array.isArray(data)
        ? data.map((item) => normalizeDetallePlanillaRegistro(item)).filter(Boolean)
        : [];

      if (detalles.length > 0) {
        setDetalleDias(detalles);
        detalleContextRef.current = {
          empleadoId: idEmpleado,
          inicio: periodoInicio,
          fin: periodoFin,
        };
        setAttendanceState({
          loading: false,
          dias: detalles.length,
          fechas: detalles.map((detalle) => detalle.fecha),
          error: "",
          message: "",
        });
      } else {
        setAttendanceState({
          loading: false,
          dias: null,
          fechas: [],
          error: "",
          message: "Esta planilla no tiene detalle registrado.",
        });
      }
    } catch (err) {
      console.error(err);
      const message =
        err?.response?.data?.error ||
        err?.message ||
        "No se pudo cargar el detalle guardado de la planilla.";
      setAttendanceState({
        loading: false,
        dias: null,
        fechas: [],
        error: message,
        message: "",
      });
    }
  };

  const prestamosEmpleado = useMemo(() => {
    if (!formData.id_empleado) return [];
    return prestamos.filter((prestamo) => {
      const saldo = Number(prestamo.saldo);
      return (
        String(prestamo.id_empleado) === formData.id_empleado &&
        Number.isFinite(saldo) &&
        saldo > 0 &&
        Number(prestamo.id_estado) === 2
      );
    });
  }, [prestamos, formData.id_empleado]);

  useEffect(() => {
    if (!modalOpen) return;

    if (!formData.id_empleado) {
      setPrestamoSelections({});
      return;
    }

    setPrestamoSelections((prev) => {
      const updated = {};

      prestamosEmpleado.forEach((prestamo) => {
        const saldo = Math.max(Number(prestamo.saldo) || 0, 0);
        const cuotaSugerida = calcularCuotaSugerida(prestamo);
        const anterior = prev[prestamo.id_prestamo] || {};

        updated[prestamo.id_prestamo] = {
          aplicar: anterior.aplicar !== undefined ? anterior.aplicar : true,
          monto: clampMonto(anterior.monto ?? cuotaSugerida, saldo),
        };
      });

      return updated;
    });
  }, [modalOpen, prestamosEmpleado, formData.id_empleado, editingPlanilla]);

  useEffect(() => {
    if (!modalOpen || editingPlanilla) {
      setDetalleJustificaciones(DETALLE_JUSTIFICACIONES_INICIAL);
      setDetalleAsistencia({ key: "", loading: false, fechas: [], registros: [], error: "" });
      return;
    }

    const { id_empleado, periodo_inicio, periodo_fin } = formData;

    if (!id_empleado || !periodo_inicio || !periodo_fin) {
      setDetalleJustificaciones(DETALLE_JUSTIFICACIONES_INICIAL);
      setDetalleAsistencia({ key: "", loading: false, fechas: [], registros: [], error: "" });
      return;
    }

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === String(id_empleado),
    );

    if (
      !empleadoSeleccionado ||
      !["Quincenal", "Mensual"].includes(empleadoSeleccionado.tipo_pago)
    ) {
      setDetalleJustificaciones(DETALLE_JUSTIFICACIONES_INICIAL);
      setDetalleAsistencia({ key: "", loading: false, fechas: [], registros: [], error: "" });
      return;
    }

    let cancelado = false;
    const key = `${id_empleado}-${periodo_inicio}-${periodo_fin}`;

    const fetchJustificaciones = async () => {
      setDetalleJustificaciones({ key, loading: true, registros: [], error: "" });
      setDetalleAsistencia({ key, loading: true, fechas: [], registros: [], error: "" });

      try {
        const data = await asistenciaService.getByRange(
          periodo_inicio,
          periodo_fin,
          id_empleado,
        );
        if (cancelado) return;

        const registros = Array.isArray(data)
          ? data.map(normalizarJustificacionRegistro).filter(Boolean)
          : [];
        const registrosManual = Array.isArray(data)
          ? data.map(normalizarAsistenciaManualRegistro).filter(Boolean)
          : [];
        const fechasAsistencia = Array.isArray(data)
          ? Array.from(
              new Set(
                data
                  .map((registro) =>
                    typeof registro.fecha === "string" ? registro.fecha.trim() : "",
                  )
                  .filter((fecha) => fecha.length > 0),
              ),
            )
          : [];

        setDetalleJustificaciones({ key, loading: false, registros, error: "" });
        setDetalleAsistencia({
          key,
          loading: false,
          fechas: fechasAsistencia,
          registros: registrosManual,
          error: "",
        });

        if (detalleNonDiarioReloadKey > 0) {
          setAttendanceState({
            loading: false,
            dias: null,
            fechas: [],
            error: "",
            message: "Asistencia actualizada para el periodo.",
          });
        }
      } catch (err) {
        if (cancelado) return;

        const message =
          err?.response?.data?.error ||
          err?.message ||
          "No se pudieron obtener las justificaciones del periodo seleccionado.";
        setDetalleJustificaciones({ key, loading: false, registros: [], error: message });
        setDetalleAsistencia({ key, loading: false, fechas: [], registros: [], error: message });
        if (detalleNonDiarioReloadKey > 0) {
          setAttendanceState({
            loading: false,
            dias: null,
            fechas: [],
            error: message,
            message: "",
          });
        }
      }
    };

    fetchJustificaciones();

    return () => {
      cancelado = true;
    };
  }, [
    modalOpen,
    formData,
    formData.id_empleado,
    formData.periodo_inicio,
    formData.periodo_fin,
    empleados,
    detalleNonDiarioReloadKey,
  ]);

  const buildDetalleDias = useCallback((empleado, inicio, fin) => {
    if (!empleado || !inicio || !fin) return [];

    const fechaInicio = parseDateSafe(inicio);
    const fechaFin = parseDateSafe(fin);

    if (Number.isNaN(fechaInicio.getTime()) || Number.isNaN(fechaFin.getTime()) || fechaFin < fechaInicio) {
      return [];
    }

    const salarioBase = Number(empleado.salario_monto) || 0;
    const tipoPago = empleado.tipo_pago || "Quincenal";
    const tipoPagoNormalizado = tipoPago.toString().trim().toLowerCase();
    const diasPeriodo = calcularDiasPeriodo(inicio, fin);
    const diasReferencia =
      tipoPagoNormalizado === "diario"
        ? 0
        : tipoPagoNormalizado === "mensual"
          ? DIAS_POR_MES
          : tipoPagoNormalizado === "quincenal" && diasPeriodo > 0
            ? diasPeriodo
            : DIAS_POR_QUINCENA;
    const salarioDiarioReferencia =
      tipoPagoNormalizado === "diario"
        ? salarioBase
        : salarioBase > 0 && diasReferencia > 0
          ? Number((salarioBase / diasReferencia).toFixed(2))
          : 0;

    const formatter = new Intl.DateTimeFormat("es-CR", { weekday: "long" });
    const detalles = [];

    for (
      let cursor = new Date(fechaInicio.getTime());
      cursor <= fechaFin;
      cursor.setDate(cursor.getDate() + 1)
    ) {
      const current = new Date(cursor.getTime());
      const iso = formatInputDate(current);
      const diaRaw = formatter.format(current);
      const diaSemana = diaRaw.charAt(0).toUpperCase() + diaRaw.slice(1);

      const multiplicadorDoble = diasDoblesMap.get(iso);
      const esDiaDobleConfigurado = Number.isFinite(multiplicadorDoble) && multiplicadorDoble >= 1;
      const factor = esDiaDobleConfigurado ? multiplicadorDoble : 1;
      const salarioDia = Number((salarioDiarioReferencia * factor).toFixed(2));

      const esDescanso = resolveEsDescansoPorReglas(iso, descansosEmpleado);

      detalles.push({
        fecha: iso,
        dia_semana: diaSemana,
        salario_base: salarioDiarioReferencia,
        salario_dia: salarioDia.toFixed(2),
        asistio: esDescanso ? false : true,
        es_dia_doble: esDiaDobleConfigurado,
        multiplicador_dia_doble: esDiaDobleConfigurado ? multiplicadorDoble : null,
        es_descanso: esDescanso,
        estado: esDescanso ? ESTADO_DESCANSO : ESTADO_PRESENTE,
        justificado: esDescanso ? true : false,
        justificacion: esDescanso ? "Descanso programado" : "",
        observacion: esDescanso ? "Descanso programado" : "",
        autoJustificacion: false,
        asistenciaManual: false,
        dia_doble_manual: false,
      });
    }

    return detalles;
  }, [descansosEmpleado, diasDoblesMap]);

  useEffect(() => {
    setDetalleDias((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;

      let changed = false;
      const updated = prev.map((detalle) => {
        if (detalle?.dia_doble_manual) {
          return detalle;
        }

        const fechaKey = formatDateKey(detalle?.fecha);
        const multiplicador = diasDoblesMap.get(fechaKey);
        const esDiaDobleConfigurado = Number.isFinite(multiplicador) && multiplicador >= 1;
        const salarioBase = parseNumberInput(detalle.salario_base);
        const factor = esDiaDobleConfigurado ? multiplicador : 1;
        const salarioCalculado = Number.isFinite(salarioBase) && salarioBase >= 0
          ? Number((salarioBase * (detalle.asistio ? factor : 0)).toFixed(2))
          : parseNumberInput(detalle.salario_dia);
        const salarioTexto = Number.isFinite(salarioCalculado) ? salarioCalculado.toFixed(2) : detalle.salario_dia;

        const nextEsDiaDoble = esDiaDobleConfigurado;
        const nextMultiplicador = esDiaDobleConfigurado ? multiplicador : null;

        if (
          detalle.es_dia_doble === nextEsDiaDoble &&
          detalle.multiplicador_dia_doble === nextMultiplicador &&
          detalle.salario_dia === salarioTexto
        ) {
          return detalle;
        }

        changed = true;
        return {
          ...detalle,
          es_dia_doble: nextEsDiaDoble,
          multiplicador_dia_doble: nextMultiplicador,
          salario_dia: salarioTexto,
        };
      });

      return changed ? updated : prev;
    });
  }, [diasDoblesMap]);

  const syncDetalleWithAttendance = useCallback((fechasAsistidas) => {
    setDetalleDias((prev) => {
      if (!prev || prev.length === 0) {
        return prev;
      }

      const contextoActual = detalleContextRef.current;
      const keyActual = `${contextoActual.empleadoId}-${contextoActual.inicio}-${contextoActual.fin}`;
      const registrosAsistencia =
        detalleAsistencia.key === keyActual ? detalleAsistencia.registros : [];

      let updated = aplicarAsistenciaDetalle(prev, fechasAsistidas);
      updated = aplicarAsistenciaManual(updated, registrosAsistencia);
      updated = aplicarPoliticaAusencias(updated);
      const hasChanges = updated.some((detalle, index) => detalle !== prev[index]);
      return hasChanges ? updated : prev;
    });
  }, [
    aplicarAsistenciaDetalle,
    aplicarAsistenciaManual,
    aplicarPoliticaAusencias,
    detalleAsistencia.key,
    detalleAsistencia.registros,
  ]);

  useEffect(() => {
    if (!modalOpen) return;

    const { id_empleado, periodo_inicio, periodo_fin } = formData;

    if (!id_empleado || !periodo_inicio || !periodo_fin) {
      if (detalleDias.length > 0) {
        setDetalleDias([]);
      }
      detalleContextRef.current = { empleadoId: null, inicio: "", fin: "" };
      return;
    }

    const contextoActual = detalleContextRef.current;
    const baseKey = `${id_empleado}-${periodo_inicio}-${periodo_fin}`;
    const keyActual = `${contextoActual.empleadoId}-${contextoActual.inicio}-${contextoActual.fin}`;
    const keyNuevo = baseKey;

    if (detalleDias.length > 0 && keyActual === keyNuevo) {
      return;
    }

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === String(id_empleado)
    );

    if (!empleadoSeleccionado) {
      if (detalleDias.length > 0) {
        setDetalleDias([]);
      }
      detalleContextRef.current = {
        empleadoId: id_empleado,
        inicio: periodo_inicio,
        fin: periodo_fin,
      };
      return;
    }

    const nuevosDetallesBase = buildDetalleDias(
      empleadoSeleccionado,
      periodo_inicio,
      periodo_fin,
    );
    const fechasAsistencia =
      detalleAsistencia.key === baseKey ? detalleAsistencia.fechas : [];
    const registrosAsistencia =
      detalleAsistencia.key === baseKey ? detalleAsistencia.registros : [];
    const aplicarAsistencia = formData.es_automatica === "1";

    let nuevosDetalles = nuevosDetallesBase;
    if (aplicarAsistencia) {
      nuevosDetalles = aplicarAsistenciaDetalle(nuevosDetalles, fechasAsistencia);
      nuevosDetalles = aplicarAsistenciaManual(nuevosDetalles, registrosAsistencia);
    } else {
      nuevosDetalles = aplicarAsistenciaManual(nuevosDetalles, registrosAsistencia);
    }

    if (detalleJustificaciones.key === baseKey) {
      nuevosDetalles = aplicarJustificacionesAuto(nuevosDetalles, detalleJustificaciones.registros);
    }

    nuevosDetalles = aplicarPoliticaAusencias(nuevosDetalles);
    setDetalleDias(nuevosDetalles);
    detalleContextRef.current = {
      empleadoId: id_empleado,
      inicio: periodo_inicio,
      fin: periodo_fin,
    };
  }, [
    modalOpen,
    editingPlanilla,
    formData,
    formData.id_empleado,
    formData.periodo_inicio,
    formData.periodo_fin,
    empleados,
    detalleDias,
    buildDetalleDias,
    aplicarAsistenciaDetalle,
    aplicarAsistenciaManual,
    detalleAsistencia.key,
    detalleAsistencia.fechas,
    detalleAsistencia.registros,
    formData.es_automatica,
    detalleJustificaciones.key,
    detalleJustificaciones.registros,
    aplicarPoliticaAusencias,
  ]);

  useEffect(() => {
    if (!modalOpen) return;

    const contextoActual = detalleContextRef.current;
    const keyActual = `${contextoActual.empleadoId}-${contextoActual.inicio}-${contextoActual.fin}`;
    const keyJustificaciones = detalleJustificaciones.key;
    const registrosJustificados = Array.isArray(detalleJustificaciones.registros)
      ? detalleJustificaciones.registros
      : [];
    const fechasAsistencia =
      detalleAsistencia.key === keyActual ? detalleAsistencia.fechas : null;
    const registrosAsistencia =
      detalleAsistencia.key === keyActual ? detalleAsistencia.registros : null;
    const aplicarAsistencia = formData.es_automatica === "1";

    if (!keyJustificaciones || keyActual !== keyJustificaciones) {
      if (!keyJustificaciones && detalleDias.length > 0) {
        setDetalleDias((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) {
            return prev;
          }

          let restaurados = aplicarJustificacionesAuto(prev, []);
          if (fechasAsistencia && aplicarAsistencia) {
            restaurados = aplicarAsistenciaDetalle(restaurados, fechasAsistencia);
            restaurados = aplicarAsistenciaManual(restaurados, registrosAsistencia || []);
          }
          if (registrosAsistencia && !aplicarAsistencia) {
            restaurados = aplicarAsistenciaManual(restaurados, registrosAsistencia);
          }
          restaurados = aplicarPoliticaAusencias(restaurados);
          const cambio = restaurados.some((detalle, index) => detalle !== prev[index]);
          return cambio ? restaurados : prev;
        });
      }
      return;
    }

    if (!Array.isArray(detalleDias) || detalleDias.length === 0) {
      return;
    }

    setDetalleDias((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) {
        return prev;
      }

      let aplicados = prev;
      if (fechasAsistencia && aplicarAsistencia) {
        aplicados = aplicarAsistenciaDetalle(aplicados, fechasAsistencia);
        aplicados = aplicarAsistenciaManual(aplicados, registrosAsistencia || []);
      }
      if (registrosAsistencia && !aplicarAsistencia) {
        aplicados = aplicarAsistenciaManual(aplicados, registrosAsistencia);
      }
      aplicados = aplicarJustificacionesAuto(aplicados, registrosJustificados);
      aplicados = aplicarPoliticaAusencias(aplicados);

      const cambio = aplicados.some((detalle, index) => detalle !== prev[index]);
      return cambio ? aplicados : prev;
    });
  }, [
    modalOpen,
    detalleJustificaciones.key,
    detalleJustificaciones.registros,
    detalleDias,
    detalleAsistencia.key,
    detalleAsistencia.fechas,
    detalleAsistencia.registros,
    aplicarAsistenciaDetalle,
    aplicarAsistenciaManual,
    aplicarPoliticaAusencias,
    formData.es_automatica,
  ]);

  const updateDetalleDia = useCallback((index, updates) => {
    setDetalleDias((prev) =>
      aplicarPoliticaAusencias(
        prev.map((detalle, idx) => {
          if (idx !== index) return detalle;

          const siguiente = { ...detalle, ...updates };

          const manualOverrideKeys = [
            "asistio",
            "estado",
            "justificado",
            "justificacion",
            "salario_dia",
            "observacion",
          ];

          const shouldMarkManual = manualOverrideKeys.some((key) =>
            Object.prototype.hasOwnProperty.call(updates, key)
          );

          if (shouldMarkManual) {
            siguiente.asistenciaManual = true;
          }

          if (Object.prototype.hasOwnProperty.call(updates, "salario_dia")) {
            const valor = updates.salario_dia;

            if (isEmptyValue(valor)) {
              siguiente.salario_dia = "";
              siguiente.salario_base = 0;
            } else {
              const texto = typeof valor === "string" ? valor : String(valor);
              siguiente.salario_dia = texto;
              const numero = parseNumberInput(valor);

              if (!Number.isNaN(numero)) {
                const positivo = Math.max(numero, 0);
                const multiplicadorManual = Number(detalle.multiplicador_dia_doble);
                const factorManual =
                  Number.isFinite(multiplicadorManual) && multiplicadorManual >= 1
                    ? multiplicadorManual
                    : 2;
                const factorBase = detalle.asistio ? (detalle.es_dia_doble ? factorManual : 1) : 1;
                const base = factorBase > 0 ? positivo / factorBase : positivo;
                siguiente.salario_base = applySalarioBaseFallback(base);
              }
            }
          }

          if (Object.prototype.hasOwnProperty.call(updates, "justificacion")) {
            const valor = updates.justificacion;
            if (valor === null || valor === undefined) {
              siguiente.justificacion = "";
            } else {
              siguiente.justificacion = String(valor);
            }
          }

          if (Object.prototype.hasOwnProperty.call(updates, "justificado")) {
            const nuevoJustificado = Boolean(updates.justificado);
            siguiente.justificado = nuevoJustificado;
            if (!nuevoJustificado) {
              siguiente.justificacion = "";
              if (!siguiente.asistio) {
                const ausenciaSalario = resolveAusenciaSalario(siguiente);
                siguiente.salario_dia = ausenciaSalario.salario;
                if (ausenciaSalario.salarioBase !== null) {
                  siguiente.salario_base = ausenciaSalario.salarioBase;
                }
              }
            } else {
              const baseReferencia = obtenerSalarioBaseDetalle(siguiente);
              const baseNormalizado = applySalarioBaseFallback(baseReferencia);
              if (baseNormalizado > 0) {
                const multiplicadorManual = Number(siguiente.multiplicador_dia_doble);
                const factorManual =
                  Number.isFinite(multiplicadorManual) && multiplicadorManual >= 1
                    ? multiplicadorManual
                    : 2;
                const factor = siguiente.asistio ? (siguiente.es_dia_doble ? factorManual : 1) : 1;
                siguiente.salario_base = baseNormalizado;
                siguiente.salario_dia = formatMontoPositivo(baseNormalizado * factor);
              } else if (!siguiente.asistio) {
                siguiente.salario_dia = SALARIO_CERO_TEXTO;
              }
            }
          }

          if (Object.prototype.hasOwnProperty.call(updates, "estado")) {
            const nuevoEstado = normalizeEstado(updates.estado);
            siguiente.estado = nuevoEstado;

            if (nuevoEstado === ESTADO_PRESENTE) {
              const baseReferencia = obtenerSalarioBaseDetalle(siguiente);
              const baseNormalizado = applySalarioBaseFallback(baseReferencia);
              const multiplicadorManual = Number(siguiente.multiplicador_dia_doble);
              const factor =
                siguiente.es_dia_doble && Number.isFinite(multiplicadorManual) && multiplicadorManual >= 1
                  ? multiplicadorManual
                  : siguiente.es_dia_doble
                    ? 2
                    : 1;
              siguiente.asistio = true;
              siguiente.salario_base = baseNormalizado;
              siguiente.salario_dia = formatMontoPositivo(baseNormalizado * factor);
            } else if (nuevoEstado === ESTADO_AUSENTE) {
              siguiente.asistio = false;
              if (siguiente.justificado) {
                const baseReferencia = obtenerSalarioBaseDetalle(siguiente);
                const baseNormalizado = applySalarioBaseFallback(baseReferencia);
                siguiente.salario_base = baseNormalizado;
                siguiente.salario_dia = formatMontoPositivo(baseNormalizado);
              } else {
                const ausenciaSalario = resolveAusenciaSalario(siguiente);
                siguiente.salario_dia = ausenciaSalario.salario;
                if (ausenciaSalario.salarioBase !== null) {
                  siguiente.salario_base = ausenciaSalario.salarioBase;
                }
              }
            } else if (nuevoEstado === ESTADO_PERMISO) {
              const baseReferencia = obtenerSalarioBaseDetalle(siguiente);
              const baseNormalizado = applySalarioBaseFallback(baseReferencia);
              siguiente.asistio = false;
              siguiente.salario_base = baseNormalizado;
              siguiente.salario_dia = SALARIO_CERO_TEXTO;
              siguiente.es_descanso = false;
            } else if (nuevoEstado === ESTADO_DESCANSO) {
              siguiente.asistio = false;
              siguiente.es_descanso = true;
              siguiente.justificado = true;
              if (!siguiente.justificacion) {
                siguiente.justificacion = "Descanso programado";
              }
              const ausenciaSalario = resolveAusenciaSalario({
                ...siguiente,
                asistio: false,
                es_descanso: true,
              });
              siguiente.salario_dia = ausenciaSalario.salario;
              if (ausenciaSalario.salarioBase !== null) {
                siguiente.salario_base = ausenciaSalario.salarioBase;
              }
            }
            if (nuevoEstado !== ESTADO_DESCANSO) {
              siguiente.es_descanso = false;
            }
          }

          if (shouldMarkManual) {
            siguiente.autoJustificacion = false;
          }

          return siguiente;
        })
      )
    );
  }, [applySalarioBaseFallback, resolveAusenciaSalario, aplicarPoliticaAusencias]);

  const restoreDetalleDias = useCallback((detallesRestaurados = []) => {
    const sanitized = Array.isArray(detallesRestaurados)
      ? detallesRestaurados.map((detalle) => ({ ...detalle }))
      : [];

    setDetalleDias(sanitized);
  }, []);

  const normalizeDetalleSalario = useCallback((index) => {
    setDetalleDias((prev) =>
      prev.map((detalle, idx) => {
        if (idx !== index) return detalle;

        const valorActual = detalle.salario_dia;

        if (isEmptyValue(valorActual)) {
          if (detalle.salario_base !== 0) {
            return { ...detalle, salario_dia: "", salario_base: 0 };
          }
          return { ...detalle, salario_dia: "" };
        }

        const numero = parseNumberInput(valorActual);
        if (Number.isNaN(numero)) {
          return {
            ...detalle,
            salario_dia:
              typeof valorActual === "string" ? valorActual.trim() : String(valorActual ?? ""),
          };
        }

        const positivo = Math.max(numero, 0);
        const multiplicadorManual = Number(detalle.multiplicador_dia_doble);
        const factorManual =
          Number.isFinite(multiplicadorManual) && multiplicadorManual >= 1
            ? multiplicadorManual
            : 2;
        const factorBase = detalle.asistio ? (detalle.es_dia_doble ? factorManual : 1) : 1;
        const base = factorBase > 0 ? positivo / factorBase : positivo;

        return {
          ...detalle,
          salario_base: normalizeSalarioBase(base),
          salario_dia: formatMontoPositivo(positivo),
        };
      })
    );
  }, []);

  const toggleDetalleAsistencia = useCallback(
    (index) => {
      const attendanceFechas = new Set(attendanceState.fechas || []);
      const attendanceDisponible = attendanceState.dias !== null;

      setDetalleDias((prev) =>
        aplicarPoliticaAusencias(
          prev.map((detalle, idx) =>
            idx === index
              ? (() => {
                  const asistio = !detalle.asistio;
                  const baseReferencia = obtenerSalarioBaseDetalle(detalle);
                  const basePreferencia =
                    asistio && !detalle.es_dia_doble && salarioDetalleReferencia > 0 &&
                    baseReferencia > salarioDetalleReferencia
                      ? salarioDetalleReferencia
                      : baseReferencia;
                  const baseNormalizado = applySalarioBaseFallback(basePreferencia);
                  const multiplicadorManual = Number(detalle.multiplicador_dia_doble);
                  const factorDobles =
                    detalle.es_dia_doble &&
                    Number.isFinite(multiplicadorManual) &&
                    multiplicadorManual >= 1
                      ? multiplicadorManual
                      : detalle.es_dia_doble
                        ? 2
                        : 1;
                  const factorAplicado = asistio ? factorDobles : 1;
                  const salarioCalculado = asistio
                    ? formatMontoPositivo(baseNormalizado * factorAplicado)
                    : formatMontoPositivo(baseNormalizado);
                  const autoAsistio = attendanceFechas.has(detalle.fecha);
                  const asistenciaManual = attendanceDisponible ? asistio !== autoAsistio : true;

                  return {
                    ...detalle,
                    asistio,
                    salario_base: baseNormalizado,
                    salario_dia: salarioCalculado,
                    estado: ajustarEstadoPorAsistencia(detalle.estado, asistio),
                    autoJustificacion: false,
                    asistenciaManual,
                  };
                })()
              : detalle
          )
        )
      );
    },
    [
      attendanceState.dias,
      attendanceState.fechas,
      applySalarioBaseFallback,
      aplicarPoliticaAusencias,
      salarioDetalleReferencia,
    ]
  );

  const toggleDetalleDiaDoble = useCallback((index) => {
    setDetalleDias((prev) =>
      aplicarPoliticaAusencias(
        prev.map((detalle, idx) =>
          idx === index
            ? (() => {
                const es_dia_doble = !detalle.es_dia_doble;
                const baseReferencia = obtenerSalarioBaseDetalle(detalle);
                const baseNormalizado = applySalarioBaseFallback(baseReferencia);
                const multiplicadorManual = Number(detalle.multiplicador_dia_doble);
                const factorDobles =
                  es_dia_doble && Number.isFinite(multiplicadorManual) && multiplicadorManual >= 1
                    ? multiplicadorManual
                    : es_dia_doble
                      ? 2
                      : 1;
                const factorAplicado = detalle.asistio ? factorDobles : 1;
                const salarioCalculado = detalle.asistio
                  ? formatMontoPositivo(baseNormalizado * factorAplicado)
                  : formatMontoPositivo(baseNormalizado);

                return {
                  ...detalle,
                  es_dia_doble,
                  multiplicador_dia_doble: es_dia_doble ? factorDobles : detalle.multiplicador_dia_doble,
                  salario_base: baseNormalizado,
                  salario_dia: salarioCalculado,
                  autoJustificacion: false,
                  dia_doble_manual: true,
                };
              })()
            : detalle
        )
      )
    );
  }, [applySalarioBaseFallback, aplicarPoliticaAusencias]);

  const detalleDiasResumen = useMemo(() => {
    if (!detalleDias || detalleDias.length === 0) {
      return {
        diasPeriodo: 0,
        diasAsistidos: 0,
        diasFaltantes: 0,
        salarioTotal: 0,
        diasDobles: 0,
        montoDiasDobles: 0,
      };
    }

    return detalleDias.reduce(
      (acumulado, detalle) => {
        const salario = toPositiveNumber(detalle.salario_dia);
        const salarioBase = toPositiveNumber(detalle.salario_base);
        const pagado = salario > 0;
        const multiplicador = (() => {
          const valor = Number(detalle.multiplicador_dia_doble);
          if (Number.isFinite(valor) && valor >= 1) {
            return valor;
          }
          return detalle.es_dia_doble ? 2 : 1;
        })();
        const factorAsistencia = detalle.asistio ? (detalle.es_dia_doble ? multiplicador : 1) : 1;

        if (pagado) {
          acumulado.diasAsistidos += factorAsistencia;
          acumulado.salarioTotal += salario;

          if (detalle.es_dia_doble && detalle.asistio) {
            acumulado.diasDobles += 1;
            const extra = salario - salarioBase;
            const extraNormalizado = Number.isFinite(extra) && extra > 0 ? extra : salarioBase;
            acumulado.montoDiasDobles += Math.max(extraNormalizado, 0);
          }
        } else {
          acumulado.diasFaltantes += 1;
        }

        acumulado.diasPeriodo += 1;
        return acumulado;
      },
      {
        diasPeriodo: 0,
        diasAsistidos: 0,
        diasFaltantes: 0,
        salarioTotal: 0,
        diasDobles: 0,
        montoDiasDobles: 0,
      }
    );
  }, [detalleDias, esPagoQuincenal]);

  const obtenerSaldoPrestamo = (id_prestamo) => {
    const prestamo = prestamosEmpleado.find((item) => item.id_prestamo === id_prestamo);
    return Math.max(Number(prestamo?.saldo) || 0, 0);
  };

  const togglePrestamo = (id_prestamo) => {
    setPrestamoSelections((prev) => {
      const actual = prev[id_prestamo] || { aplicar: false, monto: 0 };
      return {
        ...prev,
        [id_prestamo]: {
          ...actual,
          aplicar: !actual.aplicar,
        },
      };
    });
  };

  const updateMontoPrestamo = (id_prestamo, value) => {
    const saldo = obtenerSaldoPrestamo(id_prestamo);
    const monto = clampMonto(value, saldo);

    setPrestamoSelections((prev) => {
      const actual = prev[id_prestamo] || { aplicar: true, monto: 0 };
      return {
        ...prev,
        [id_prestamo]: {
          ...actual,
          monto,
        },
      };
    });
  };

  const prestamosSeleccionados = useMemo(() => {
    return prestamosEmpleado
      .map((prestamo) => {
        const seleccion = prestamoSelections[prestamo.id_prestamo];
        if (!seleccion || !seleccion.aplicar) return null;

        const saldo = Math.max(Number(prestamo.saldo) || 0, 0);
        const monto = clampMonto(seleccion.monto, saldo);

        if (monto <= 0) return null;

        return {
          id_prestamo: prestamo.id_prestamo,
          monto_pago: monto,
          saldo_actual: saldo,
        };
      })
      .filter(Boolean);
  }, [prestamosEmpleado, prestamoSelections]);

  const totalPrestamosSeleccionados = useMemo(() => {
    return prestamosSeleccionados.reduce((sum, prestamo) => sum + prestamo.monto_pago, 0);
  }, [prestamosSeleccionados]);

  useEffect(() => {
    if (!modalOpen || editingPlanilla) return;

    if (!formData.id_empleado || !formData.periodo_inicio || !formData.periodo_fin) {
      setAttendanceState((prev) => {
        if (!prev.loading && prev.dias === null && !prev.error && !prev.message) {
          return prev;
        }
        return { loading: false, dias: null, fechas: [], error: "", message: "" };
      });
      return;
    }

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === formData.id_empleado
    );

    if (!empleadoSeleccionado || empleadoSeleccionado.tipo_pago !== "Diario") {
      setAttendanceState((prev) => {
        if (!prev.loading && prev.dias === null && !prev.error && !prev.message) {
          return prev;
        }
        return { loading: false, dias: null, fechas: [], error: "", message: "" };
      });
      return;
    }

    if (formData.es_automatica !== "1") {
      setAttendanceState((prev) => ({
        ...prev,
        loading: false,
        dias: null,
        fechas: [],
        error: "",
        message: "Planilla manual: asistencia automática desactivada.",
      }));
      return;
    }

    const inicio = parseDateSafe(formData.periodo_inicio);
    const fin = parseDateSafe(formData.periodo_fin);

    if (!inicio || !fin || fin < inicio) {
      setAttendanceState((prev) => ({ ...prev, dias: null, fechas: [], message: "" }));
      return;
    }

    let cancelled = false;
    const cacheKey = `${formData.id_empleado}-${formData.periodo_inicio}-${formData.periodo_fin}`;

    const normalizeAttendanceData = (data) => {
      const dias = Number(data?.dias) || 0;
      const fechas = Array.isArray(data?.fechas)
        ? Array.from(
            new Set(
              data.fechas
                .map((fecha) => (typeof fecha === "string" ? fecha.trim() : ""))
                .filter((fecha) => fecha.length > 0)
            )
          )
        : [];
      return { dias, fechas };
    };

    const applyAttendanceData = ({ dias, fechas }) => {
      const previousAuto = autoDiasRef.current;
      autoDiasRef.current = dias;

      setAttendanceState({ loading: false, dias, fechas, error: "", message: "" });

      setFormData((prev) => {
        const actualNumero = Number(prev.dias_trabajados);
        if (
          prev.dias_trabajados === "" ||
          Number.isNaN(actualNumero) ||
          actualNumero === previousAuto
        ) {
          const nextValue = dias ? dias.toString() : "0";
          if (prev.dias_trabajados === nextValue) {
            return prev;
          }
          return { ...prev, dias_trabajados: nextValue };
        }
        return prev;
      });

      syncDetalleWithAttendance(fechas);
    };

    if (attendanceDebounceRef.current) {
      clearTimeout(attendanceDebounceRef.current);
    }

    const cached = attendanceCacheRef.current.get(cacheKey);
    if (cached) {
      applyAttendanceData(cached);
      return () => {
        cancelled = true;
      };
    }

    attendanceDebounceRef.current = setTimeout(() => {
      const fetchDias = async () => {
        setAttendanceState((prev) => ({
          ...prev,
          loading: true,
          fechas: [],
          error: "",
          message: "",
        }));
        try {
          const data = await planillaService.getAttendanceSummary({
            id_empleado: formData.id_empleado,
            periodo_inicio: formData.periodo_inicio,
            periodo_fin: formData.periodo_fin,
          });

          if (cancelled) return;

          const normalized = normalizeAttendanceData(data);
          attendanceCacheRef.current.set(cacheKey, normalized);
          applyAttendanceData(normalized);
        } catch (err) {
          if (cancelled) return;
          console.error(err);
          setAttendanceState({
            loading: false,
            dias: null,
            fechas: [],
            error: "No fue posible obtener los días de asistencia",
            message: "",
          });
        }
      };

      fetchDias();
    }, 300);

    return () => {
      cancelled = true;
      if (attendanceDebounceRef.current) {
        clearTimeout(attendanceDebounceRef.current);
      }
    };
  }, [
    modalOpen,
    editingPlanilla,
    formData.id_empleado,
    formData.periodo_inicio,
    formData.periodo_fin,
    formData.es_automatica,
    empleados,
    attendanceReloadKey,
    syncDetalleWithAttendance,
  ]);

  useEffect(() => {
    if (!modalOpen || editingPlanilla) return;
    if (!formData.id_empleado) return;
    if (detalleDias.length === 0) return;

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === formData.id_empleado
    );

    if (!empleadoSeleccionado || empleadoSeleccionado.tipo_pago !== "Diario") {
      return;
    }

    if (formData.es_automatica !== "1") {
      return;
    }

    if (attendanceState.dias === null) {
      return;
    }

    syncDetalleWithAttendance(attendanceState.fechas);
  }, [
    modalOpen,
    editingPlanilla,
    formData.id_empleado,
    formData.es_automatica,
    detalleDias,
    empleados,
    attendanceState.dias,
    attendanceState.fechas,
    syncDetalleWithAttendance,
  ]);

  const buildNumber = (value) => {
    const parsed = parseNumberInput(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  const parseNonNegative = (value) => {
    const parsed = parseNumberInput(value);
    if (Number.isNaN(parsed) || parsed < 0) return 0;
    return parsed;
  };

  const parseOptionalNonNegative = (value) => {
    if (isEmptyValue(value)) return null;
    return parseNonNegative(value);
  };

  const refreshAttendance = useCallback(() => {
    if (!formData.id_empleado || !formData.periodo_inicio || !formData.periodo_fin) {
      setAttendanceState((prev) => ({
        ...prev,
        error: "Selecciona empleado y fechas para consultar asistencia",
        message: "",
      }));
      return;
    }

    const empleadoSeleccionado = empleados.find(
      (empleado) => String(empleado.id_empleado) === formData.id_empleado
    );

    if (!empleadoSeleccionado) {
      setAttendanceState((prev) => ({
        ...prev,
        error: "No se encontró información del colaborador seleccionado",
        message: "",
      }));
      return;
    }

    if (empleadoSeleccionado.tipo_pago !== "Diario") {
      const detallesBase = buildDetalleDias(
        empleadoSeleccionado,
        formData.periodo_inicio,
        formData.periodo_fin,
      );

      const keyActual = `${formData.id_empleado}-${formData.periodo_inicio}-${formData.periodo_fin}`;
      const debeAplicarJustificaciones = detalleJustificaciones.key === keyActual;
      const fechasAsistencia =
        detalleAsistencia.key === keyActual ? detalleAsistencia.fechas : [];
      let detallesRestaurados = aplicarAsistenciaDetalle(detallesBase, fechasAsistencia);
      detallesRestaurados = aplicarAsistenciaManual(
        detallesRestaurados,
        detalleAsistencia.key === keyActual ? detalleAsistencia.registros : [],
      );
      if (debeAplicarJustificaciones) {
        detallesRestaurados = aplicarJustificacionesAuto(
          detallesRestaurados,
          detalleJustificaciones.registros,
        );
      }
      detallesRestaurados = aplicarPoliticaAusencias(detallesRestaurados);

      setDetalleDias(detallesRestaurados);
      detalleContextRef.current = {
        empleadoId: formData.id_empleado,
        inicio: formData.periodo_inicio,
        fin: formData.periodo_fin,
      };
      autoDiasRef.current = null;
      setAttendanceState({
        loading: true,
        dias: null,
        fechas: [],
        error: "",
        message: "",
      });
      setDetalleNonDiarioReloadKey((prev) => prev + 1);
      return;
    }

    if (formData.es_automatica !== "1") {
      setAttendanceState((prev) => ({
        ...prev,
        error: "",
        message: "Planilla manual: asistencia automática desactivada.",
      }));
      return;
    }

    setAttendanceState((prev) => ({ ...prev, error: "", message: "" }));
    setAttendanceReloadKey((key) => key + 1);
  }, [
    empleados,
    formData.id_empleado,
    formData.periodo_inicio,
    formData.periodo_fin,
    formData.es_automatica,
    buildDetalleDias,
    detalleJustificaciones.key,
    detalleJustificaciones.registros,
    detalleAsistencia.key,
    detalleAsistencia.fechas,
    detalleAsistencia.registros,
    aplicarAsistenciaDetalle,
    aplicarAsistenciaManual,
    aplicarPoliticaAusencias,
  ]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      setError("");

      const empleadoIdSeleccionado = formData.id_empleado ? String(formData.id_empleado) : "";

      if (!editingPlanilla) {
        if (!empleadoIdSeleccionado || !formData.periodo_inicio || !formData.periodo_fin) {
          setError("Selecciona empleado y periodo de pago");
          return;
        }

        if (new Date(formData.periodo_fin) < new Date(formData.periodo_inicio)) {
          setError("La fecha fin debe ser mayor o igual a la fecha inicio");
          return;
        }

        if (
          hasOverlappingPlanilla(
            planillas,
            empleadoIdSeleccionado,
            formData.periodo_inicio,
            formData.periodo_fin
          )
        ) {
          setError("Este colaborador ya tiene una planilla generada para el periodo seleccionado");
          return;
        }
      }

      const empleadoSeleccionado = empleados.find(
        (empleado) => String(empleado.id_empleado) === empleadoIdSeleccionado
      );

      if (!empleadoSeleccionado) {
        setError("No se encontró información del colaborador seleccionado");
        return;
      }

      const deduccionesManuales = buildNumber(formData.deducciones);
      const tipoPagoEmpleado = empleadoSeleccionado?.tipo_pago || "Quincenal";
      const salarioBaseEmpleado = Number(empleadoSeleccionado?.salario_monto) || 0;

      const diasDoblesDetalle = Number(detalleDiasResumen.diasDobles) || 0;
      const montoDoblesDetalle = Number(detalleDiasResumen.montoDiasDobles) || 0;

      const diasDoblesManual = parseOptionalNonNegative(formData.dias_dobles);
      const montoDoblesManual = parseOptionalNonNegative(formData.monto_dias_dobles);
      const ingresoManualDobles =
        (formData.monto_dias_dobles !== "" && formData.monto_dias_dobles !== null) ||
        diasDoblesManual !== null;
      const usaDoblesManualPayload = detalleDias.length === 0 || ingresoManualDobles;

      let diasDoblesPayload = null;
      let montoDoblesPayload = null;

      if (usaDoblesManualPayload) {
        diasDoblesPayload = diasDoblesManual ?? 0;
        if (montoDoblesManual !== null) {
          montoDoblesPayload = montoDoblesManual;
        } else if ((diasDoblesManual ?? 0) > 0) {
          const salarioReferenciaDobles =
            tipoPagoEmpleado === "Diario"
              ? salarioBaseEmpleado
              : salarioBaseEmpleado / obtenerDiasReferencia(tipoPagoEmpleado);
          montoDoblesPayload = Number((salarioReferenciaDobles * (diasDoblesManual ?? 0)).toFixed(2));
        } else {
          montoDoblesPayload = 0;
        }
      } else if (diasDoblesDetalle > 0) {
        diasDoblesPayload = Number(diasDoblesDetalle.toFixed(2));
        montoDoblesPayload = Number(montoDoblesDetalle.toFixed(2));
      }

      const detallesPayload = detalleDias.map((detalle) => ({
        fecha: detalle.fecha,
        dia_semana: detalle.dia_semana,
        salario_dia: buildNumber(detalle.salario_dia),
        asistio: Boolean(detalle.asistio),
        es_dia_doble: Boolean(detalle.es_dia_doble),
        estado: resolveEstadoPersistencia(detalle),
        asistencia: (() => {
          if (typeof detalle.asistencia === "string") {
            const texto = detalle.asistencia.trim();
            if (texto.length > 0) {
              return texto.length > 50 ? texto.slice(0, 50) : texto;
            }
          }
          return detalle.asistio ? "Asistió" : "Faltó";
        })(),
        tipo: (() => {
          if (typeof detalle.tipo === "string") {
            const texto = detalle.tipo.trim();
            if (texto.length > 0) {
              return texto.length > 50 ? texto.slice(0, 50) : texto;
            }
          }
          return detalle.es_dia_doble ? "Día doble" : "Normal";
        })(),
        justificado: Boolean(detalle.justificado),
        justificacion:
          Boolean(detalle.justificado) && detalle.justificacion
            ? String(detalle.justificacion).trim()
            : null,
        observacion:
          detalle.observacion && detalle.observacion.trim() !== ""
            ? detalle.observacion.trim()
            : null,
      }));

      const commonPayload = {
        horas_extras: buildNumber(formData.horas_extras),
        bonificaciones: buildNumber(formData.bonificaciones),
        deducciones: deduccionesManuales,
        fecha_pago: formData.fecha_pago || null,
        dias_trabajados: parseOptionalNonNegative(formData.dias_trabajados),
        dias_descuento: parseNonNegative(formData.dias_descuento),
        monto_descuento_dias: parseOptionalNonNegative(formData.monto_descuento_dias),
        dias_dobles: diasDoblesPayload,
        monto_dias_dobles: montoDoblesPayload,
        es_automatica: formData.es_automatica === "1" ? 1 : 0,
        detalles: detallesPayload,
      };

      if (!editingPlanilla) {
        const prestamosPayload = prestamosSeleccionados.map((prestamo) => {
          if (prestamo.monto_pago > prestamo.saldo_actual) {
            throw new Error("El monto de pago supera el saldo disponible del préstamo");
          }

          return {
            id_prestamo: prestamo.id_prestamo,
            monto_pago: Number(prestamo.monto_pago.toFixed(2)),
          };
        });

        const payload = {
          ...commonPayload,
          id_empleado: Number(empleadoIdSeleccionado),
          periodo_inicio: formData.periodo_inicio,
          periodo_fin: formData.periodo_fin,
          prestamos: prestamosPayload,
        };

        await planillaService.create(payload);
      } else {
        const planillaIdValue = resolvePlanillaId(editingPlanilla);
        if (!planillaIdValue) {
          setError("No se pudo identificar la planilla seleccionada para actualizar");
          return;
        }

        await planillaService.update(planillaIdValue, commonPayload);
      }

      setModalOpen(false);
      resetForm();
      await fetchPlanillas();
      await fetchPrestamos();
    } catch (err) {
      console.error(err);
      const isConflict = err.response?.status === 409;
      const message =
        err.response?.data?.error ||
        (isConflict
          ? "Este colaborador ya tiene una planilla registrada en ese periodo"
          : err.message) ||
        "Error al guardar la planilla";
      setError(message);
    }
  };

  const totals = useMemo(() => {
    const formatter = new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency: "CRC",
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 2,
    });

    const totalPago = planillas.reduce((sum, planilla) => sum + (Number(planilla.pago_neto) || 0), 0);

    return {
      totalPago: formatter.format(totalPago),
      cantidad: planillas.length,
    };
  }, [planillas]);

  return {
    planillas,
    empleados,
    loading,
    error,
    modalOpen,
    setModalOpen,
    editingPlanilla,
    formData,
    handleChange,
    handleSubmit,
    handleEdit,
    openCreateModal,
    selectEmpleado,
    resetForm,
    fetchPlanillas,
    setError,
    totals,
    prestamosEmpleado,
    prestamoSelections,
    togglePrestamo,
    updateMontoPrestamo,
    totalPrestamosSeleccionados,
    employeeAllowsAutoAttendance,
    attendanceState,
    refreshAttendance,
    detalleDias,
    updateDetalleDia,
    restoreDetalleDias,
    normalizeDetalleSalario,
    toggleDetalleAsistencia,
    toggleDetalleDiaDoble,
    detalleDiasResumen,
    detalleEstadoOptions,
  };
};

const normalizeDate = (value) => {
  if (!value) return "";
  return value.split("T")[0];
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined) return "0";
  return String(value);
};

const calculateQuincenaDefaults = () => {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = hoy.getMonth();
  const dia = hoy.getDate();

  if (dia <= 15) {
    const inicio = new Date(anio, mes, 1);
    const fin = new Date(anio, mes, 15);
    const pago = new Date(anio, mes, 15);

    return {
      periodo_inicio: formatDateInput(inicio),
      periodo_fin: formatDateInput(fin),
      fecha_pago: formatDateInput(pago),
    };
  }

  const inicio = new Date(anio, mes, 16);
  const fin = new Date(anio, mes + 1, 0);

  return {
    periodo_inicio: formatDateInput(inicio),
    periodo_fin: formatDateInput(fin),
    fecha_pago: formatDateInput(fin),
  };
};

const formatDateInput = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const calcularCuotaSugerida = (prestamo) => {
  const saldo = Math.max(Number(prestamo?.saldo) || 0, 0);
  const cuotas = Math.max(Number(prestamo?.cuotas) || 1, 1);
  const monto = Math.max(Number(prestamo?.monto) || saldo, saldo);
  const cuota = monto / cuotas;

  if (!Number.isFinite(cuota) || cuota <= 0) {
    return saldo;
  }

  return Math.min(Number(cuota.toFixed(2)), saldo);
};

const clampMonto = (value, saldoMaximo) => {
  const numero = Number(value);
  if (Number.isNaN(numero) || numero <= 0) return 0;

  if (!Number.isFinite(saldoMaximo) || saldoMaximo <= 0) return 0;

  const maximo = Number(saldoMaximo.toFixed(2));
  return Math.min(Number(numero.toFixed(2)), maximo);
};
