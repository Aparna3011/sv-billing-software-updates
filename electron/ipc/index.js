const registerAuth = require('./auth.ipc');
const registerCompany = require('./company.ipc');
const registerCustomers = require('./customers.ipc');
const registerServices = require('./services.ipc');
const registerGst = require('./gst.ipc');
const registerQuotations = require('./quotations.ipc');
const registerInvoices = require('./invoices.ipc');
const registerPayments = require('./payments.ipc');
const registerOutgoingPayments = require('./outgoingPayments.ipc');
const registerRecurring = require('./recurring.ipc');
const registerExpenses = require('./expenses.ipc');
const registerPurchases = require('./purchases.ipc');
const registerVendors = require('./vendors.ipc');
const registerExpenseCategories = require('./expenseCategories.ipc');
const registerIncomeCategories = require('./incomeCategories.ipc');
const registerBanking = require('./banking.ipc');
const registerReports = require('./reports.ipc');
const registerAccounts = require('./accounts.ipc'); // Add this line
const registerDashboard = require('./dashboard.ipc');
const registerSettings = require('./settings.ipc');
const registerUsers = require('./users.ipc');
const registerBackup = require('./backup.ipc');
const registerPdf = require('./pdf.ipc');
const registerActivityLog = require('./activitylog.ipc');
const registerNumbering = require('./numbering.ipc');

function registerIpcHandlers(ipcMain, getWindow, shell) {
  ipcMain.handle('window:minimize', () => getWindow()?.minimize());
  ipcMain.handle('window:maximize', () => {
    const win = getWindow();
    if (win?.isMaximized()) win.unmaximize();
    else win?.maximize();
  });
  ipcMain.handle('window:close', () => getWindow()?.close());
  [
    registerAuth, registerCompany, registerCustomers, registerServices, registerGst,
    registerQuotations, registerInvoices, registerPayments, registerOutgoingPayments, registerRecurring, registerAccounts, // Add registerAccounts here
    registerExpenses, registerPurchases, registerReports, registerDashboard,
    registerVendors, registerExpenseCategories, registerIncomeCategories, registerBanking, registerSettings, registerUsers, registerBackup, registerPdf,
    registerActivityLog, registerNumbering
  ].forEach(register => {
    try {
      register(ipcMain, getWindow, shell);
    } catch (err) {
      console.error(`Failed to register module: ${register.name || 'unknown'}`);
      console.error(err);
    }
  });
}

module.exports = { registerIpcHandlers };
