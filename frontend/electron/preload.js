const { contextBridge } = require('electron');

const isElectron = Boolean(process.versions?.electron);

contextBridge.exposeInMainWorld("api", {
  ping: () => "pong"
});

contextBridge.exposeInMainWorld("electron", {
  isElectron,
});
