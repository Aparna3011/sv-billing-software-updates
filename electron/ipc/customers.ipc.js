const { getDb } = require('../db/database');
const { ok, insert, update } = require('./helpers');
const activity = require('../services/activitylog.service');
const ledger = require('../services/ledger.service');
const allowed = ['company_name', 'contact_person', 'email', 'phone', 'gstin', 'gst_treatment','country', 'state','city', 'address', 'payment_terms', 'opening_balance'];

module.exports = ipcMain => {
  ipcMain.handle('customers:list', ok(() => getDb().prepare('SELECT * FROM customers WHERE is_deleted = 0 ORDER BY company_name').all()));
  ipcMain.handle('customers:get', ok(({ id }) => getDb().prepare('SELECT * FROM customers WHERE id = ?').get(id)));
  ipcMain.handle('customers:create', ok(data => {
    const row = insert('customers', data, allowed);
    activity.log('customer:created', { entityType: 'customer', entityId: row.id, message: row.company_name });
    return row;
  }));
  ipcMain.handle('customers:update', ok(({ id, ...data }) => {
    const row = update('customers', id, data, allowed);
    activity.log('customer:updated', { entityType: 'customer', entityId: id, message: row.company_name });
    return row;
  }));
  ipcMain.handle('customers:delete', ok(({ id }) => getDb().prepare('UPDATE customers SET is_deleted = 1 WHERE id = ?').run(id)));
  ipcMain.handle('customers:ledger', ok(({ id }) => ({
    entries: ledger.customerLedger(id),
    invoices: getDb().prepare('SELECT * FROM invoices WHERE customer_id = ? AND is_deleted = 0 ORDER BY invoice_date DESC').all(id),
    incoming_payments: getDb().prepare('SELECT * FROM incoming_payments WHERE customer_id = ? AND COALESCE(is_deleted, 0) = 0 ORDER BY payment_date DESC').all(id)
  })));
};
