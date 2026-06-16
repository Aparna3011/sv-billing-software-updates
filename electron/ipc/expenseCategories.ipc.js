const { ok } = require("./helpers");
const accounting = require("../services/accounting.service");

module.exports = (ipcMain) => {
  ipcMain.handle("expenseCategories:list", ok(() => accounting.expenseCategories()));

  ipcMain.handle("expenseCategories:create", ok((payload) => accounting.createExpenseCategory(payload)));

  ipcMain.handle("expenseCategories:update", ok((payload) => accounting.updateExpenseCategory(payload.id, payload)));

  ipcMain.handle("expenseCategories:delete", ok((payload) => accounting.deleteExpenseCategory(payload.id)));

  ipcMain.handle("expenseCategories:ensureDefaults", ok(() => accounting.ensureDefaultExpenseCategories()));
};
