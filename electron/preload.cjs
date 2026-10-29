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
  toggleMiniPlayer: () => ipcRenderer.invoke('toggle-mini-player'),
  closeMiniPlayer: () => ipcRenderer.invoke('close-mini-player'),
  getMiniPlayerSettings: () => ipcRenderer.invoke('get-mini-player-settings'),
  toggleMiniPlayerAlwaysOnTop: () => ipcRenderer.invoke('toggle-mini-player-always-on-top'),
  updateMiniPlayerState: (state) => ipcRenderer.send('mini-player-state', state),
  onMiniPlayerState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('mini-player-state', listener);
    return () => ipcRenderer.removeListener('mini-player-state', listener);
  },
  onMiniPlayerAction: (callback) => {
    const listener = (_event, action) => callback(action);
    ipcRenderer.on('mini-player-action', listener);
    return () => ipcRenderer.removeListener('mini-player-action', listener);
  },
  sendMiniPlayerAction: (action) => ipcRenderer.send('mini-player-action', action),
  onMiniPlayerVisibilityChanged: (callback) => {
    const listener = (_event, visible) => callback(Boolean(visible));
    ipcRenderer.on('mini-player-visibility-changed', listener);
    return () => ipcRenderer.removeListener('mini-player-visibility-changed', listener);
  },
});
