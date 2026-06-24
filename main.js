const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage, screen } = require('electron');
const path = require('path');
const store = require('./store');

let mainWindow = null;
let settingsWindow = null;
let tray = null;
let boundsTimeout = null;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function saveBoundsDebounced() {
  if (boundsTimeout) clearTimeout(boundsTimeout);
  boundsTimeout = setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      store.set('windowBounds', mainWindow.getBounds());
    }
  }, 300);
}

function createTrayIcon() {
  // Programmatically generate a 16x16 tray icon (a small purple pin square)
  // This is a minimal valid 16x16 PNG encoded as base64
  const canvas = (() => {
    // Build a raw 16x16 RGBA bitmap, then wrap it in a PNG
    const width = 16;
    const height = 16;

    // ---- Build raw pixel data (RGBA) ----
    const pixels = Buffer.alloc(width * height * 4);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;

        // Create a rounded-square pin icon shape
        const cx = 7.5, cy = 7.5, r = 6;
        const dx = x - cx, dy = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= r) {
          // Purple-ish gradient
          pixels[idx] = 138;     // R
          pixels[idx + 1] = 43;  // G
          pixels[idx + 2] = 226; // B
          pixels[idx + 3] = 255; // A
        } else {
          // Transparent
          pixels[idx + 3] = 0;
        }
      }
    }

    // ---- Encode as PNG ----
    // Minimal PNG encoder (uncompressed, using zlib stored blocks)
    const zlib = require('zlib');

    // PNG filter: prepend 0 (None) to each row
    const rawData = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
      rawData[y * (1 + width * 4)] = 0; // filter byte
      pixels.copy(rawData, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
    }

    const compressed = zlib.deflateSync(rawData);

    // Build PNG file
    function crc32(buf) {
      let crc = 0xFFFFFFFF;
      for (let i = 0; i < buf.length; i++) {
        crc ^= buf[i];
        for (let j = 0; j < 8; j++) {
          crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
        }
      }
      return (crc ^ 0xFFFFFFFF) >>> 0;
    }

    function chunk(type, data) {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(typeAndData));
      return Buffer.concat([len, typeAndData, crc]);
    }

    const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; // bit depth
    ihdr[9] = 6; // color type RGBA
    ihdr[10] = 0; // compression
    ihdr[11] = 0; // filter
    ihdr[12] = 0; // interlace

    const png = Buffer.concat([
      signature,
      chunk('IHDR', ihdr),
      chunk('IDAT', compressed),
      chunk('IEND', Buffer.alloc(0))
    ]);

    return png;
  })();

  const dataUrl = 'data:image/png;base64,' + canvas.toString('base64');
  return nativeImage.createFromDataURL(dataUrl);
}

// ---------------------------------------------------------------------------
// Main Window
// ---------------------------------------------------------------------------

function createMainWindow() {
  const savedBounds = store.get('windowBounds');
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  const windowOptions = {
    width: savedBounds.width || 420,
    height: savedBounds.height || 650,
    transparent: true,
    frame: false,
    alwaysOnTop: store.get('alwaysOnTop'),
    hasShadow: false,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true
    }
  };

  // Restore saved position if valid (within any display)
  if (savedBounds.x !== undefined && savedBounds.y !== undefined) {
    const inBounds = displays.some(d => {
      const b = d.bounds;
      return savedBounds.x >= b.x && savedBounds.x < b.x + b.width &&
             savedBounds.y >= b.y && savedBounds.y < b.y + b.height;
    });
    if (inBounds) {
      windowOptions.x = savedBounds.x;
      windowOptions.y = savedBounds.y;
    }
  }

  mainWindow = new BrowserWindow(windowOptions);

  // Center if no saved position was applied
  if (windowOptions.x === undefined) {
    mainWindow.center();
  }

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  // Apply saved opacity
  mainWindow.setOpacity(store.get('opacity'));

  // Apply saved click-through
  if (store.get('clickThrough')) {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
  }

  // Debounced bounds saving
  mainWindow.on('move', saveBoundsDebounced);
  mainWindow.on('resize', saveBoundsDebounced);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ---------------------------------------------------------------------------
// Settings Window
// ---------------------------------------------------------------------------

function createSettingsWindow() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 500,
    height: 550,
    frame: false,
    resizable: false,
    parent: mainWindow,
    modal: process.platform === 'win32',
    transparent: false,
    alwaysOnTop: false,
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'src', 'settings.html'));

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

function registerIPC() {
  // Click-through
  ipcMain.on('set-ignore-mouse-events', (_event, ignore, options) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setIgnoreMouseEvents(ignore, options || {});
    }
  });

  // Opacity
  ipcMain.on('set-opacity', (_event, value) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setOpacity(value);
      store.set('opacity', value);
    }
  });

  // Get settings
  ipcMain.handle('get-settings', () => {
    return {
      url: store.get('url'),
      opacity: store.get('opacity'),
      clickThrough: store.get('clickThrough'),
      alwaysOnTop: store.get('alwaysOnTop'),
      windowBounds: store.get('windowBounds')
    };
  });

  // Save settings
  ipcMain.handle('save-settings', (_event, data) => {
    if (data.url !== undefined) store.set('url', data.url);
    if (data.opacity !== undefined) {
      store.set('opacity', data.opacity);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setOpacity(data.opacity);
      }
    }
    if (data.clickThrough !== undefined) {
      store.set('clickThrough', data.clickThrough);
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (data.clickThrough) {
          mainWindow.setIgnoreMouseEvents(true, { forward: true });
        } else {
          mainWindow.setIgnoreMouseEvents(false);
        }
      }
    }
    if (data.alwaysOnTop !== undefined) {
      store.set('alwaysOnTop', data.alwaysOnTop);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setAlwaysOnTop(data.alwaysOnTop);
      }
    }

    // Notify main window renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-updated', {
        url: store.get('url'),
        opacity: store.get('opacity'),
        clickThrough: store.get('clickThrough'),
        alwaysOnTop: store.get('alwaysOnTop'),
        windowBounds: store.get('windowBounds')
      });
    }

    // Close settings window
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
    }

    return { success: true };
  });

  // Open settings
  ipcMain.on('open-settings', () => {
    createSettingsWindow();
  });

  // Close app
  ipcMain.on('close-app', () => {
    app.quit();
  });

  // Minimize app
  ipcMain.on('minimize-app', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.minimize();
    }
  });
}

// ---------------------------------------------------------------------------
// System Tray
// ---------------------------------------------------------------------------

function createTray() {
  const icon = createTrayIcon();
  tray = new Tray(icon);
  tray.setToolTip('Fixed Tool - Overlay');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
          }
        }
      }
    },
    {
      label: 'Settings',
      click: () => {
        createSettingsWindow();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Global Shortcuts
// ---------------------------------------------------------------------------

function registerGlobalShortcuts() {
  // Ctrl+Shift+O: Toggle click-through
  globalShortcut.register('Ctrl+Shift+O', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    const current = store.get('clickThrough');
    const newState = !current;
    store.set('clickThrough', newState);

    if (newState) {
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
    } else {
      mainWindow.setIgnoreMouseEvents(false);
    }

    mainWindow.webContents.send('click-through-toggled', newState);
  });

  // Ctrl+Shift+H: Toggle visibility
  globalShortcut.register('Ctrl+Shift+H', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
    }
  });
}

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  registerIPC();
  createMainWindow();
  createTray();
  registerGlobalShortcuts();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createMainWindow();
  }
});
