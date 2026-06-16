module.exports = `
-- 1. Rebuild Expenses with FKs
CREATE TABLE expenses_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_no TEXT,
  expense_date TEXT NOT NULL,
  vendor TEXT,
  vendor_id INTEGER,
  category TEXT,
  category_id INTEGER,
  amount REAL NOT NULL,
  gst_rate REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL,
  total_amount REAL NOT NULL DEFAULT 0,
  payment_mode TEXT,
  reference_no TEXT,
  notes TEXT,
  attachment_path TEXT,
  bank_account_id INTEGER,
  bank_transaction_id INTEGER,
  status TEXT NOT NULL DEFAULT 'paid',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);

INSERT INTO expenses_new (
  id, expense_no, expense_date, vendor, vendor_id, category, category_id,
  amount, gst_rate, gst_amount, total_amount, payment_mode, reference_no,
  notes, attachment_path, bank_account_id, bank_transaction_id, status,
  is_deleted, created_at
)
SELECT 
  id, expense_no, expense_date, vendor, vendor_id, category, category_id,
  amount, gst_rate, gst_amount, total_amount, payment_mode, reference_no,
  notes, attachment_path, bank_account_id, bank_transaction_id, status,
  is_deleted, created_at
FROM expenses;
DROP TABLE expenses;
ALTER TABLE expenses_new RENAME TO expenses;

-- 2. Rebuild Purchases (Remove bank_account_id, add vendor FK)
CREATE TABLE purchases_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_date TEXT NOT NULL,
  due_date TEXT,
  vendor TEXT,
  vendor_id INTEGER,
  bill_no TEXT,
  vendor_bill_no TEXT,
  service_name TEXT,
  amount REAL NOT NULL,
  gst_rate REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  cgst_total REAL NOT NULL DEFAULT 0,
  sgst_total REAL NOT NULL DEFAULT 0,
  igst_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  notes TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vendor_id) REFERENCES vendors(id)
);

INSERT INTO purchases_new (
  id, bill_date, due_date, vendor, vendor_id, bill_no, vendor_bill_no,
  service_name, amount, gst_rate, gst_amount, subtotal, cgst_total,
  sgst_total, igst_total, tax_total, grand_total, paid_amount,
  balance_due, status, notes, is_deleted, created_at
)
SELECT 
  id, bill_date, due_date, vendor, vendor_id, bill_no, vendor_bill_no,
  service_name, amount, gst_rate, gst_amount, subtotal, cgst_total,
  sgst_total, igst_total, tax_total, grand_total, paid_amount,
  balance_due, status, notes, is_deleted, created_at
FROM purchases;
DROP TABLE purchases;
ALTER TABLE purchases_new RENAME TO purchases;

-- 3. Rebuild Incoming Payments (Category FK to income_categories)
CREATE TABLE incoming_payments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_no TEXT,
  invoice_id INTEGER,
  recurring_invoice_id INTEGER,
  customer_id INTEGER,
  category_id INTEGER,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  mode TEXT,
  reference_no TEXT,
  notes TEXT,
  bank_account_id INTEGER,
  bank_transaction_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (recurring_invoice_id) REFERENCES recurring_invoices(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (category_id) REFERENCES income_categories(id),
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);

INSERT INTO incoming_payments_new (
  id, payment_no, invoice_id, recurring_invoice_id, customer_id,
  category_id, payment_date, amount, mode, reference_no, notes,
  bank_account_id, bank_transaction_id, created_at
)
SELECT
  id,
  payment_no,
  invoice_id,
  recurring_invoice_id,
  customer_id,
  NULL AS category_id,
  payment_date,
  amount,
  mode,
  reference_no,
  notes,
  NULL AS bank_account_id,
  NULL AS bank_transaction_id,
  created_at
FROM incoming_payments;
DROP TABLE incoming_payments;
ALTER TABLE incoming_payments_new RENAME TO incoming_payments;

-- 4. Rebuild Outgoing Payments (Category FK to expense_categories)
CREATE TABLE outgoing_payments_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER,
  vendor_id INTEGER,
  category_id INTEGER,
  payment_no TEXT,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  mode TEXT,
  reference_no TEXT,
  notes TEXT,
  bank_account_id INTEGER,
  bank_transaction_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id),
  FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);

INSERT INTO outgoing_payments_new (
  id, purchase_id, vendor_id, category_id, payment_no, payment_date,
  amount, mode, reference_no, notes, bank_account_id, bank_transaction_id,
  created_at
)
SELECT 
  id, purchase_id, vendor_id, category_id, payment_no, payment_date,
  amount, mode, reference_no, notes, bank_account_id, bank_transaction_id,
  created_at
FROM outgoing_payments;
DROP TABLE outgoing_payments;
ALTER TABLE outgoing_payments_new RENAME TO outgoing_payments;

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_expenses_bank_account_id ON expenses(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_incoming_category_id ON incoming_payments(category_id);
CREATE INDEX IF NOT EXISTS idx_incoming_bank_account_id ON incoming_payments(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_category_id ON outgoing_payments(category_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_bank_account_id ON outgoing_payments(bank_account_id);
`;
