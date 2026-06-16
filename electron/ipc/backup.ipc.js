const { ok } = require('./helpers');
const { BackupService } = require('../utils/backup');

module.exports = ipcMain => {
  ipcMain.handle('backup:create', ok(({ label }) => BackupService.create(label || 'manual')));
  ipcMain.handle('backup:list', ok(() => BackupService.list()));
  ipcMain.handle('backup:restore', ok(({ path }) => BackupService.restore(path)));
};
