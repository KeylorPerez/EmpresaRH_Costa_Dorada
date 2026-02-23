import React from "react";

const DetalleTable = ({
  className = "",
  context = "main",
  detalleDias,
  detalleEstadoOptions,
  formatDate,
  autoResizeTextarea,
  updateDetalleDia,
  toggleDetalleAsistencia,
  toggleDetalleDiaDoble,
  normalizeDetalleSalario,
  restoreDetalleFieldFocus,
}) => {
  if (detalleDias.length === 0) {
    return (
      <p className={`text-sm text-gray-500 ${className}`}>
        Selecciona un colaborador y un periodo para visualizar el detalle diario de la planilla.
      </p>
    );
  }

  const handleJustificacionChange = (event, rowIndex) => {
    const { target } = event;
    const { value } = target;
    autoResizeTextarea(target);
    updateDetalleDia(rowIndex, { justificacion: value });
    restoreDetalleFieldFocus(target);
  };

  const handleSalarioChange = (event, rowIndex) => {
    const { target } = event;
    updateDetalleDia(rowIndex, { salario_dia: target.value });
    restoreDetalleFieldFocus(target);
  };

  const handleObservacionChange = (event, rowIndex) => {
    const { target } = event;
    updateDetalleDia(rowIndex, { observacion: target.value });
    restoreDetalleFieldFocus(target);
  };

  const handleSalarioBlur = (event, rowIndex) => {
    const { value } = event.target;
    if (value === "" || value === null) {
      updateDetalleDia(rowIndex, { salario_dia: "" });
      return;
    }
    normalizeDetalleSalario(rowIndex);
  };

  const getEstadoBadgeClass = (estado) => {
    switch ((estado || "").toString().toLowerCase()) {
      case "presente":
        return "bg-emerald-100 text-emerald-700";
      case "permiso":
        return "bg-blue-100 text-blue-700";
      case "vacaciones":
        return "bg-amber-100 text-amber-700";
      case "incapacidad":
        return "bg-purple-100 text-purple-700";
      case "ausente":
        return "bg-red-100 text-red-700";
      case "descanso":
      case "pagado":
        return "bg-slate-100 text-slate-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const resolveAsistenciaLabel = (detalle) => {
    if (detalle.es_descanso && !detalle.asistio) {
      return "Descanso";
    }
    return detalle.asistio ? "Asistió" : "Faltó";
  };

  const resolveAsistenciaClass = (detalle) => {
    if (detalle.es_descanso && !detalle.asistio) {
      return "bg-slate-100 text-slate-700 hover:bg-slate-200";
    }
    return detalle.asistio
      ? "bg-green-100 text-green-700 hover:bg-green-200"
      : "bg-red-100 text-red-600 hover:bg-red-200";
  };

  return (
    <div className={`overflow-x-auto rounded-xl border border-gray-100 ${className}`}>
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-4 py-3 text-left">Fecha</th>
            <th className="px-4 py-3 text-left">Día</th>
            <th className="px-4 py-3 text-center">Asistencia</th>
            <th className="px-4 py-3 text-center">Día doble</th>
            <th className="px-4 py-3 text-left min-w-[160px]">Estado</th>
            <th className="px-4 py-3 text-center">Justificado</th>
            <th className="px-4 py-3 text-left min-w-[240px]">Justificación</th>
            <th className="px-4 py-3 text-right">Salario día</th>
            <th className="px-4 py-3 text-left">Observación</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {detalleDias.map((detalle, index) => {
            const estadoActual =
              typeof detalle.estado === "string" && detalle.estado.trim().length > 0
                ? detalle.estado.trim()
                : detalle.es_descanso && !detalle.asistio
                  ? "Descanso"
                  : "Presente";

            const estadoSeleccionado = detalleEstadoOptions.some(
              (option) => option.value === estadoActual,
            )
              ? estadoActual
              : "Presente";

            return (
              <tr key={`${detalle.fecha}-${index}`} className="hover:bg-gray-50/70">
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                  {formatDate(detalle.fecha)}
                </td>
                <td className="px-4 py-3 capitalize text-gray-600">{detalle.dia_semana}</td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleDetalleAsistencia(index)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${resolveAsistenciaClass(
                      detalle
                    )}`}
                  >
                    {resolveAsistenciaLabel(detalle)}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => toggleDetalleDiaDoble(index)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      detalle.es_dia_doble
                        ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {detalle.es_dia_doble ? "Sí" : "No"}
                  </button>
                </td>
                <td className="px-4 py-3 min-w-[160px]">
                  <select
                    value={estadoSeleccionado}
                    onChange={(event) => updateDetalleDia(index, { estado: event.target.value })}
                    className={`w-full rounded-lg border border-gray-200 px-3 py-1 text-sm font-semibold ${getEstadoBadgeClass(
                      estadoSeleccionado
                    )} focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300`}
                  >
                    {detalleEstadoOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={Boolean(detalle.justificado)}
                    onChange={(event) => updateDetalleDia(index, { justificado: event.target.checked })}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <textarea
                    value={detalle.justificacion || ""}
                    onChange={(event) => handleJustificacionChange(event, index)}
                    placeholder="Describe la justificación"
                    rows={2}
                    maxLength={500}
                    disabled={!detalle.justificado}
                    data-detalle-field="justificacion"
                    data-detalle-index={index}
                    data-detalle-context={context}
                    ref={autoResizeTextarea}
                    className="w-full min-h-[3rem] rounded-lg border border-gray-200 px-3 py-2 text-sm leading-relaxed text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none overflow-hidden disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-500"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={detalle.salario_dia ?? ""}
                    onChange={(event) => handleSalarioChange(event, index)}
                    onBlur={(event) => handleSalarioBlur(event, index)}
                    data-detalle-field="salario_dia"
                    data-detalle-index={index}
                    data-detalle-context={context}
                    className="w-28 rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="text"
                    value={detalle.observacion || ""}
                    onChange={(event) => handleObservacionChange(event, index)}
                    placeholder="Opcional"
                    data-detalle-field="observacion"
                    data-detalle-index={index}
                    data-detalle-context={context}
                    className="w-full rounded-lg border border-gray-200 px-3 py-1 text-sm text-gray-700 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default DetalleTable;
