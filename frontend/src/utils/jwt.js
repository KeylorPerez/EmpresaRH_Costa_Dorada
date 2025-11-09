export const decodeJwtPayload = (token) => {
  if (!token) {
    throw new Error("Token inválido");
  }

  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Token JWT malformado");
  }

  const base64Url = parts[1];
  const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  try {
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (error) {
    throw new Error("No se pudo decodificar el token");
  }
};
