const { ok } = require('./helpers');
const accounting = require('../services/accounting.service');

module.exports = (ipcMain) => {
  ipcMain.handle('incomeCategories:list', ok(() => accounting.incomeCategories()));

  ipcMain.handle('incomeCategories:create', ok((payload) => accounting.createIncomeCategory(payload)));

  ipcMain.handle('incomeCategories:update', ok((payload) => accounting.updateIncomeCategory(payload.id, payload)));

  ipcMain.handle('incomeCategories:delete', ok((payload) => accounting.deleteIncomeCategory(payload.id)));
};