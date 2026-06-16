module.exports = `
PRAGMA foreign_keys = OFF;

---------------------------------------------------
-- QUOTATION ITEMS
---------------------------------------------------

CREATE TABLE quotation_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  quotation_id INTEGER NOT NULL
    REFERENCES quotations(id)
    ON DELETE CASCADE,

  service_id INTEGER
    REFERENCES services(id),

  name TEXT NOT NULL,
  description TEXT,
  sac_code TEXT,

  qty REAL NOT NULL DEFAULT 1,

  billing_type TEXT,

  rate REAL NOT NULL DEFAULT 0,

  gst_rate REAL,

  line_total REAL NOT NULL DEFAULT 0,

  cgst REAL DEFAULT 0,
  sgst REAL DEFAULT 0,
  igst REAL DEFAULT 0
);

INSERT INTO quotation_items_new (
  id,
  quotation_id,
  service_id,
  name,
  description,
  sac_code,
  qty,
  billing_type,
  rate,
  gst_rate,
  line_total,
  cgst,
  sgst,
  igst
)
SELECT
  id,
  quotation_id,
  service_id,
  name,
  description,
  sac_code,
  qty,
  billing_type,
  rate,
  gst_rate,
  line_total,
  cgst,
  sgst,
  igst
FROM quotation_items;

DROP TABLE quotation_items;

ALTER TABLE quotation_items_new
RENAME TO quotation_items;

DELETE FROM sqlite_sequence
WHERE name = 'quotation_items';

INSERT INTO sqlite_sequence(name, seq)
SELECT 'quotation_items', COALESCE(MAX(id), 0)
FROM quotation_items;

---------------------------------------------------
-- INVOICE ITEMS
---------------------------------------------------

CREATE TABLE invoice_items_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  invoice_id INTEGER NOT NULL
    REFERENCES invoices(id)
    ON DELETE CASCADE,

  service_id INTEGER
    REFERENCES services(id),

  name TEXT NOT NULL,
  description TEXT,
  sac_code TEXT,

  qty REAL NOT NULL DEFAULT 1,

  billing_type TEXT,

  rate REAL NOT NULL DEFAULT 0,

  gst_rate REAL,

  line_total REAL NOT NULL DEFAULT 0,

  cgst REAL DEFAULT 0,
  sgst REAL DEFAULT 0,
  igst REAL DEFAULT 0
);

INSERT INTO invoice_items_new (
  id,
  invoice_id,
  service_id,
  name,
  description,
  sac_code,
  qty,
  billing_type,
  rate,
  gst_rate,
  line_total,
  cgst,
  sgst,
  igst
)
SELECT
  id,
  invoice_id,
  service_id,
  name,
  description,
  sac_code,
  qty,
  billing_type,
  rate,
  gst_rate,
  line_total,
  cgst,
  sgst,
  igst
FROM invoice_items;

DROP TABLE invoice_items;

ALTER TABLE invoice_items_new
RENAME TO invoice_items;

DELETE FROM sqlite_sequence
WHERE name = 'invoice_items';

INSERT INTO sqlite_sequence(name, seq)
SELECT 'invoice_items', COALESCE(MAX(id), 0)
FROM invoice_items;

---------------------------------------------------
-- PAYMENTS
---------------------------------------------------

CREATE TABLE incoming_payments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  payment_no TEXT NOT NULL UNIQUE,

  invoice_id INTEGER
    REFERENCES invoices(id),

  customer_id INTEGER NOT NULL
    REFERENCES customers(id),

  payment_date TEXT NOT NULL,

  amount REAL NOT NULL,

  mode TEXT NOT NULL DEFAULT 'bank_transfer',

  reference_no TEXT,

  notes TEXT,

  recurring_invoice_id INTEGER
    REFERENCES recurring_invoices(id),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO incoming_payments_new (
  id,
  payment_no,
  invoice_id,
  customer_id,
  payment_date,
  amount,
  mode,
  reference_no,
  notes,
  recurring_invoice_id,
  created_at
)
SELECT
  id,
  payment_no,
  invoice_id,
  customer_id,
  payment_date,
  amount,
  mode,
  reference_no,
  notes,
  recurring_invoice_id,
  created_at
FROM incoming_payments;

DROP TABLE incoming_payments;

ALTER TABLE incoming_payments_new
RENAME TO incoming_payments;

DELETE FROM sqlite_sequence
WHERE name = 'incoming_payments';

INSERT INTO sqlite_sequence(name, seq)
SELECT 'incoming_payments', COALESCE(MAX(id), 0)
FROM incoming_payments;

---------------------------------------------------
-- RECURRING INVOICE HISTORY
---------------------------------------------------

CREATE TABLE recurring_invoice_history_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  recurring_invoice_id INTEGER NOT NULL
    REFERENCES recurring_invoices(id)
    ON DELETE CASCADE,

  payment_id INTEGER
    REFERENCES incoming_payments(id),

  invoice_start_date TEXT,

  next_invoice_date TEXT,

  due_date TEXT,

  action_type TEXT NOT NULL,

  action_status TEXT,

  action_notes TEXT,

  amount REAL NOT NULL DEFAULT 0,

  payment_date TEXT,

  pending_amount REAL DEFAULT 0,

  overdue_days INTEGER DEFAULT 0,

  collection_status TEXT,

  created_by INTEGER
    REFERENCES users(id),

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  paid_on_date TEXT,

  paid_amount REAL,

  last_generated_at TEXT
);

INSERT INTO recurring_invoice_history_new (
  id,
  recurring_invoice_id,
  payment_id,
  invoice_start_date,
  next_invoice_date,
  due_date,
  action_type,
  action_status,
  action_notes,
  amount,
  payment_date,
  pending_amount,
  overdue_days,
  collection_status,
  created_by,
  created_at,
  paid_on_date,
  paid_amount,
  last_generated_at
)
SELECT
  id,
  recurring_invoice_id,
  payment_id,
  invoice_start_date,
  next_invoice_date,
  due_date,
  action_type,
  action_status,
  action_notes,
  amount,
  payment_date,
  pending_amount,
  overdue_days,
  collection_status,
  created_by,
  created_at,
  paid_on_date,
  paid_amount,
  last_generated_at
FROM recurring_invoice_history;

DROP TABLE recurring_invoice_history;

ALTER TABLE recurring_invoice_history_new
RENAME TO recurring_invoice_history;

DELETE FROM sqlite_sequence
WHERE name = 'recurring_invoice_history';

INSERT INTO sqlite_sequence(name, seq)
SELECT 'recurring_invoice_history', COALESCE(MAX(id), 0)
FROM recurring_invoice_history;

PRAGMA foreign_keys = ON;
`;