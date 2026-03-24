const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const db = require('./db');

const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');

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
    backgroundColor: '#16181f',
    show: false,
  });

  if (isDev) {
    loadDevURL(mainWindow);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'renderer', 'index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
}

// Retry loading the Vite dev server until it's ready
function loadDevURL(win, retries = 20) {
  win.loadURL('http://localhost:5173').catch(() => {
    if (retries > 0) setTimeout(() => loadDevURL(win, retries - 1), 500);
  });
}

app.whenReady().then(async () => {
  await db.init(app.getPath('userData'));
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
ipcMain.handle('locations-load', () => {
  return db.getLocations();
});

// ── IPC: Save locations ───────────────────────────────────────
ipcMain.handle('locations-save', (_event, locations) => {
  db.saveLocations(locations);
});

// ── IPC: Load settings ────────────────────────────────────────
ipcMain.handle('settings-load', () => {
  return db.getSettings();
});

// ── IPC: Save settings ────────────────────────────────────────
ipcMain.handle('settings-save', (_event, settings) => {
  db.saveSettings(settings);
});

// ── IPC: Export post package ──────────────────────────────────
ipcMain.handle('post-export', async (_event, { items, outputDir }) => {
  try {
    await fs.promises.mkdir(outputDir, { recursive: true });
    for (const { imageData, imageFilename, caption, captionFilename } of items) {
      const imgBuf = Buffer.from(imageData, 'base64');
      await fs.promises.writeFile(path.join(outputDir, imageFilename), imgBuf);
      if (caption) {
        await fs.promises.writeFile(path.join(outputDir, captionFilename), caption, 'utf8');
      }
    }
    return { ok: true, dir: outputDir };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ── IPC: Businesses ───────────────────────────────────────────
ipcMain.handle('businesses-load', () => db.getBusinesses());
ipcMain.handle('business-save', (_e, business) => db.saveBusiness(business));
ipcMain.handle('business-delete', (_e, id) => db.deleteBusiness(id));
ipcMain.handle('business-set-active', (_e, id) => db.setActiveBusiness(id));
