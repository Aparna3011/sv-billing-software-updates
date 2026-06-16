const { getDb } = require('../db/database');

function customerLedger(customerId) {
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(customerId);
  const invoices = db.prepare('SELECT * FROM invoices WHERE customer_id = ? AND is_deleted = 0 ORDER BY invoice_date, id').all(customerId);
  const payments = db.prepare('SELECT * FROM incoming_payments WHERE customer_id = ? AND COALESCE(is_deleted, 0) = 0 ORDER BY payment_date, id').all(customerId);
  const entries = [
    ...invoices.map(row => ({ date: row.invoice_date, type: 'invoice', ref: row.invoice_no, debit: row.grand_total, credit: 0 })),
    ...payments.map(row => ({ date: row.payment_date, type: 'payment', ref: row.payment_no, debit: 0, credit: row.amount }))
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let balance = Number(customer?.opening_balance || 0);
  return entries.map(entry => {
    balance += Number(entry.debit || 0) - Number(entry.credit || 0);
    return { ...entry, balance };
  });
}

function vendorLedger(vendorId) {
  const db = getDb();
  const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendorId);
  const purchases = db.prepare('SELECT * FROM purchases WHERE vendor_id = ? AND is_deleted = 0 ORDER BY bill_date, id').all(vendorId);
  const payments = db.prepare(`
    SELECT op.* 
    FROM outgoing_payments op
    LEFT JOIN expenses e ON e.id = op.expense_id
    LEFT JOIN purchases p ON p.id = op.purchase_id
    WHERE COALESCE(op.vendor_id, e.vendor_id, p.vendor_id) = ? AND COALESCE(op.is_deleted, 0) = 0 
    ORDER BY op.payment_date, op.id
  `).all(vendorId);
  const entries = [
    ...purchases.map(row => ({ date: row.bill_date, type: 'purchase', ref: row.bill_no, debit: 0, credit: row.grand_total })),
    ...payments.map(row => ({ date: row.payment_date, type: 'payment', ref: row.payment_no, debit: row.amount, credit: 0 }))
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  let balance = Number(vendor?.opening_balance || 0);
  return entries.map(entry => {
    balance += Number(entry.credit || 0) - Number(entry.debit || 0);
    return { ...entry, balance };
  });
}

module.exports = { customerLedger, vendorLedger };
