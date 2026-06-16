require('@babel/register')({
  extensions: ['.js', '.jsx'],
});

const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const { initDatabase, closeDb } = require('./db/database');
const { BackupService } = require('./utils/backup');
const { registerIpcHandlers } = require('./ipc');
const { ensureAppDirs } = require('./utils/appPaths');
const { initialLoad } = require('./services/initialLoad.service');
require('./ipc/analytics.handler')();

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#f8fafc',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(() => {
  ensureAppDirs();
  initDatabase();
  registerIpcHandlers(ipcMain, () => mainWindow, shell);
  createWindow();
    setTimeout(() => {

    initialLoad();

  }, 1000);
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let isQuitting = false;

app.on('before-quit', async (event) => {
  if (isQuitting) return;

  // Prevent the app from quitting immediately to allow async backup
  event.preventDefault();
  console.log('Initiating automatic backup before exit...');

  try {
    await BackupService.create('auto');
    console.log('Automatic backup successful.');
  } catch (err) {
    console.error('Automatic backup failed during shutdown:', err);
  } finally {
    isQuitting = true;
    console.log('Closing database safely...');
    closeDb();
    app.quit();
  }
});
