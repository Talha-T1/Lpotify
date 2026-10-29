const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lpotify', {
  isElectron: true,
  resolveAudio: (query) => ipcRenderer.invoke('resolve-audio', query),
  downloadAudio: (query, fileName) => ipcRenderer.invoke('download-audio', { query, fileName }),
  getDownloadsDir: () => ipcRenderer.invoke('get-downloads-dir'),
  openDownloadsFolder: () => ipcRenderer.invoke('open-downloads-folder'),
  localAudioUrl: (filePath) => ipcRenderer.invoke('local-audio-url', filePath),
  updateTaskbarControls: (state) => ipcRenderer.send('taskbar-player-state', state),
  onTaskbarPlayerAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('taskbar-player-action', listener);
    return () => ipcRenderer.removeListener('taskbar-player-action', listener);
  },
});
