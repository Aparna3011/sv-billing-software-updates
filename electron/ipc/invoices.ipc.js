const { ok } = require('./helpers');
const invoices = require('../services/invoice.service');

module.exports = ipcMain => {
  ipcMain.handle('invoices:list', ok(() => invoices.listInvoices()));
  ipcMain.handle('invoices:get', ok(({ id }) => invoices.getInvoice(id)));
  ipcMain.handle('invoices:create', ok(payload => invoices.createInvoice(payload)));
  ipcMain.handle('invoices:update', ok(payload => invoices.updateInvoice(payload)));
  ipcMain.handle('invoices:cancel', ok(({ id, role }) => invoices.cancelInvoice(id, role)));
  ipcMain.handle('invoices:listByCustomer', ok(({ customerId }) => invoices.listInvoicesByCustomer(customerId)));
  ipcMain.handle('invoices:delete', ok(({ id }) => {
    const { getDb } = require('../db/database');
    const db = getDb();

    return db.transaction(() => {
      const invoice = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
      if (!invoice) throw new Error('Invoice not found');

      db.prepare(`
        UPDATE quotations
        SET converted_invoice_id = NULL,
            status = CASE WHEN status = 'converted' THEN 'approved' ELSE status END
        WHERE converted_invoice_id = ?
      `).run(id);

      const result = db.prepare('UPDATE invoices SET is_deleted = 1 WHERE id = ?').run(id);
      if (result.changes === 0) throw new Error('Invoice was not deleted');

      return result;
    })();
  }));
};
