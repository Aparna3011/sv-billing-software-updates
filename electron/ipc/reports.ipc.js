const { ok } = require('./helpers');
const reports = require('../services/report.service');
const exports = require('../services/export.service');

module.exports = (ipcMain, _getWindow, shell) => {
  ipcMain.handle('reports:gst', ok(() => reports.gstReport()));
  ipcMain.handle('reports:outstanding', ok(() => reports.outstandingReport()));
  ipcMain.handle('reports:revenue', ok(() => reports.revenueReport()));
  ipcMain.handle('reports:serviceIncome', ok(() => reports.serviceIncomeReport()));
  ipcMain.handle('reports:customerLedger', ok((payload) => reports.customerLedger(payload)));
  ipcMain.handle('reports:vendorLedger', ok((payload) => reports.vendorLedger(payload)));
  ipcMain.handle('reports:cashFlow', ok((payload) => reports.cashFlowReport(payload)));
  ipcMain.handle('reports:gstSummary', ok((payload) => reports.gstSummaryReport(payload)));
  ipcMain.handle('reports:exportPdf', ok((payload) => exports.exportTablePdf(payload, shell)));
  ipcMain.handle('reports:exportExcel', ok((payload) => exports.exportTableExcel(payload, shell)));
};
