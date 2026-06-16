const initialSchema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin','accountant','operator')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  name TEXT NOT NULL,
  legal_name TEXT,
  state TEXT NOT NULL DEFAULT 'Gujarat',
  gstin TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_path TEXT,
  bank_name TEXT,
  bank_account TEXT,
  ifsc TEXT,
  upi_id TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gst_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate REAL NOT NULL UNIQUE,
  label TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  gstin TEXT,
  gst_treatment TEXT NOT NULL DEFAULT 'registered',
  state TEXT NOT NULL DEFAULT 'Gujarat',
  address TEXT,
  payment_terms INTEGER NOT NULL DEFAULT 15,
  opening_balance REAL NOT NULL DEFAULT 0,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  sac_code TEXT NOT NULL DEFAULT '998314',
  billing_type TEXT NOT NULL DEFAULT 'Fixed Price',
  rate REAL NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 18,
  category TEXT NOT NULL DEFAULT 'Software Service',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_no TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  quotation_date TEXT NOT NULL,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  round_off REAL NOT NULL DEFAULT 0,
  notes TEXT,
  converted_invoice_id INTEGER,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quotation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL REFERENCES quotations(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id),
  name TEXT NOT NULL,
  description TEXT,
  sac_code TEXT,
  qty REAL NOT NULL DEFAULT 1,
  billing_type TEXT NOT NULL DEFAULT 'Fixed Price',
  rate REAL NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 18,
  line_total REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  quotation_id INTEGER REFERENCES quotations(id),
  invoice_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  cgst_total REAL NOT NULL DEFAULT 0,
  sgst_total REAL NOT NULL DEFAULT 0,
  igst_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  round_off REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  is_recurring INTEGER NOT NULL DEFAULT 0,
  recurring_id INTEGER,
  notes TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL
  REFERENCES invoices(id) ON DELETE CASCADE,
  service_id INTEGER
  REFERENCES services(id),
  name TEXT NOT NULL,
  description TEXT,
  sac_code TEXT,
  qty REAL NOT NULL DEFAULT 1,
  billing_type TEXT NOT NULL DEFAULT 'Fixed Price',
  rate REAL NOT NULL DEFAULT 0,
  gst_rate REAL NOT NULL DEFAULT 18,
  cgst REAL NOT NULL DEFAULT 0,
  sgst REAL NOT NULL DEFAULT 0,
  igst REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0
);


CREATE TABLE IF NOT EXISTS incoming_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_no TEXT NOT NULL UNIQUE,

  invoice_id INTEGER REFERENCES invoices(id),

  recurring_invoice_id INTEGER REFERENCES recurring_invoices(id),

  customer_id INTEGER NOT NULL REFERENCES customers(id),

  payment_date TEXT NOT NULL,

  amount REAL NOT NULL,

  mode TEXT NOT NULL DEFAULT 'bank_transfer',

  reference_no TEXT,

  notes TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_date TEXT NOT NULL,
  vendor TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  gst_rate REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_date TEXT NOT NULL,
  vendor TEXT NOT NULL,
  bill_no TEXT,
  service_name TEXT NOT NULL,
  amount REAL NOT NULL,
  gst_rate REAL NOT NULL DEFAULT 0,
  gst_amount REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  actor_user_id INTEGER,

  action TEXT NOT NULL,

  entity_type TEXT,

  entity_id INTEGER,

  message TEXT,

  old_data TEXT,

  new_data TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

module.exports = initialSchema;
