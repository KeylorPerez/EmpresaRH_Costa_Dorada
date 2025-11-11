const DEFAULT_LOCALE = "es-CR";
const DEFAULT_OPTIONS = { year: "numeric", month: "short", day: "numeric" };

export const getTodayInputValue = () => {
  const now = new Date();
  const offsetMinutes = now.getTimezoneOffset();
  const localDate = new Date(now.getTime() - offsetMinutes * 60 * 1000);
  return localDate.toISOString().split("T")[0];
};

export const parseDateValue = (value) => {
  if (!value) return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const parseDateOnly = (dateText) => {
      const [year, month, day] = dateText.split("-").map(Number);
      if (
        Number.isFinite(year) &&
        Number.isFinite(month) &&
        Number.isFinite(day)
      ) {
        return new Date(year, month - 1, day);
      }
      return null;
    };

    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const parsed = parseDateOnly(trimmed);
      if (parsed) {
        return parsed;
      }
    }

    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
      const [datePart] = trimmed.split("T");
      const parsed = parseDateOnly(datePart);
      if (parsed) {
        return parsed;
      }
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
};

export const formatDateValue = (
  value,
  options = DEFAULT_OPTIONS,
  locale = DEFAULT_LOCALE
) => {
  const date = parseDateValue(value);
  if (!date) {
    return typeof value === "string" ? value : "";
  }

  return new Intl.DateTimeFormat(locale, options).format(date);
};
