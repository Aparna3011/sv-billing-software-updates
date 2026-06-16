const { getDb } = require('../db/database');

function metrics() {
  const db = getDb();

  const latestHistorySub = `
    SELECT * FROM recurring_invoice_history 
    WHERE id IN (SELECT MAX(id) FROM recurring_invoice_history GROUP BY recurring_invoice_id)
  `;

  const recurringOverview = db.prepare(`
    SELECT 
      COUNT(CASE WHEN h.collection_status != 'completed' THEN 1 END) as activePlans,
      COUNT(CASE WHEN h.collection_status = 'overdue' THEN 1 END) as overduePlans,
      COUNT(CASE WHEN strftime('%Y-%m', h.next_invoice_date) = strftime('%Y-%m', 'now', 'localtime') AND h.collection_status != 'completed' THEN 1 END) as dueThisMonth,
      COALESCE(SUM(ri.grand_total), 0) as recurringRevenue
    FROM recurring_invoices ri
    LEFT JOIN (${latestHistorySub}) h ON ri.id = h.recurring_invoice_id
    WHERE ri.is_deleted = 0 AND ri.is_stopped = 0
  `).get();

  return {
    revenue: db.prepare("SELECT COALESCE(SUM(amount),0) total FROM incoming_payments").get().total,
    monthlyRevenue: db.prepare("SELECT COALESCE(SUM(amount),0) total FROM incoming_payments WHERE strftime('%Y-%m', payment_date) = strftime('%Y-%m', 'now')").get().total,
    outstanding: db.prepare("SELECT COALESCE(SUM(balance_due),0) total FROM invoices WHERE is_deleted = 0 AND status NOT IN ('paid','cancelled')").get().total,
    unpaidInvoices: db.prepare("SELECT COUNT(*) total FROM invoices WHERE is_deleted = 0 AND balance_due > 0 AND status != 'cancelled'").get().total,
    customers: db.prepare('SELECT COUNT(*) total FROM customers WHERE is_deleted = 0').get().total,
    activeRecurringClients: db.prepare(`
      SELECT COUNT(DISTINCT r.customer_id) total 
      FROM recurring r 
      JOIN recurring_invoices ri ON ri.recurring_id = r.id 
      JOIN (
        SELECT recurring_invoice_id, collection_status
        FROM recurring_invoice_history
        WHERE id IN (SELECT MAX(id) FROM recurring_invoice_history GROUP BY recurring_invoice_id)
      ) h ON h.recurring_invoice_id = ri.id
      WHERE r.is_deleted = 0 
        AND r.is_stopped = 0 
        AND ri.is_stopped = 0 
        AND h.collection_status != 'completed'
    `).get().total,
    invoices: db.prepare('SELECT COUNT(*) total FROM invoices WHERE is_deleted = 0').get().total,
    ...recurringOverview,
    recentInvoices: db.prepare(`
      SELECT i.id, i.invoice_no, i.invoice_date, i.grand_total, i.status, c.company_name
      FROM invoices i JOIN customers c ON c.id = i.customer_id
      WHERE i.is_deleted = 0 ORDER BY i.id DESC LIMIT 8
    `).all(),
    overdueRecurrings: db.prepare(`
      SELECT 
        ri.recurring_invoice_no,
        c.company_name,
        h.next_invoice_date,
        h.pending_amount,
        h.overdue_days,
        h.collection_status,
        r.id as recurring_id
      FROM recurring_invoices ri
      JOIN (${latestHistorySub}) h ON ri.id = h.recurring_invoice_id
      JOIN recurring r ON r.id = ri.recurring_id
      JOIN customers c ON c.id = r.customer_id
      WHERE ri.is_deleted = 0 AND ri.is_stopped = 0 AND h.collection_status = 'overdue'
      ORDER BY h.overdue_days DESC
      LIMIT 10
    `).all(),
    upcomingRenewals: db.prepare(`
      SELECT 
        ri.recurring_invoice_no,
        c.company_name,
        h.next_invoice_date AS renewal_date,
        ri.grand_total AS amount,
        ri.billing_cycle,
        ri.auto_generate,
        r.id as recurring_id
      FROM recurring_invoices ri 
      JOIN recurring r ON r.id = ri.recurring_id
      JOIN customers c ON c.id = r.customer_id
      JOIN (${latestHistorySub}) h ON h.recurring_invoice_id = ri.id
      WHERE ri.is_deleted = 0 AND ri.is_stopped = 0 AND h.collection_status != 'completed'
        AND h.next_invoice_date BETWEEN date('now', 'localtime') AND date('now', '+7 days', 'localtime')
      ORDER BY h.next_invoice_date ASC
    `).all()
  };
}

module.exports = { metrics };
