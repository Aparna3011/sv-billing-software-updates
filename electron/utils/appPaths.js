const { app } = require('electron');
const fs = require('fs');
const path = require('path');

function getUserDataPath() {
  return app.getPath('userData');
}

function getDataDir() {
  return path.join(getUserDataPath(), 'data');
}

function getDbPath() {
  return path.join(getDataDir(), 'sv-billing.db');
}

function getExportsDir() {
  return path.join(getUserDataPath(), 'exports');
}

function getBackupsDir() {
  return path.join(getUserDataPath(), 'backups');
}

function ensureAppDirs() {
  [getDataDir(), getExportsDir(), getBackupsDir()].forEach(dir => fs.mkdirSync(dir, { recursive: true }));
}

module.exports = { ensureAppDirs, getUserDataPath, getDataDir, getDbPath, getExportsDir, getBackupsDir };
