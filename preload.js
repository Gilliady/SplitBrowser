const { contextBridge, ipcRenderer, webFrame } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Click-through: toggle ignoring mouse events
  setClickThrough: (ignore, options) => ipcRenderer.send('set-ignore-mouse-events', ignore, options),

  // Opacity: set window opacity (0.1 to 1.0)
  setOpacity: (value) => ipcRenderer.send('set-opacity', value),

  // Settings CRUD
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),

  // Workspaces & Tabs State
  getWorkspacesState: () => ipcRenderer.invoke('get-workspaces-state'),
  saveWorkspacesState: (state) => ipcRenderer.invoke('save-workspaces-state', state),

  // RAM Optimization
  optimizeRam: async () => {
    try {
      if (webFrame) {
        webFrame.clearCache();
      }
    } catch (e) {}
    return await ipcRenderer.invoke('optimize-ram');
  },

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
