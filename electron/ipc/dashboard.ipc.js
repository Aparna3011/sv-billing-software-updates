const { ok } = require('./helpers');
const dashboard = require('../services/dashboard.service');

module.exports = ipcMain => {
  ipcMain.handle('dashboard:metrics', ok(() => dashboard.metrics()));
};
