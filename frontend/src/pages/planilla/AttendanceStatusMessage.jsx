import React from "react";

const AttendanceStatusMessage = ({ attendanceState, className = "" }) => {
  if (attendanceState.error) {
    return (
      <p className={`text-xs font-medium text-red-600 ${className}`.trim()}>
        {attendanceState.error}
      </p>
    );
  }

  if (attendanceState.loading) {
    return (
      <p className={`text-xs text-blue-600 ${className}`.trim()}>
        Actualizando asistencia...
      </p>
    );
  }

  if (attendanceState.message) {
    return (
      <p className={`text-xs text-gray-500 ${className}`.trim()}>
        {attendanceState.message}
      </p>
    );
  }

  if (attendanceState.dias !== null) {
    const dias = Number(attendanceState.dias) || 0;
    const labelDias = dias === 1 ? "día" : "días";
    return (
      <p className={`text-xs text-gray-500 ${className}`.trim()}>
        Asistencia sincronizada ({dias} {labelDias} registrados).
      </p>
    );
  }

  return null;
};

export default AttendanceStatusMessage;
