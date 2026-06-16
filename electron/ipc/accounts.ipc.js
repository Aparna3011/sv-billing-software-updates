const accountingService = require('../services/accounting.service');
const { ok } = require('./helpers');

module.exports = (ipcMain) => {
  ipcMain.handle('accounts:dashboard', ok(() => accountingService.accountsDashboard()));
  ipcMain.handle('accounts:getPartyStatement', ok((payload) => {
    return accountingService.getPartyStatement(payload);
  }));
  ipcMain.handle('accounts:incomeLedger', ok(() => accountingService.incomeLedger()));
};