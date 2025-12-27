const normalizeNumericString = (value) => {
  if (typeof value !== "string") return "";

  const trimmed = value.trim();
  if (!trimmed) return "";

  let cleaned = trimmed.replace(/\s+/g, "");
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");

  if (hasComma && hasDot) {
    const lastComma = cleaned.lastIndexOf(",");
    const lastDot = cleaned.lastIndexOf(".");
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, "");
    }
  }

  if (hasComma) {
    cleaned = cleaned.replace(/,/g, ".");
  }

  return cleaned;
};

const parseNumberInput = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value === "string") {
    const normalized = normalizeNumericString(value);
    if (!normalized) return Number.NaN;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  if (value === "" || value === null || value === undefined) {
    return Number.NaN;
  }

  return Number.NaN;
};

const toPositiveNumber = (value) => {
  const numero = parseNumberInput(value);
  if (Number.isNaN(numero)) {
    return 0;
  }
  return Math.max(numero, 0);
};

export { normalizeNumericString, parseNumberInput, toPositiveNumber };
