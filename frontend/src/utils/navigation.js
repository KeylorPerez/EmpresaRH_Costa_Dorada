/**
 * Utilidades relacionadas a la navegación global.
 * Centraliza redirecciones que deben funcionar tanto en web como en Electron.
 */
export const redirectToLogin = () => {
  // Con HashRouter la ruta de login vive en el hash. Usar `replace` evita
  // agregar una entrada adicional al historial al cerrar sesión.
  window.location.replace("/#/login");
};
