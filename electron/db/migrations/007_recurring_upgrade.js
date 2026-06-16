module.exports = `

CREATE TABLE IF NOT EXISTS recurring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  customer_id INTEGER NOT NULL,

  invoice_id INTEGER,

  is_deleted INTEGER NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (customer_id)
    REFERENCES customers(id),

  FOREIGN KEY (invoice_id)
    REFERENCES invoices(id)
);



CREATE TABLE IF NOT EXISTS recurring_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  recurring_id INTEGER NOT NULL,

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

  is_active INTEGER NOT NULL DEFAULT 1,

  FOREIGN KEY (recurring_id)
    REFERENCES recurring(id)
    ON DELETE CASCADE
);



CREATE TABLE IF NOT EXISTS recurring_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  recurring_invoice_id INTEGER NOT NULL,

  service_id INTEGER,

  name TEXT NOT NULL,

  description TEXT,

  sac_code TEXT,

  qty REAL NOT NULL DEFAULT 1,

  billing_type TEXT,

  rate REAL NOT NULL DEFAULT 0,

  gst_rate REAL NOT NULL DEFAULT 18,

  cgst REAL NOT NULL DEFAULT 0,

  sgst REAL NOT NULL DEFAULT 0,

  igst REAL NOT NULL DEFAULT 0,

  line_total REAL NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (recurring_invoice_id)
    REFERENCES recurring_invoices(id)
    ON DELETE CASCADE,

  FOREIGN KEY (service_id)
    REFERENCES services(id)
);



CREATE INDEX IF NOT EXISTS idx_recurring_customer_id
ON recurring(customer_id);



CREATE INDEX IF NOT EXISTS idx_recurring_invoice_id
ON recurring(invoice_id);



CREATE INDEX IF NOT EXISTS idx_recurring_invoices_recurring_id
ON recurring_invoices(recurring_id);



CREATE INDEX IF NOT EXISTS idx_recurring_items_recurring_invoice_id
ON recurring_items(recurring_invoice_id);

`;