const { app, BrowserWindow, Menu, dialog, session } = require('electron');
const path = require('path');

// Electron necesita una API key válida para poder resolver la ubicación con el
// proveedor de geolocalización (Google). Si la aplicación web ya cuenta con una
// key configurada en variables de entorno, la reutilizamos para el cliente de
// escritorio. No sobrescribimos un valor existente para permitir personalizarla
// desde el entorno del sistema.
if (!process.env.GOOGLE_API_KEY) {
  process.env.GOOGLE_API_KEY =
    process.env.ELECTRON_GOOGLE_API_KEY ||
    process.env.VITE_GOOGLE_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    process.env.VITE_MAPS_API_KEY ||
    '';
}

const APP_NAME = 'Distribuidora Astua Pirie';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: APP_NAME,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    }
  });

  // Cargar el build de Vite/React cuando empacamos
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  } else {
    win.loadURL('http://localhost:5173') // Modo desarrollo con Vite
    win.webContents.openDevTools()
  }
}

function allowGeolocationRequests() {
  const defaultSession = session.defaultSession;
  if (!defaultSession) return;

  defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'geolocation') {
      return true;
    }

    return false;
  });

  defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'geolocation') {
      callback(true);
      return;
    }

    callback(false);
  });
}

function showAboutDialog() {
  dialog.showMessageBox({
    type: 'info',
    title: APP_NAME,
    message: APP_NAME,
    detail: `Versión ${app.getVersion()}`,
    buttons: ['Aceptar'],
    defaultId: 0,
  });
}

function createMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    {
      label: 'Archivo',
      submenu: [
        isMac ? { role: 'close', label: 'Cerrar ventana' } : { role: 'quit', label: 'Salir' },
      ],
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' },
      ],
    },
    {
      label: 'Ver',
      submenu: [
        { role: 'reload', label: 'Recargar' },
        { role: 'forceReload', label: 'Recarga forzada' },
        { role: 'toggleDevTools', label: 'Alternar herramientas de desarrollo' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Restablecer zoom' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' },
      ],
    },
    {
      label: 'Ventana',
      submenu: [
        { role: 'minimize', label: 'Minimizar' },
        { role: 'zoom', label: 'Zoom' },
        ...(isMac
          ? [
              { type: 'separator' },
              { role: 'front', label: 'Traer al frente' },
              { role: 'window', label: 'Ventanas' },
            ]
          : [
              { role: 'close', label: 'Cerrar' },
            ]),
      ],
    },
    {
      label: 'Ayuda',
      submenu: [
        { label: 'Acerca de', click: showAboutDialog },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  app.setName(APP_NAME);
  createWindow();
  createMenu();
  allowGeolocationRequests();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
