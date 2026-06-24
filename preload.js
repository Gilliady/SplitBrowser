const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Click-through: toggle ignoring mouse events
  setClickThrough: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),

  // Opacity: set window opacity (0.1 to 1.0)
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),

  // Settings CRUD
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),

  // Window management
  openSettings: () => ipcRenderer.send('open-settings'),
  closeApp: () => ipcRenderer.send('close-app'),
  minimizeApp: () => ipcRenderer.send('minimize-app'),

  // Listen for settings changes from settings window
  onSettingsUpdated: (callback) => {
    ipcRenderer.on('settings-updated', (_event, data) => callback(data));
  },
  removeSettingsUpdatedListener: () => {
    ipcRenderer.removeAllListeners('settings-updated');
  },

  // Listen for click-through toggled via global shortcut
  onClickThroughToggled: (callback) => {
    ipcRenderer.on('click-through-toggled', (_event, state) => callback(state));
  }
});
