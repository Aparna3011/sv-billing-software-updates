const { ok } = require("./helpers");
const accounting = require("../services/accounting.service");
const banking = require("../services/banking.service");

module.exports = (ipcMain) => {
  ipcMain.handle("bankAccounts:list", ok(() => accounting.bankAccounts()));
  ipcMain.handle("bankAccounts:get", ok(({ id }) => accounting.getBankAccount(id)));
  ipcMain.handle("bankAccounts:create", ok((payload) => accounting.createBankAccount(payload)));
  ipcMain.handle("bankAccounts:update", ok(({ id, ...payload }) => accounting.updateBankAccount(id, payload)));
  ipcMain.handle("bankAccounts:delete", ok(({ id }) => accounting.deleteBankAccount(id)));
  ipcMain.handle("bankTransactions:get", ok(({ id }) => accounting.getBankTransaction(id)));
  ipcMain.handle("bankTransactions:update", ok(({ id, ...payload }) => accounting.updateBankTransaction(id, payload)));
  ipcMain.handle("bankTransactions:delete", ok(({ id }) => accounting.softDeleteBankTransaction(id)));
  ipcMain.handle("bankTransactions:restore", ok(({ id }) => accounting.restoreBankTransaction(id)));
  ipcMain.handle("bankTransactions:list", ok((payload = {}) => accounting.bankLedger(payload)));
  ipcMain.handle("bankTransactions:dashboard", ok((payload = {}) => accounting.bankingDashboard(payload)));
  ipcMain.handle(
    "bankTransactions:manualAdjustment",
    ok((payload) => accounting.manualAdjustment(payload)),
  );
  ipcMain.handle("bankAccounts:ensureDefaultCash", ok(() => accounting.ensureDefaultCashAccount()));
  ipcMain.handle("bankTransactions:transfer", ok((payload) => accounting.recordTransfer(payload)));
  ipcMain.handle("bankTransactions:ledger", ok((payload) => accounting.getDetailedLedger(payload)));
  ipcMain.handle("banking:recordEntry", ok((payload) => banking.recordBankingEntry(payload)));
};
