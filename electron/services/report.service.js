const { getDb } = require("../db/database");

function betweenClause(column, filters = {}, params = []) {
  const clauses = [];
  if (filters.from_date) {
    clauses.push(`${column} >= ?`);
    params.push(filters.from_date);
  }
  if (filters.to_date) {
    clauses.push(`${column} <= ?`);
    params.push(filters.to_date);
  }
  return clauses.length ? ` AND ${clauses.join(" AND ")}` : "";
}

function sortEntries(a, b) {
  const dateOrder = String(a.date || "").localeCompare(String(b.date || ""));
  if (dateOrder !== 0) return dateOrder;
  return Number(a.sort_id || 0) - Number(b.sort_id || 0);
}

function customerLedger(filters = {}) {
  const db = getDb();
  const customerId = filters.customer_id ? Number(filters.customer_id) : null;
  const customer = customerId
    ? db.prepare("SELECT * FROM customers WHERE id = ? AND is_deleted = 0").get(customerId)
    : null;

  if (!customerId) {
    return { customer: null, openingBalance: 0, entries: [], closingBalance: 0 };
  }

  const openingInvoices = filters.from_date
    ? db
        .prepare(
          `
          SELECT COALESCE(SUM(grand_total), 0) total
          FROM invoices
          WHERE customer_id = ? AND is_deleted = 0 AND status != 'cancelled' AND invoice_date < ?
        `,
        )
        .get(customerId, filters.from_date).total
    : 0;
  const openingPayments = filters.from_date
    ? db
        .prepare(
          `
          SELECT COALESCE(SUM(amount), 0) total
          FROM incoming_payments
          WHERE customer_id = ?
            AND COALESCE(is_deleted, 0) = 0
            AND payment_date < ?
        `,
        )
        .get(customerId, filters.from_date).total
    : 0;

  const invoiceParams = [customerId];
  const paymentParams = [customerId];
  const invoiceDateFilter = betweenClause("invoice_date", filters, invoiceParams);
  const paymentDateFilter = betweenClause("payment_date", filters, paymentParams);

  const invoices = db
    .prepare(
      `
      SELECT id AS sort_id, invoice_date AS date, invoice_no AS reference_no,
             'Invoice' AS type, grand_total AS debit, 0 AS credit
      FROM invoices
      WHERE customer_id = ? AND is_deleted = 0 AND status != 'cancelled' ${invoiceDateFilter}
    `,
    )
    .all(...invoiceParams);

  const payments = db
    .prepare(
      `
      SELECT id AS sort_id, payment_date AS date, payment_no AS reference_no,
             'Payment' AS type, 0 AS debit, amount AS credit
      FROM incoming_payments
      WHERE customer_id = ?
        AND COALESCE(is_deleted, 0) = 0
        ${paymentDateFilter}
    `,
    )
    .all(...paymentParams);

  let balance =
    Number(customer?.opening_balance || 0) +
    Number(openingInvoices || 0) -
    Number(openingPayments || 0);
  const openingBalance = balance;
  const entries = [...invoices, ...payments].sort(sortEntries).map((entry) => {
    balance += Number(entry.debit || 0) - Number(entry.credit || 0);
    return { ...entry, balance };
  });

  return { customer, openingBalance, entries, closingBalance: balance };
}

function vendorLedger(filters = {}) {
  const db = getDb();
  const vendorId = filters.vendor_id ? Number(filters.vendor_id) : null;
  const vendor = vendorId
    ? db.prepare("SELECT * FROM vendors WHERE id = ? AND is_deleted = 0").get(vendorId)
    : null;

  if (!vendorId) {
    return { vendor: null, openingBalance: 0, entries: [], closingBalance: 0 };
  }

  const openingPurchases = filters.from_date
    ? db
        .prepare(
          `
          SELECT COALESCE(SUM(grand_total), 0) total
          FROM purchases
          WHERE vendor_id = ? AND is_deleted = 0 AND bill_date < ?
        `,
        )
        .get(vendorId, filters.from_date).total
    : 0;
  const openingPayments = filters.from_date
    ? db
        .prepare(
          `
          SELECT COALESCE(SUM(amount), 0) total
          FROM outgoing_payments
          WHERE vendor_id = ?
            AND COALESCE(is_deleted, 0) = 0
            AND payment_date < ?
        `,
        )
        .get(vendorId, filters.from_date).total
    : 0;

  const purchaseParams = [vendorId];
  const paymentParams = [vendorId];
  const purchaseDateFilter = betweenClause("bill_date", filters, purchaseParams);
  const paymentDateFilter = betweenClause("op.payment_date", filters, paymentParams);

  const purchases = db
    .prepare(
      `
      SELECT id AS sort_id, bill_date AS date, bill_no AS reference_no,
             'Purchase Bill' AS type, 0 AS debit, grand_total AS credit
      FROM purchases
      WHERE vendor_id = ? AND is_deleted = 0 ${purchaseDateFilter}
    `,
    )
    .all(...purchaseParams);

  const payments = db
    .prepare(
      `
      SELECT op.id AS sort_id, op.payment_date AS date, op.payment_no AS reference_no,
             'Vendor Payment' AS type, op.amount AS debit, 0 AS credit
      FROM outgoing_payments op
      LEFT JOIN expenses e ON e.id = op.expense_id
      LEFT JOIN purchases p ON p.id = op.purchase_id
      WHERE COALESCE(op.vendor_id, e.vendor_id, p.vendor_id) = ?
        AND COALESCE(op.is_deleted, 0) = 0
        ${paymentDateFilter}
    `,
    )
    .all(...paymentParams);

  let balance =
    Number(vendor?.opening_balance || 0) +
    Number(openingPurchases || 0) -
    Number(openingPayments || 0);
  const openingBalance = balance;
  const entries = [...purchases, ...payments].sort(sortEntries).map((entry) => {
    balance += Number(entry.credit || 0) - Number(entry.debit || 0);
    return { ...entry, balance };
  });

  return { vendor, openingBalance, entries, closingBalance: balance };
}

function gstReport() {
  return getDb()
    .prepare(
      `
      SELECT invoice_no, invoice_date, company_name, taxable_value, cgst_total, sgst_total, igst_total, tax_total, grand_total
      FROM (
        SELECT i.*, c.company_name, (i.subtotal - i.discount) taxable_value
        FROM invoices i JOIN customers c ON c.id = i.customer_id
        WHERE i.is_deleted = 0 AND i.status != 'cancelled'
      ) ORDER BY invoice_date DESC
    `,
    )
    .all();
}

function outstandingReport() {
  return getDb()
    .prepare(
      `
      SELECT i.invoice_no, i.invoice_date, i.due_date, c.company_name, i.grand_total, i.paid_amount, i.balance_due, i.status
      FROM invoices i JOIN customers c ON c.id = i.customer_id
      WHERE i.is_deleted = 0 AND i.balance_due > 0 ORDER BY i.due_date
    `,
    )
    .all();
}

function revenueReport() {
  return getDb()
    .prepare(
      `
      SELECT strftime('%Y-%m', invoice_date) month, COUNT(*) invoices, SUM(grand_total) revenue, SUM(tax_total) gst
      FROM invoices WHERE is_deleted = 0 AND status != 'cancelled'
      GROUP BY month ORDER BY month DESC
    `,
    )
    .all();
}

function serviceIncomeReport() {
  return getDb()
    .prepare(
      `
      SELECT ii.name service_name, COUNT(*) lines, SUM(ii.line_total) income, SUM(ii.cgst + ii.sgst + ii.igst) gst
      FROM invoice_items ii
      JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.is_deleted = 0 AND i.status != 'cancelled'
      GROUP BY ii.name ORDER BY income DESC
    `,
    )
    .all();
}

function cashFlowReport(filters = {}) {
  const db = getDb();
  const paymentParams = [];
  const expenseParams = [];
  const purchasePaymentParams = [];
  const bankParams = [];
  const paymentDateFilter = betweenClause("payment_date", filters, paymentParams);
  const expenseDateFilter = betweenClause("expense_date", filters, expenseParams);
  const purchasePaymentDateFilter = betweenClause("payment_date", filters, purchasePaymentParams);
  const bankDateFilter = betweenClause("transaction_date", filters, bankParams);

  const customerPayments = db
    .prepare(
      `
      SELECT payment_date AS date, payment_no AS reference_no, 'Customer Payment' AS source,
             amount AS inflow, 0 AS outflow
      FROM incoming_payments
      WHERE COALESCE(is_deleted, 0) = 0 ${paymentDateFilter}
    `,
    )
    .all(...paymentParams);
  const expenses = db
    .prepare(
      `
      SELECT expense_date AS date, expense_no AS reference_no, 'Expense' AS source,
             0 AS inflow, total_amount AS outflow
      FROM expenses
      WHERE is_deleted = 0 ${expenseDateFilter}
    `,
    )
    .all(...expenseParams);
  const purchasePayments = db
    .prepare(
      `
      SELECT payment_date AS date, payment_no AS reference_no, 'Purchase Payment' AS source,
             0 AS inflow, amount AS outflow
      FROM outgoing_payments
      WHERE COALESCE(is_deleted, 0) = 0 ${purchasePaymentDateFilter}
    `,
    )
    .all(...purchasePaymentParams);
  const manualBank = db
    .prepare(
      `
      SELECT transaction_date AS date, reference_no, 'Manual Adjustment' AS source,
             CASE WHEN type = 'credit' THEN amount ELSE 0 END AS inflow,
             CASE WHEN type = 'debit' THEN amount ELSE 0 END AS outflow
      FROM bank_transactions
      WHERE source_type = 'manual_adjustment' ${bankDateFilter}
    `,
    )
    .all(...bankParams);

  const entries = [...customerPayments, ...expenses, ...purchasePayments, ...manualBank].sort(sortEntries);
  const cashInflow = entries.reduce((sum, row) => sum + Number(row.inflow || 0), 0);
  const cashOutflow = entries.reduce((sum, row) => sum + Number(row.outflow || 0), 0);

  return { cashInflow, cashOutflow, netCashFlow: cashInflow - cashOutflow, entries };
}

function gstSummaryReport(filters = {}) {
  const db = getDb();
  const invoiceParams = [];
  const purchaseParams = [];
  const expenseParams = [];
  const invoiceDateFilter = betweenClause("invoice_date", filters, invoiceParams);
  const purchaseDateFilter = betweenClause("bill_date", filters, purchaseParams);
  const expenseDateFilter = betweenClause("expense_date", filters, expenseParams);

  const outputGst = db
    .prepare(
      `
      SELECT COALESCE(SUM(tax_total), 0) total
      FROM invoices
      WHERE is_deleted = 0 AND status != 'cancelled' ${invoiceDateFilter}
    `,
    )
    .get(...invoiceParams).total;
  const purchaseGst = db
    .prepare(
      `
      SELECT COALESCE(SUM(tax_total), 0) total
      FROM purchases
      WHERE is_deleted = 0 ${purchaseDateFilter}
    `,
    )
    .get(...purchaseParams).total;
  const expenseGst = db
    .prepare(
      `
      SELECT COALESCE(SUM(gst_amount), 0) total
      FROM expenses
      WHERE is_deleted = 0 ${expenseDateFilter}
    `,
    )
    .get(...expenseParams).total;

  const rows = [
    { type: "Output GST", source: "Invoices", amount: Number(outputGst || 0) },
    { type: "Input GST", source: "Purchases", amount: Number(purchaseGst || 0) },
    { type: "Input GST", source: "Expenses", amount: Number(expenseGst || 0) },
  ];
  const inputGst = Number(purchaseGst || 0) + Number(expenseGst || 0);
  return {
    outputGst: Number(outputGst || 0),
    inputGst,
    gstLiability: Number(outputGst || 0) - inputGst,
    rows,
  };
}

module.exports = {
  cashFlowReport,
  customerLedger,
  gstReport,
  gstSummaryReport,
  outstandingReport,
  revenueReport,
  serviceIncomeReport,
  vendorLedger,
};
