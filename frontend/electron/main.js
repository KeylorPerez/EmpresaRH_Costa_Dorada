const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Distribuidora Astua Pirie",
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
        { role: 'about', label: 'Acerca de' },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
