const { getDb } = require('../db/database');
const { ok, insert, update } = require('./helpers');
const activity = require('../services/activitylog.service');
const ledger = require('../services/ledger.service');
const allowed = ['company_name', 'contact_person', 'email', 'phone', 'gstin', 'gst_treatment','country', 'state','city', 'address', 'payment_terms', 'opening_balance', 'is_customer', 'is_vendor', 'is_active', 'is_deleted', 'notes'];

module.exports = ipcMain => {
  ipcMain.handle('customers:list', ok(() => getDb().prepare('SELECT * FROM contacts WHERE is_customer = 1 AND is_deleted = 0 ORDER BY company_name').all()));
  ipcMain.handle('customers:get', ok(({ id }) => getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(id)));
  ipcMain.handle('customers:create', ok(data => {
    const db = getDb();
    const name = String(data.company_name || "").trim();
    const existing = db.prepare('SELECT id FROM contacts WHERE TRIM(LOWER(company_name)) = LOWER(?)').get(name);

    if (existing) {
      const row = update('contacts', existing.id, { ...data, is_customer: 1 }, allowed);
      activity.log('customer:updated', { entityType: 'customer', entityId: row.id, message: row.company_name + " (Added customer role)" });
      return row;
    }

    const row = insert('contacts', { ...data, is_customer: 1, is_vendor: 0 }, allowed);
    activity.log('customer:created', { entityType: 'customer', entityId: row.id, message: row.company_name });
    return row;
  }));
  ipcMain.handle('customers:update', ok(({ id, ...data }) => {
    const row = update('contacts', id, data, allowed);
    activity.log('customer:updated', { entityType: 'customer', entityId: id, message: row.company_name });
    return row;
  }));
  ipcMain.handle('customers:delete', ok(({ id }) => getDb().prepare('UPDATE contacts SET is_deleted = 1 WHERE id = ?').run(id)));
  ipcMain.handle('customers:ledger', ok(({ id }) => ({
    entries: ledger.customerLedger(id),
    invoices: getDb().prepare('SELECT * FROM invoices WHERE contact_id = ? AND is_deleted = 0 ORDER BY invoice_date DESC').all(id),
    incoming_payments: getDb().prepare('SELECT * FROM incoming_payments WHERE contact_id = ? AND COALESCE(is_deleted, 0) = 0 ORDER BY payment_date DESC').all(id)
  })));
};
