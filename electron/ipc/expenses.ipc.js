const { ok } = require("./helpers");
const expenses = require("../services/expense.service");

module.exports = (ipcMain) => {
  ipcMain.handle(
    "expenses:list",
    ok(() => expenses.listExpenses()),
  );

  ipcMain.handle(
    "expenses:dashboard",
    ok(() => expenses.expenseDashboard()),
  );

  ipcMain.handle(
    "expenses:get",
    ok(({ id }) => expenses.getExpense(id)),
  );

  ipcMain.handle(
    "expenses:create",
    ok((payload) => expenses.createExpense(payload)),
  );

  ipcMain.handle(
    "expenses:update",
    ok((payload) => expenses.updateExpense(payload)),
  );

  ipcMain.handle(
    "expenses:recordPayment",
    ok((payload) => expenses.recordExpensePayment(payload)),
  );

  ipcMain.handle(
    "expenses:delete",
    ok(({ id }) => expenses.deleteExpense(id)),
  );
};