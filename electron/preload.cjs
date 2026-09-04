const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lpotify', {
  isElectron: true,
  resolveAudio: (query) => ipcRenderer.invoke('resolve-audio', query),
  downloadAudio: (query, fileName) => ipcRenderer.invoke('download-audio', { query, fileName }),
  getDownloadsDir: () => ipcRenderer.invoke('get-downloads-dir'),
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
  localAudioUrl: (filePath) => ipcRenderer.invoke('local-audio-url', filePath),
});
