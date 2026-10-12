const { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage, screen, session, webContents } = require('electron');
const path = require('path');
const { getStore } = require('./store');

// Chromium switches para controle estrito de consumo de RAM e GPU (evita explosão de memória de 5-16GB)
// 1. Limita o heap V8 por processo a 512MB (ao invés do padrão ilimitado de 4GB por aba)
app.commandLine.appendSwitch('js-flags', '--expose-gc --max-old-space-size=512');

// 2. Limita o cache em disco e cache de mídia para valores controlados
app.commandLine.appendSwitch('disk-cache-size', '104857600'); // 100 MB máximo
app.commandLine.appendSwitch('media-cache-size', '52428800'); // 50 MB máximo

// 3. Controle e contenção do processo de GPU (evita acúmulo de gigabytes em WebGL / Canvas / Skia)
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '512');
app.commandLine.appendSwitch('disable-gpu-memory-buffer-compositor-resources');

// 4. Desativa BackForwardCache e ativa suspensão e throttling agressivo de abas/processos em segundo plano
app.commandLine.appendSwitch('disable-features', 'BackForwardCache,MediaEngagementBypassAutoplayPolicies');
app.commandLine.appendSwitch('enable-features', 'CalculateNativeWinOcclusion,IntensiveWakeUpThrottling');

// 5. Compatibilidade e resiliência de rede
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-running-insecure-content');

let store = null;
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
  if (!store) {
    console.error('Store not ready in createMainWindow');
    return;
  }
  const savedBounds = store.get('windowBounds') || {};
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();

  const targetWidth = (savedBounds && savedBounds.width && savedBounds.width >= 600) ? savedBounds.width : 1200;
  const targetHeight = (savedBounds && savedBounds.height && savedBounds.height >= 400) ? savedBounds.height : 780;

  const windowOptions = {
    width: targetWidth,
    height: targetHeight,
    minWidth: 480,
    minHeight: 360,
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

  // Otimizar imediatamente ao minimizar ou ocultar
  mainWindow.on('minimize', () => {
    performRamOptimization().catch(() => {});
  });
  mainWindow.on('hide', () => {
    performRamOptimization().catch(() => {});
  });

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
    width: 520,
    height: 640,
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
// RAM Optimization & Garbage Collection System
// ---------------------------------------------------------------------------

function trimWindowsMemory() {
  if (process.platform !== 'win32') return;
  try {
    const currentExe = path.basename(process.execPath, path.extname(process.execPath));
    const script = `
$ProgressPreference = 'SilentlyContinue'
$c = @'
using System;
using System.Runtime.InteropServices;
public class WinMem { [DllImport("psapi.dll")] public static extern int EmptyWorkingSet(IntPtr h); }
'@
Add-Type -TypeDefinition $c -ErrorAction SilentlyContinue
Get-Process -Name "*${currentExe}*", "*Fixed Tool*", "*electron*" -ErrorAction SilentlyContinue | ForEach-Object {
  try { [WinMem]::EmptyWorkingSet($_.Handle) | Out-Null } catch {}
}
`;
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    const { exec } = require('child_process');
    exec(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, (err) => {
      if (err) console.warn('Memory trim notice:', err.message);
    });
  } catch (err) {
    console.warn('Trim invocation notice:', err.message);
  }
}

async function performRamOptimization() {
  try {
    // 1. Limpar cache em todas as sessões (defaultSession E sessões particionadas persist:shared)
    const sessionsToClean = [
      session.defaultSession,
      session.fromPartition('persist:shared')
    ];

    for (const ses of sessionsToClean) {
      if (ses) {
        try {
          await ses.clearCache();
          await ses.clearCodeCaches({});
          await ses.clearStorageData({ storages: ['cachestorage'] });
        } catch (e) {
          console.warn('Error clearing session cache:', e.message);
        }
      }
    }

    // 2. Acionar Garbage Collector do V8 em todos os WebContents com timeout de segurança
    const allWc = webContents.getAllWebContents();
    for (const wc of allWc) {
      if (wc && !wc.isDestroyed()) {
        try {
          Promise.race([
            wc.executeJavaScript('if (typeof window !== "undefined" && window.gc) window.gc(); void 0;', true),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 500))
          ]).catch(() => {});
        } catch (e) {}
      }
    }

    // 3. Forçar GC no processo principal do Node.js
    if (global.gc) {
      global.gc();
    }

    // 4. Esvaziar páginas inativas do Working Set no Windows
    if (process.platform === 'win32') {
      trimWindowsMemory();
    }

    return { success: true };
  } catch (err) {
    console.error('Falha ao otimizar RAM:', err);
    return { success: false, error: err.message };
  }
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
      defaultUrl: store.get('defaultUrl') || 'https://google.com',
      opacity: store.get('opacity'),
      clickThrough: store.get('clickThrough'),
      alwaysOnTop: store.get('alwaysOnTop'),
      windowBounds: store.get('windowBounds'),
      shortcutClickThrough: store.get('shortcutClickThrough'),
      shortcutVisibility: store.get('shortcutVisibility'),
      hibernateTimeoutMinutes: store.get('hibernateTimeoutMinutes') || 30
    };
  });

  // Workspaces State
  ipcMain.handle('get-workspaces-state', () => {
    return {
      workspaces: store.get('workspaces') || [],
      activeWorkspaceId: store.get('activeWorkspaceId') || 'ws-default',
      defaultUrl: store.get('defaultUrl') || 'https://google.com',
      hibernateTimeoutMinutes: store.get('hibernateTimeoutMinutes') || 30
    };
  });

  ipcMain.handle('save-workspaces-state', (_event, state) => {
    if (state && Array.isArray(state.workspaces)) {
      store.set('workspaces', state.workspaces);
    }
    if (state && state.activeWorkspaceId) {
      store.set('activeWorkspaceId', state.activeWorkspaceId);
    }
    return { success: true };
  });

  // RAM Optimization & Cache Pruning
  ipcMain.handle('optimize-ram', async () => {
    return await performRamOptimization();
  });

  // Save settings
  ipcMain.handle('save-settings', (_event, data) => {
    if (data.url !== undefined) store.set('url', data.url);
    if (data.defaultUrl !== undefined) store.set('defaultUrl', data.defaultUrl);
    if (data.hibernateTimeoutMinutes !== undefined) store.set('hibernateTimeoutMinutes', data.hibernateTimeoutMinutes);
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
    
    let shortcutsChanged = false;
    if (data.shortcutClickThrough !== undefined && data.shortcutClickThrough !== store.get('shortcutClickThrough')) {
      store.set('shortcutClickThrough', data.shortcutClickThrough);
      shortcutsChanged = true;
    }
    if (data.shortcutVisibility !== undefined && data.shortcutVisibility !== store.get('shortcutVisibility')) {
      store.set('shortcutVisibility', data.shortcutVisibility);
      shortcutsChanged = true;
    }

    if (shortcutsChanged) {
      registerGlobalShortcuts();
    }

    // Notify main window renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('settings-updated', {
        url: store.get('url'),
        defaultUrl: store.get('defaultUrl'),
        opacity: store.get('opacity'),
        clickThrough: store.get('clickThrough'),
        alwaysOnTop: store.get('alwaysOnTop'),
        windowBounds: store.get('windowBounds'),
        hibernateTimeoutMinutes: store.get('hibernateTimeoutMinutes')
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
  globalShortcut.unregisterAll();

  const shortcutCT = store.get('shortcutClickThrough') || 'CommandOrControl+Shift+O';
  const shortcutVis = store.get('shortcutVisibility') || 'CommandOrControl+Shift+H';

  // Toggle click-through
  try {
    globalShortcut.register(shortcutCT, () => {
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
  } catch (err) {
    console.error('Failed to register click-through shortcut', err);
  }

  // Toggle visibility
  try {
    globalShortcut.register(shortcutVis, () => {
      if (!mainWindow || mainWindow.isDestroyed()) return;

      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
      }
    });
  } catch (err) {
    console.error('Failed to register visibility shortcut', err);
  }
}

// ---------------------------------------------------------------------------
// App Lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(async () => {
  store = await getStore();

  // Configurar tanto a defaultSession quanto a sessão persist:shared dos webviews
  const targetSessions = [
    session.defaultSession,
    session.fromPartition('persist:shared')
  ];

  targetSessions.forEach(sess => {
    if (!sess) return;

    // Aceitar qualquer certificado mesmo com inconsistências
    sess.setCertificateVerifyProc((request, callback) => {
      callback(0); // 0 = Aceitar
    });
  });

  registerIPC();
  createMainWindow();
  createTray();
  registerGlobalShortcuts();

  // Manutenção periódica automática a cada 2 minutos (previne acúmulo de cache/RAM após horas de uso)
  setInterval(() => {
    performRamOptimization().catch(() => {});
  }, 2 * 60 * 1000);
});

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
  event.preventDefault();
  callback(true);
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
