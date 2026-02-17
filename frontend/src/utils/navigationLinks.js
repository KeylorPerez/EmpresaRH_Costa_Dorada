import {
  FaBriefcase,
  FaCalendarCheck,
  FaCalendarDays,
  FaFileInvoiceDollar,
  FaFileSignature,
  FaGift,
  FaHandHoldingDollar,
  FaHouseChimney,
  FaUser,
  FaUmbrellaBeach,
  FaUserGear,
  FaUserGroup,
} from "react-icons/fa6";

export const adminLinks = Object.freeze([
  Object.freeze({ path: "/admin", label: "Inicio", icon: FaHouseChimney }),
  Object.freeze({ path: "/admin/asistencia", label: "Asistencia", icon: FaCalendarCheck }),
  Object.freeze({ path: "/admin/usuarios", label: "Usuarios", icon: FaUserGear }),
  Object.freeze({ path: "/admin/empleados", label: "Empleados", icon: FaUserGroup }),
  Object.freeze({ path: "/admin/puestos", label: "Puestos", icon: FaBriefcase }),
  Object.freeze({ path: "/admin/planilla", label: "Planilla", icon: FaFileInvoiceDollar }),
  Object.freeze({ path: "/admin/dias-dobles", label: "Días dobles", icon: FaCalendarDays }),
  Object.freeze({ path: "/admin/vacaciones", label: "Vacaciones", icon: FaUmbrellaBeach }),
  Object.freeze({ path: "/admin/prestamos", label: "Préstamos", icon: FaHandHoldingDollar }),
  Object.freeze({ path: "/admin/liquidaciones", label: "Liquidaciones", icon: FaFileSignature }),
  Object.freeze({ path: "/admin/aguinaldos", label: "Aguinaldos", icon: FaGift }),
]);

export const empleadoLinks = Object.freeze([
  Object.freeze({ path: "/empleado", label: "Inicio", icon: FaHouseChimney }),
  Object.freeze({ path: "/empleado/empleados", label: "Mis datos", icon: FaUser }),
  Object.freeze({ path: "/empleado/asistencia", label: "Asistencia", icon: FaCalendarCheck }),
  Object.freeze({ path: "/empleado/planilla", label: "Planilla", icon: FaFileInvoiceDollar }),
  Object.freeze({ path: "/empleado/vacaciones", label: "Vacaciones", icon: FaUmbrellaBeach }),
  Object.freeze({ path: "/empleado/prestamos", label: "Préstamos", icon: FaHandHoldingDollar }),
  Object.freeze({ path: "/empleado/liquidaciones", label: "Liquidaciones", icon: FaFileSignature }),
  Object.freeze({ path: "/empleado/aguinaldos", label: "Aguinaldos", icon: FaGift }),
]);
