const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lpotify', {
  isElectron: true,
  resolveAudio: (query, duration) => ipcRenderer.invoke('resolve-audio', { query, duration }),
  downloadAudio: (query, fileName, trackId, duration) => ipcRenderer.invoke('download-audio', { query, fileName, trackId, duration }),
  cacheAudioTemporarily: (query, duration) => ipcRenderer.invoke('cache-audio-temporarily', { query, duration }),
  onDownloadProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('download-progress', listener);
    return () => ipcRenderer.removeListener('download-progress', listener);
  },
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
