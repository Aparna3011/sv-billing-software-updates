const { getDb } = require("../db/database");

const RECURRING_LATEST_QUERY = `
  SELECT h1.*
  FROM recurring_invoice_history h1
  INNER JOIN (
    SELECT recurring_invoice_id, MAX(id) AS id
    FROM recurring_invoice_history
    GROUP BY recurring_invoice_id
  ) h2
  ON h1.id = h2.id
`;

function getOverview() {
  console.log("Analytics getOverview called");
  const db = getDb();

  // KPI Row 1
  const totalRevenue = db
    .prepare(
      "SELECT COALESCE(SUM(grand_total), 0) total FROM invoices WHERE is_deleted = 0 AND status != 'cancelled'",
    )
    .get().total;
  const monthlyRevenue = db
    .prepare(
      "SELECT COALESCE(SUM(grand_total), 0) total FROM invoices WHERE is_deleted = 0 AND status != 'cancelled' AND strftime('%Y-%m', invoice_date) = strftime('%Y-%m', 'now')",
    )
    .get().total;
  const pendingPayments = db
    .prepare(
      "SELECT COALESCE(SUM(balance_due), 0) total FROM invoices WHERE is_deleted = 0 AND status NOT IN ('paid', 'cancelled')",
    )
    .get().total;
  const activeCustomers = db
    .prepare(
      "SELECT COUNT(DISTINCT customer_id) total FROM invoices WHERE is_deleted = 0 AND status = 'paid'",
    )
    .get().total;

  // KPI Row 2
  const activeRecurring = db
    .prepare(
      "SELECT COUNT(*) total FROM recurring_invoices WHERE is_deleted = 0 AND is_stopped = 0",
    )
    .get().total;
  const overdueRecurring = db
    .prepare(
      `SELECT COUNT(*) total FROM recurring_invoices ri JOIN (
  ${RECURRING_LATEST_QUERY}
) h ON h.recurring_invoice_id = ri.id WHERE ri.is_deleted = 0 AND h.collection_status = 'overdue'`,
    )
    .get().total;
  const bankBalance = db
    .prepare(
      "SELECT COALESCE(SUM(current_balance), 0) total FROM bank_accounts WHERE is_active = 1",
    )
    .get().total;

  const outputGst = db
    .prepare(
      "SELECT COALESCE(SUM(tax_total), 0) total FROM invoices WHERE is_deleted = 0 AND status != 'cancelled'",
    )
    .get().total;
  const inputGst = db
    .prepare(
      "SELECT (SELECT COALESCE(SUM(gst_amount), 0) FROM expenses WHERE is_deleted = 0) + (SELECT COALESCE(SUM(tax_total), 0) FROM purchases WHERE is_deleted = 0) AS total",
    )
    .get().total;

  // Trends
  const monthlyRevenueTrend = db
    .prepare(
      `
    SELECT strftime('%m', invoice_date) as month, SUM(grand_total) as invoiced, 
    (SELECT SUM(amount) FROM incoming_payments WHERE strftime('%m', payment_date) = strftime('%m', i.invoice_date)) as collected
    FROM invoices i WHERE is_deleted = 0 AND invoice_date >= date('now', '-12 months')
    GROUP BY month ORDER BY month ASC
  `,
    )
    .all();

  const cashFlowTrend = db
    .prepare(
      `
    SELECT month, SUM(inflow) as inflow, SUM(outflow) as outflow FROM (
      SELECT strftime('%Y-%m', payment_date) as month, amount as inflow, 0 as outflow FROM incoming_payments
      UNION ALL
      SELECT strftime('%Y-%m', expense_date) as month, 0 as inflow, total_amount as outflow FROM expenses WHERE is_deleted = 0
      UNION ALL
      SELECT strftime('%Y-%m', bill_date) as month, 0 as inflow, grand_total as outflow FROM purchases WHERE is_deleted = 0
    ) GROUP BY month ORDER BY month DESC LIMIT 6
  `,
    )
    .all()
    .reverse();

  // Health Indicators
  const lastMonthRev =
    db
      .prepare(
        "SELECT SUM(grand_total) total FROM invoices WHERE is_deleted = 0 AND strftime('%Y-%m', invoice_date) = strftime('%Y-%m', 'now', '-1 month')",
      )
      .get().total || 1;
  const growth = ((monthlyRevenue - lastMonthRev) / lastMonthRev) * 100;
  const efficiency =
    totalRevenue > 0
      ? ((totalRevenue - pendingPayments) / totalRevenue) * 100
      : 0;

  return {
    kpis: {
      totalRevenue,
      monthlyRevenue,
      pendingPayments,
      activeCustomers,
      activeRecurring,
      overdueRecurring,
      bankBalance,
      gstLiability: outputGst - inputGst,
      totalExpenses: db
        .prepare(
          "SELECT SUM(total_amount) total FROM expenses WHERE is_deleted = 0",
        )
        .get().total,
      totalPurchases: db
        .prepare(
          "SELECT SUM(grand_total) total FROM purchases WHERE is_deleted = 0",
        )
        .get().total,
      unpaidInvoicesCount: db
        .prepare(
          "SELECT COUNT(*) FROM invoices WHERE balance_due > 0 AND is_deleted = 0",
        )
        .get()["COUNT(*)"],
      upcomingRenewals: db
        .prepare(
          `SELECT COUNT(*) FROM recurring_invoices ri JOIN (
  SELECT h1.*
  FROM recurring_invoice_history h1
  INNER JOIN (
    SELECT recurring_invoice_id,
           MAX(id) id
    FROM recurring_invoice_history
    GROUP BY recurring_invoice_id
  ) h2
  ON h1.id = h2.id
) h
ON h.recurring_invoice_id = ri.id
WHERE ri.is_deleted = 0
AND h.next_invoice_date BETWEEN date('now') AND date('now', '+30 days')`,
        )
        .get()["COUNT(*)"],
    },
    monthlyRevenueTrend,
    cashFlowTrend,
    businessHealth: {
      revenueGrowth: growth,
      collectionEfficiency: efficiency,
      gstCompliance: outputGst > 0,
      recurringHealth:
        activeRecurring > 0 ? (overdueRecurring / activeRecurring) * 100 : 0,
      cashFlowStatus: bankBalance > 0,
    },
    recentActivity: {
      invoices: db
        .prepare(
          "SELECT i.invoice_no, c.company_name as customer, i.grand_total as amount, i.status FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.is_deleted = 0 ORDER BY i.id DESC LIMIT 5",
        )
        .all(),
      incoming_payments: db
        .prepare(
          "SELECT p.payment_no, c.company_name as customer, p.amount, p.payment_date as date FROM incoming_payments p JOIN customers c ON c.id = p.customer_id ORDER BY p.id DESC LIMIT 5",
        )
        .all(),
      recurring: db
        .prepare(
          `
    SELECT
      ri.recurring_invoice_no,
      c.company_name as customer,
      h.collection_status as status,
      ri.grand_total as amount
    FROM recurring_invoices ri
    JOIN recurring r
      ON r.id = ri.recurring_id
    JOIN customers c
      ON c.id = r.customer_id
    JOIN (
      ${RECURRING_LATEST_QUERY}
    ) h
      ON h.recurring_invoice_id = ri.id
    WHERE ri.is_deleted = 0
    ORDER BY h.id DESC
    LIMIT 5
  `,
        )
        .all(),
      expenses: db
        .prepare(
          "SELECT expense_no, category, total_amount as amount, expense_date as date FROM expenses WHERE is_deleted = 0 ORDER BY id DESC LIMIT 5",
        )
        .all(),
    },
  };
}

function getRevenueAnalytics(filters) {
  const db = getDb();
  const kpis = db
    .prepare(
      `
    SELECT 
      SUM(grand_total) as totalRevenue,
      AVG(grand_total) as avgInvoice,
      MAX(grand_total) as maxInvoice
    FROM invoices WHERE is_deleted = 0 AND status != 'cancelled'
  `,
    )
    .get();

  return {
    kpis,
    monthlyTrend: db
      .prepare(
        "SELECT strftime('%Y-%m', invoice_date) as month, SUM(grand_total) as revenue FROM invoices WHERE is_deleted = 0 GROUP BY month ORDER BY month ASC LIMIT 12",
      )
      .all(),
    byService: db
      .prepare(
        "SELECT ii.name as service, SUM(ii.line_total) as revenue FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE i.is_deleted = 0 GROUP BY service ORDER BY revenue DESC LIMIT 10",
      )
      .all(),
    statusDistribution: db
      .prepare(
        "SELECT status as name, COUNT(*) as value FROM invoices WHERE is_deleted = 0 GROUP BY status",
      )
      .all(),
    topCustomers: db
      .prepare(
        `
      SELECT c.company_name as customer, COUNT(i.id) as invoices, SUM(i.grand_total) as revenue, SUM(i.paid_amount) as paid, SUM(i.balance_due) as outstanding 
      FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.is_deleted = 0 
      GROUP BY c.id ORDER BY revenue DESC LIMIT 10
    `,
      )
      .all(),
    topServices: db
      .prepare(
        `
      SELECT ii.name as service, COUNT(*) as count, SUM(ii.line_total) as revenue, AVG(ii.line_total) as avg
      FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
      WHERE i.is_deleted = 0 GROUP BY service ORDER BY revenue DESC LIMIT 10
    `,
      )
      .all(),
    byCustomer: db
      .prepare(
        `SELECT c.company_name as name, SUM(i.grand_total) as value FROM invoices i JOIN customers c ON c.id = i.customer_id WHERE i.is_deleted = 0 GROUP BY c.id ORDER BY value DESC LIMIT 8`,
      )
      .all(),
  };
}

function getCustomerAnalytics() {
  const db = getDb();
  return {
    kpis: {
      total: db
        .prepare("SELECT COUNT(*) FROM customers WHERE is_deleted = 0")
        .get()["COUNT(*)"],
      active: db
        .prepare(
          "SELECT COUNT(DISTINCT customer_id) FROM invoices WHERE is_deleted = 0 AND invoice_date >= date('now', '-90 days')",
        )
        .get()["COUNT(DISTINCT customer_id)"],
      newThisMonth: db
        .prepare(
          "SELECT COUNT(*) FROM customers WHERE is_deleted = 0 AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now')",
        )
        .get()["COUNT(*)"],
    },
    growthTrend: db
      .prepare(
        "SELECT strftime('%Y-%m', created_at) as month, COUNT(*) as new_customers FROM customers WHERE is_deleted = 0 GROUP BY month ORDER BY month ASC LIMIT 12",
      )
      .all(),
    distribution: db
      .prepare(
        `
      SELECT CASE WHEN rev < 5000 THEN '< ₹5K' WHEN rev < 25000 THEN '₹5K-₹25K' WHEN rev < 100000 THEN '₹25K-₹1L' ELSE '> ₹1L' END as bucket, COUNT(*) as count
      FROM (SELECT SUM(grand_total) as rev FROM invoices WHERE is_deleted = 0 GROUP BY customer_id) GROUP BY bucket
    `,
      )
      .all(),
    topCustomers: db
      .prepare(
        `
      SELECT c.company_name as customer, SUM(i.grand_total) as revenue, SUM(i.paid_amount) as paid, SUM(i.balance_due) as pending, COUNT(i.id) as invoiceCount, MAX(i.invoice_date) as lastInvoice
      FROM customers c LEFT JOIN invoices i ON i.customer_id = c.id WHERE c.is_deleted = 0
      GROUP BY c.id ORDER BY revenue DESC LIMIT 10
    `,
      )
      .all(),
    paymentBehaviour: db
      .prepare(
        `
      SELECT c.company_name as customer, SUM(i.grand_total) as billed, SUM(i.paid_amount) as paid, SUM(i.balance_due) as pending
      FROM customers c JOIN invoices i ON i.customer_id = c.id WHERE i.is_deleted = 0
      GROUP BY c.id
    `,
      )
      .all()
      .map((row) => ({
        ...row,
        badge:
          row.pending / row.billed < 0.05
            ? "Excellent"
            : row.pending / row.billed < 0.2
              ? "Good"
              : "Average",
      })),
  };
}

function getRecurringAnalytics() {
  const db = getDb();
  return {
    kpis: {
      active: db
        .prepare(
          "SELECT COUNT(*) FROM recurring_invoices WHERE is_deleted = 0 AND is_stopped = 0",
        )
        .get()["COUNT(*)"],
      overdue: db
        .prepare(
          `SELECT COUNT(*) FROM recurring_invoices ri JOIN (
  ${RECURRING_LATEST_QUERY}
) h ON h.recurring_invoice_id = ri.id WHERE ri.is_deleted = 0 AND h.collection_status = 'overdue'`,
        )
        .get()["COUNT(*)"],
      dueThisMonth: db
        .prepare(
          `SELECT COUNT(*) FROM recurring_invoices ri JOIN (
  ${RECURRING_LATEST_QUERY}
) h ON h.recurring_invoice_id = ri.id WHERE ri.is_deleted = 0 AND strftime('%Y-%m', h.next_invoice_date) = strftime('%Y-%m', 'now')`,
        )
        .get()["COUNT(*)"],
      totalRevenue: db
        .prepare(
          "SELECT SUM(grand_total) FROM recurring_invoices WHERE is_deleted = 0",
        )
        .get()["SUM(grand_total)"],
      upcomingRenewals: db
        .prepare(
          `SELECT COUNT(*) FROM recurring_invoices ri JOIN (
  ${RECURRING_LATEST_QUERY}
) h ON h.recurring_invoice_id = ri.id WHERE ri.is_deleted = 0 AND h.next_invoice_date BETWEEN date('now') AND date('now', '+30 days')`,
        )
        .get()["COUNT(*)"],
    },
    revenueTrend: db
      .prepare(
        `SELECT strftime('%Y-%m', payment_date) as month, SUM(amount) as collected FROM incoming_payments WHERE invoice_id IN (SELECT id FROM invoices WHERE recurring_id IS NOT NULL) GROUP BY month ORDER BY month ASC LIMIT 12`,
      )
      .all(),
    cycleDistribution: db
      .prepare(
        "SELECT billing_cycle as name, COUNT(*) as value FROM recurring_invoices WHERE is_deleted = 0 AND is_stopped = 0 GROUP BY billing_cycle",
      )
      .all(),
    overdueList: db
      .prepare(
        `
      SELECT ri.recurring_invoice_no, c.company_name as customer, ri.recurring_invoice_no as plan_name, h.next_invoice_date as due_date, h.pending_amount, h.overdue_days
      FROM recurring_invoices ri
      JOIN recurring r ON r.id = ri.recurring_id
      JOIN customers c ON c.id = r.customer_id
      JOIN (
  ${RECURRING_LATEST_QUERY}
) h ON h.recurring_invoice_id = ri.id
      WHERE ri.is_deleted = 0 AND ri.is_stopped = 0 AND h.collection_status = 'overdue'
      ORDER BY h.overdue_days DESC
    `,
      )
      .all(),
    upcomingList: db
      .prepare(
        `
      SELECT ri.recurring_invoice_no, c.company_name as customer, h.next_invoice_date as renewal_date, ri.grand_total as amount, ri.billing_cycle, ri.auto_generate
      FROM recurring_invoices ri
      JOIN recurring r ON r.id = ri.recurring_id
      JOIN customers c ON c.id = r.customer_id
      JOIN (
  ${RECURRING_LATEST_QUERY}
) h ON h.recurring_invoice_id = ri.id
      WHERE ri.is_deleted = 0 AND ri.is_stopped = 0 AND h.next_invoice_date BETWEEN date('now') AND date('now', '+30 days')
      ORDER BY h.next_invoice_date ASC
    `,
      )
      .all(),
    forecast: db
      .prepare(
        `
      SELECT month, COUNT(*) as renewals, SUM(projected) as projected, COUNT(*) as active_plans FROM (
        SELECT strftime('%Y-%m', date('now', '+' || n || ' month')) as month, ri.grand_total as projected
        FROM (SELECT 0 n UNION SELECT 1 UNION SELECT 2 UNION SELECT 3 UNION SELECT 4 UNION SELECT 5 UNION SELECT 6 UNION SELECT 7 UNION SELECT 8 UNION SELECT 9 UNION SELECT 10 UNION SELECT 11) m
        CROSS JOIN recurring_invoices ri WHERE ri.is_deleted = 0 AND ri.is_stopped = 0
      ) GROUP BY month ORDER BY month ASC
    `,
      )
      .all(),
  };
}

function getFinanceAnalytics() {
  const db = getDb();
  return {
    gst: {
      outputGst: db
        .prepare("SELECT SUM(tax_total) FROM invoices WHERE is_deleted = 0")
        .get()["SUM(tax_total)"],
      inputGst: db
        .prepare(
          "SELECT (SELECT SUM(gst_amount) FROM expenses WHERE is_deleted = 0) + (SELECT SUM(tax_total) FROM purchases WHERE is_deleted = 0)",
        )
        .get()[
        "(SELECT SUM(gst_amount) FROM expenses WHERE is_deleted = 0) + (SELECT SUM(tax_total) FROM purchases WHERE is_deleted = 0)"
      ],
      trend: db
        .prepare(
          `
        SELECT month, SUM(output) as output, SUM(input) as input FROM (
          SELECT strftime('%Y-%m', invoice_date) as month, tax_total as output, 0 as input FROM invoices WHERE is_deleted = 0
          UNION ALL
          SELECT strftime('%Y-%m', bill_date) as month, 0 as output, tax_total as input FROM purchases WHERE is_deleted = 0
          UNION ALL
          SELECT strftime('%Y-%m', expense_date) as month, 0 as output, gst_amount as input FROM expenses WHERE is_deleted = 0
        ) GROUP BY month ORDER BY month DESC LIMIT 6
      `,
        )
        .all()
        .reverse(),
    },
    expenses: {
      categoryBreakdown: db
        .prepare(
          `
        SELECT COALESCE(ec.name, e.category) as name, SUM(total_amount) as value 
        FROM expenses e LEFT JOIN expense_categories ec ON ec.id = e.category_id 
        WHERE e.is_deleted = 0 GROUP BY name ORDER BY value DESC
      `,
        )
        .all(),
    },
    banking: {
      accountBalances: db
        .prepare(
          "SELECT account_name as name, current_balance as value FROM bank_accounts WHERE is_active = 1",
        )
        .all(),
    },
  };
}

module.exports = {
  getOverview,
  getRevenueAnalytics,
  getCustomerAnalytics,
  getRecurringAnalytics,
  getFinanceAnalytics,
};
