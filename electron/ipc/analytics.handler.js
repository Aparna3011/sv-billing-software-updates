const { ipcMain } = require('electron');
const analyticsService = require('../services/analytics.service');
const { ok } = require('./helpers');

module.exports = () => {
  ipcMain.handle('analytics:overview', ok(() => analyticsService.getOverview()));
  ipcMain.handle('analytics:revenue', ok((payload) => analyticsService.getRevenueAnalytics(payload)));
  ipcMain.handle('analytics:customers', ok((payload) => analyticsService.getCustomerAnalytics(payload)));
  ipcMain.handle('analytics:recurring', ok((payload) => analyticsService.getRecurringAnalytics(payload)));
  ipcMain.handle('analytics:finance', ok((payload) => analyticsService.getFinanceAnalytics(payload)));
};