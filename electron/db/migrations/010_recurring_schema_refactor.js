module.exports = `
PRAGMA foreign_keys = OFF;

-- 1. Create the master-only table structure as per requirements
CREATE TABLE recurring_invoices_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recurring_id INTEGER NOT NULL REFERENCES recurring(id) ON DELETE CASCADE,
  recurring_invoice_no TEXT,
  billing_cycle TEXT NOT NULL,
  custom_billing_cycle INTEGER DEFAULT NULL,
  auto_generate INTEGER NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  discount_is_percent INTEGER NOT NULL DEFAULT 0,
  cgst_total REAL NOT NULL DEFAULT 0,
  sgst_total REAL NOT NULL DEFAULT 0,
  igst_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  start_date TEXT,
  end_date TEXT,
  is_stopped INTEGER NOT NULL DEFAULT 0,
  stopped_reason TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1
);

-- 2. Safely transfer data from the old structure.
-- We map 'invoice_no' from the original migration to the new 'recurring_invoice_no'.
-- Lifecycle columns (next_invoice_date, status, last_generated_at) are dropped here.
INSERT INTO recurring_invoices_new (
  id,
  recurring_id,
  recurring_invoice_no,
  billing_cycle,
  custom_billing_cycle,
  auto_generate,
  subtotal,
  discount,
  discount_is_percent,
  cgst_total,
  sgst_total,
  igst_total,
  tax_total,
  grand_total,
  notes,
  created_at,
  start_date,
  end_date,
  is_stopped,
  stopped_reason,
  is_deleted,
  is_active
)
SELECT
  id,
  recurring_id,
  recurring_invoice_no,
  billing_cycle,
  custom_billing_cycle,
  auto_generate,
  subtotal,
  discount,
  discount_is_percent,
  cgst_total,
  sgst_total,
  igst_total,
  tax_total,
  grand_total,
  notes,
  created_at,
  start_date,
  end_date,
  is_stopped,
  stopped_reason,
  is_deleted,
  is_active
FROM recurring_invoices;

DROP TABLE recurring_invoices;
ALTER TABLE recurring_invoices_new RENAME TO recurring_invoices;

CREATE INDEX IF NOT EXISTS idx_recurring_invoices_recurring_id ON recurring_invoices (recurring_id);

PRAGMA foreign_keys = ON;
`;