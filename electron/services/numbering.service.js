const { getDb } = require('../db/database');

function fiscalYearToken(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const start = month >= 4 ? year : year - 1;
  return `${String(start).slice(2)}${String(start + 1).slice(2)}`;
}

function nextNumber(type, table, column, date = new Date()) {
  const fy = fiscalYearToken(date);
  const prefix = `${type}-${fy}-`;
  const row = getDb().prepare(`SELECT ${column} AS no FROM ${table} WHERE ${column} LIKE ? ORDER BY id DESC LIMIT 1`).get(`${prefix}%`);
  const current = row ? Number(String(row.no).split('-').pop()) : 0;
  return `${prefix}${String(current + 1).padStart(4, '0')}`;
}

module.exports = {
  fiscalYearToken,
  nextInvoiceNo: date => nextNumber('INV', 'invoices', 'invoice_no', date),
  nextQuotationNo: date => {
    const fyToken = fiscalYearToken(date);
    const fyFormatted = `${fyToken.slice(0, 2)}-${fyToken.slice(2)}`;
    const prefix = `SV/QU/${fyFormatted}/`;
    const row = getDb()
      .prepare(`SELECT quotation_no AS no FROM quotations WHERE quotation_no LIKE ? ORDER BY id DESC LIMIT 1`)
      .get(`${prefix}%`);
    const current = row ? Number(String(row.no).split('/').pop()) : 0;
    return `${prefix}${String(current + 1).padStart(4, '0')}`;
  },
  nextPaymentNo: date => nextNumber('PAY', 'incoming_payments', 'payment_no', date),
  nextPurchasePaymentNo: date => nextNumber('PPAY', 'outgoing_payments', 'payment_no', date),
  nextExpenseNo: date => nextNumber('EXP', 'expenses', 'expense_no', date),
  nextBillNo: date => nextNumber('BILL', 'purchases', 'bill_no', date),
  nextRecurringInvoiceNo: date =>
  nextNumber(
    'REC',
    'recurring_invoices',
    'recurring_invoice_no',
    date
  )
};
