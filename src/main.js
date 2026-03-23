const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const store = require('./store');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 820,
    height: 900,
    minWidth: 640,
    minHeight: 600,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0e0e0e',
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
}

app.whenReady().then(() => {
  store.init(app.getPath('userData'));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: Pick output folder ───────────────────────────────────
ipcMain.handle('pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Choose export folder',
  });
  return result.canceled ? null : result.filePaths[0];
});

// ── IPC: Save files ───────────────────────────────────────────
ipcMain.handle('save-files', async (_event, { srcPath, filenames, outputDir }) => {
  try {
    const resolvedDir = path.resolve(outputDir);
    for (const name of filenames) {
      const dest = path.resolve(resolvedDir, name);
      if (!dest.startsWith(resolvedDir + path.sep)) {
        throw new Error(`Unsafe filename rejected: ${name}`);
      }
      await fs.promises.copyFile(srcPath, dest);
    }
    return { ok: true, count: filenames.length, dir: outputDir };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── IPC: Open folder in Finder/Explorer ──────────────────────
ipcMain.handle('open-folder', async (_event, dir) => {
  await shell.openPath(dir);
});

// ── IPC: Default downloads path ──────────────────────────────
ipcMain.handle('get-downloads', () => {
  return path.join(os.homedir(), 'Downloads');
});

// ── IPC: Load persisted locations ────────────────────────────
ipcMain.handle('locations-load', async () => {
  const data = await store.read();
  return Array.isArray(data.locations) ? data.locations : [];
});

// ── IPC: Save locations ───────────────────────────────────────
ipcMain.handle('locations-save', async (_event, locations) => {
  const data = await store.read();
  data.locations = locations;
  await store.write(data);
});
