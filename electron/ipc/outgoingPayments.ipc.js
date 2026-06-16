const { getDb } = require('../db/database');
const { ok, update } = require('./helpers');

module.exports = (ipcMain) => {
  ipcMain.handle('outgoingPayments:list', ok(() => {
    return getDb().prepare(`
      SELECT 
        op.*,
        CASE 
          WHEN op.purchase_id IS NOT NULL THEN 'PURCHASE'
          WHEN op.expense_id IS NOT NULL THEN 'EXPENSE'
          ELSE 'MANUAL'
        END AS payment_type,
        v.company_name AS vendor_name,
        p.bill_no AS purchase_bill_no,
        e.expense_no AS expense_no,
        ec.name AS category_name,
        ba.account_name AS bank_account_name
      FROM outgoing_payments op
      LEFT JOIN vendors v ON v.id = op.vendor_id
      LEFT JOIN purchases p ON p.id = op.purchase_id
      LEFT JOIN expenses e ON e.id = op.expense_id
      LEFT JOIN expense_categories ec ON ec.id = op.category_id
      LEFT JOIN bank_accounts ba ON ba.id = op.bank_account_id
      LEFT JOIN bank_transactions bt ON bt.id = op.bank_transaction_id
      WHERE COALESCE(op.is_deleted, 0) = 0
        AND (op.bank_transaction_id IS NULL OR COALESCE(bt.is_deleted, 0) = 0)
      ORDER BY op.payment_date DESC, op.id DESC
    `).all();
  }));

  ipcMain.handle('outgoingPayments:get', ok(({ id }) => {
    return getDb().prepare(`
      SELECT 
        op.*,
        v.company_name AS vendor_name,
        p.bill_no AS purchase_bill_no,
        e.expense_no AS expense_no,
        ec.name AS category_name,
        ba.account_name AS bank_account_name
      FROM outgoing_payments op
      LEFT JOIN vendors v ON v.id = op.vendor_id
      LEFT JOIN purchases p ON p.id = op.purchase_id
      LEFT JOIN expenses e ON e.id = op.expense_id
      LEFT JOIN expense_categories ec ON ec.id = op.category_id
      LEFT JOIN bank_accounts ba ON ba.id = op.bank_account_id
      WHERE op.id = ?
    `).get(id);
  }));

  ipcMain.handle('outgoingPayments:update', ok(({ id, ...data }) => {
    const allowed = ['payment_date', 'vendor_id', 'category_id', 'amount', 'mode', 'bank_account_id', 'reference_no', 'notes'];
    return update('outgoing_payments', id, data, allowed);
  }));

  ipcMain.handle('outgoingPayments:delete', ok(({ id }) => {
    return getDb().prepare('UPDATE outgoing_payments SET is_deleted = 1 WHERE id = ?').run(id);
  }));
};
