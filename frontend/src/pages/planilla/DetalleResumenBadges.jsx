import React from "react";

const DetalleResumenBadges = ({
  className = "",
  detalleDias,
  detalleDiasResumen,
  diasDoblesAplicados,
  pagoExtraDiasDobles,
  formatCurrency,
}) => (
  <div className={`flex flex-wrap items-center gap-3 text-xs text-gray-500 ${className}`}>
    <span>Días: {detalleDias.length}</span>
    <span>Pagados: {detalleDiasResumen.diasAsistidos}</span>
    <span>Dobles: {diasDoblesAplicados}</span>
    <span>Faltas: {detalleDiasResumen.diasFaltantes}</span>
    <span>Total detalle: {formatCurrency(detalleDiasResumen.salarioTotal)}</span>
    <span>Extra días dobles: {formatCurrency(pagoExtraDiasDobles)}</span>
  </div>
);

export default DetalleResumenBadges;
