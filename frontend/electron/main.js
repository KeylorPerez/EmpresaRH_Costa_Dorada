const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js")
    }
  });

  // Cargar el build de Vite/React cuando empacamos
  win.loadURL(
    app.isPackaged
      ? `file://${path.join(__dirname, '../dist/index.html')}`
      : 'http://localhost:5173' // Modo desarrollo con Vite
  );
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
