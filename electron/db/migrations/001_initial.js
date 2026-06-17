module.exports = `
PRAGMA foreign_keys = OFF;

-- Master Data Entities

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin','accountant','operator')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS company (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  name TEXT NOT NULL,
  legal_name TEXT,
  tagline TEXT,
  state TEXT NOT NULL DEFAULT 'Maharashtra',
  city TEXT,
  pincode TEXT,
  country TEXT,
  mobile TEXT,
  website TEXT,
  pan TEXT,
  cin TEXT,
  gstin TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  logo_path TEXT,
  bank_name TEXT,
  bank_account TEXT,
  bank_branch TEXT,
  ifsc TEXT,
  upi_id TEXT,
  term1 TEXT, term2 TEXT, term3 TEXT, term4 TEXT, term5 TEXT,
  invoice_footer TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS gst_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate REAL UNIQUE,
  label TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS expense_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS income_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER NOT NULL DEFAULT 0,
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
  gst_rate REAL DEFAULT NULL,
  category TEXT NOT NULL DEFAULT 'Software Service',
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_sequences (
  type TEXT PRIMARY KEY, -- INV, QU, PUR, EXP, PAY, REC
  prefix TEXT NOT NULL,
  next_value INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ERP-Grade Contact Master

CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  is_customer INTEGER NOT NULL DEFAULT 1,
  is_vendor INTEGER NOT NULL DEFAULT 0,
  company_name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  phone TEXT,
  gstin TEXT,
  gst_treatment TEXT DEFAULT 'registered',
  state TEXT DEFAULT 'Maharashtra',
  city TEXT,
  country TEXT,
  address TEXT,
  payment_terms INTEGER DEFAULT 15,
  opening_balance REAL DEFAULT 0,
  current_balance REAL DEFAULT 0,
  notes TEXT,
  is_active INTEGER DEFAULT 1,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Banking & Accounting

CREATE TABLE IF NOT EXISTS bank_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_name TEXT NOT NULL,
  bank_name TEXT,
  account_no TEXT,
  ifsc TEXT,
  account_type TEXT DEFAULT 'Current',
  branch_name TEXT DEFAULT '',
  opening_balance REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_default INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bank_account_id INTEGER NOT NULL,
  transaction_date TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('credit', 'debit')),
  source_type TEXT,
  source_id INTEGER,
  amount REAL NOT NULL DEFAULT 0,
  balance_after REAL NOT NULL DEFAULT 0,
  reference_no TEXT,
  notes TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);

-- Sales & Revenue

CREATE TABLE IF NOT EXISTS quotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_no TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL,
  quotation_date TEXT NOT NULL,
  valid_until TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'sent', 'accepted', 'declined', 'converted', 'expired')),
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  discount_is_percent INTEGER NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  round_off REAL NOT NULL DEFAULT 0,
  is_gst_enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  converted_invoice_id INTEGER,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id)
);

CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_no TEXT NOT NULL UNIQUE,
  contact_id INTEGER NOT NULL,
  quotation_id INTEGER,
  invoice_date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'partially_paid', 'paid', 'cancelled', 'overdue')),
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  discount_is_percent INTEGER NOT NULL DEFAULT 0,
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
  is_gst_enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (quotation_id) REFERENCES quotations(id)
);

-- Recurring Billing Engine (depends on contacts, invoices)

CREATE TABLE IF NOT EXISTS recurring (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contact_id INTEGER NOT NULL,
  invoice_id INTEGER,
  is_stopped INTEGER NOT NULL DEFAULT 0,
  stopped_reason TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
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
  round_off REAL NOT NULL DEFAULT 0,
  is_gst_enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  start_date TEXT,
  end_date TEXT,
  is_stopped INTEGER NOT NULL DEFAULT 0,
  stopped_reason TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recurring_id) REFERENCES recurring(id) ON DELETE CASCADE
);

-- Item Tables (depend on services, quotations, invoices, recurring_invoices)

CREATE TABLE IF NOT EXISTS quotation_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quotation_id INTEGER NOT NULL,
  service_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  sac_code TEXT,
  qty REAL NOT NULL DEFAULT 1,
  billing_type TEXT NOT NULL DEFAULT 'Fixed Price',
  rate REAL NOT NULL DEFAULT 0,
  gst_rate REAL,
  cgst REAL DEFAULT 0,
  sgst REAL DEFAULT 0,
  igst REAL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (quotation_id) REFERENCES quotations(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL,
  service_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  sac_code TEXT,
  qty REAL NOT NULL DEFAULT 1,
  billing_type TEXT NOT NULL DEFAULT 'Fixed Price',
  rate REAL NOT NULL DEFAULT 0,
  gst_rate REAL,
  cgst REAL DEFAULT 0,
  sgst REAL DEFAULT 0,
  igst REAL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id)
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
  gst_rate REAL DEFAULT NULL,
  cgst REAL NOT NULL DEFAULT 0,
  sgst REAL NOT NULL DEFAULT 0,
  igst REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recurring_invoice_id) REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id)
);

-- Purchasing & Expenses

CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_date TEXT NOT NULL,
  due_date TEXT,
  vendor TEXT,
  contact_id INTEGER NOT NULL,
  bill_no TEXT UNIQUE,
  vendor_bill_no TEXT,
  service_name TEXT,
  amount REAL NOT NULL,
  gst_rate REAL DEFAULT NULL,
  gst_amount REAL NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  cgst_total REAL NOT NULL DEFAULT 0,
  sgst_total REAL NOT NULL DEFAULT 0,
  igst_total REAL NOT NULL DEFAULT 0,
  tax_total REAL NOT NULL DEFAULT 0,
  grand_total REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('unpaid', 'partially_paid', 'paid', 'pending')),
  bank_account_id INTEGER,
  is_gst_enabled INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_no TEXT UNIQUE,
  expense_date TEXT NOT NULL,
  vendor TEXT,
  contact_id INTEGER NOT NULL,
  category TEXT,
  category_id INTEGER,
  amount REAL NOT NULL,
  subtotal REAL DEFAULT 0,
  gst_rate REAL DEFAULT NULL,
  gst_amount REAL NOT NULL,
  tax_total REAL DEFAULT 0,
  cgst_total REAL DEFAULT 0,
  sgst_total REAL DEFAULT 0,
  igst_total REAL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  balance_due REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  payment_mode TEXT,
  reference_no TEXT,
  notes TEXT,
  attachment_path TEXT,
  bank_account_id INTEGER,
  bank_transaction_id INTEGER,
  status TEXT NOT NULL DEFAULT 'paid' CHECK(status IN ('unpaid', 'partially_paid', 'paid', 'pending')),
  is_gst_enabled INTEGER NOT NULL DEFAULT 1,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id)
);

CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  service_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  sac_code TEXT,
  billing_type TEXT,
  qty REAL NOT NULL DEFAULT 1,
  rate REAL NOT NULL DEFAULT 0,
  gst_rate REAL DEFAULT NULL,
  cgst REAL NOT NULL DEFAULT 0,
  sgst REAL NOT NULL DEFAULT 0,
  igst REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (service_id) REFERENCES services(id)
);

CREATE TABLE IF NOT EXISTS expense_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL,
  category_id INTEGER,
  name TEXT NOT NULL,
  description TEXT,
  qty REAL NOT NULL DEFAULT 1,
  rate REAL NOT NULL DEFAULT 0,
  gst_rate REAL DEFAULT NULL,
  cgst REAL NOT NULL DEFAULT 0,
  sgst REAL NOT NULL DEFAULT 0,
  igst REAL NOT NULL DEFAULT 0,
  line_total REAL NOT NULL DEFAULT 0,
  sac_code TEXT,
  billing_type TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES expense_categories(id)
);

-- Payment Transactions (depend on invoices, recurring_invoices, customers, vendors, bank_accounts, bank_transactions, income_categories, expense_categories)

CREATE TABLE IF NOT EXISTS incoming_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_no TEXT UNIQUE,
  invoice_id INTEGER,
  recurring_invoice_id INTEGER,
  contact_id INTEGER NOT NULL,
  category_id INTEGER,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL,
  mode TEXT NOT NULL DEFAULT 'bank_transfer',
  reference_no TEXT,
  notes TEXT,
  bank_account_id INTEGER,
  bank_transaction_id INTEGER,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (recurring_invoice_id) REFERENCES recurring_invoices(id),
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (category_id) REFERENCES income_categories(id),
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
  FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id)
);

CREATE TABLE IF NOT EXISTS outgoing_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER,
  expense_id INTEGER,
  contact_id INTEGER NOT NULL,
  category_id INTEGER,
  payment_no TEXT UNIQUE,
  payment_date TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'bank_transfer',
  reference_no TEXT,
  notes TEXT,
  bank_account_id INTEGER,
  bank_transaction_id INTEGER,
  is_deleted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (purchase_id) REFERENCES purchases(id) ON DELETE CASCADE,
  FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  FOREIGN KEY (bank_account_id) REFERENCES bank_accounts(id),
  FOREIGN KEY (bank_transaction_id) REFERENCES bank_transactions(id)
);

-- Recurring History (depends on recurring_invoices, incoming_payments, users)

CREATE TABLE IF NOT EXISTS recurring_invoice_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recurring_invoice_id INTEGER NOT NULL,
  payment_id INTEGER,
  invoice_start_date TEXT,
  next_invoice_date TEXT,
  due_date TEXT,
  action_type TEXT NOT NULL,
  action_status TEXT,
  action_notes TEXT,
  amount REAL NOT NULL DEFAULT 0,
  payment_date TEXT,
  paid_on_date TEXT,
  paid_amount REAL,
  pending_amount REAL DEFAULT 0,
  overdue_days INTEGER DEFAULT 0,
  collection_status TEXT,
  last_generated_at TEXT,
  created_by INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recurring_invoice_id) REFERENCES recurring_invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (payment_id) REFERENCES incoming_payments(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Metadata & Logs

CREATE TABLE IF NOT EXISTS description_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER,
    quotation_item_id INTEGER,
    invoice_item_id INTEGER,
    point_order INTEGER DEFAULT 1,
    point_text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (service_id) REFERENCES services(id),
    FOREIGN KEY (quotation_item_id) REFERENCES quotation_items(id),
    FOREIGN KEY (invoice_item_id) REFERENCES invoice_items(id)
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
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL,
  account TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id INTEGER,
  reference_no TEXT,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance and uniqueness

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_quotations_quotation_no ON quotations(quotation_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_invoice_no ON invoices(invoice_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_expense_no ON expenses(expense_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_bill_no ON purchases(bill_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_incoming_payments_payment_no ON incoming_payments(payment_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_outgoing_payments_payment_no ON outgoing_payments(payment_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_expense_categories_name ON expense_categories(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_income_categories_name ON income_categories(name);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gst_rates_rate ON gst_rates(rate);
CREATE UNIQUE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_gstin ON contacts(gstin) WHERE gstin IS NOT NULL AND gstin != ''; -- Allow NULL/empty GSTIN
CREATE INDEX IF NOT EXISTS idx_contacts_company_name ON contacts(company_name);
CREATE INDEX IF NOT EXISTS idx_contacts_roles ON contacts(is_customer, is_vendor);

CREATE INDEX IF NOT EXISTS idx_quotations_contact_id ON quotations(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoices_quotation_id ON invoices(quotation_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice_id ON invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_quotation_items_quotation_id ON quotation_items(quotation_id);

CREATE INDEX IF NOT EXISTS idx_purchases_contact_id ON purchases(contact_id); -- New index
CREATE INDEX IF NOT EXISTS idx_expenses_contact_id ON expenses(contact_id);   -- New index
CREATE INDEX IF NOT EXISTS idx_expenses_category_id ON expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_expense_items_expense_id ON expense_items(expense_id);

CREATE INDEX IF NOT EXISTS idx_incoming_payments_contact_id ON incoming_payments(contact_id); -- New index
CREATE INDEX IF NOT EXISTS idx_incoming_payments_invoice_id ON incoming_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_incoming_payments_recurring_invoice_id ON incoming_payments(recurring_invoice_id);
CREATE INDEX IF NOT EXISTS idx_incoming_payments_bank_account_id ON incoming_payments(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_payments_contact_id ON outgoing_payments(contact_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_payments_purchase_id ON outgoing_payments(purchase_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_payments_expense_id ON outgoing_payments(expense_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_payments_bank_account_id ON outgoing_payments(bank_account_id);

CREATE INDEX IF NOT EXISTS idx_bank_transactions_bank_account_id ON bank_transactions(bank_account_id); -- New index
CREATE INDEX IF NOT EXISTS idx_bank_transactions_source ON bank_transactions(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_recurring_contact_id ON recurring(contact_id);
CREATE INDEX IF NOT EXISTS idx_recurring_invoices_recurring_id ON recurring_invoices(recurring_id);
CREATE INDEX IF NOT EXISTS idx_recurring_items_recurring_invoice_id ON recurring_items(recurring_invoice_id);
CREATE INDEX IF NOT EXISTS idx_recurring_history_recurring_invoice_id ON recurring_invoice_history(recurring_invoice_id);
CREATE INDEX IF NOT EXISTS idx_recurring_history_payment_id ON recurring_invoice_history(payment_id);

CREATE INDEX IF NOT EXISTS idx_description_points_service_id ON description_points(service_id);
CREATE INDEX IF NOT EXISTS idx_description_points_quotation_item_id ON description_points(quotation_item_id);
CREATE INDEX IF NOT EXISTS idx_description_points_invoice_item_id ON description_points(invoice_item_id);

CREATE INDEX IF NOT EXISTS idx_activity_logs_entity ON activity_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_source ON ledger_entries(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account ON ledger_entries(account);

-- GST Reporting Optimization
CREATE INDEX IF NOT EXISTS idx_invoice_items_gst ON invoice_items(gst_rate);
CREATE INDEX IF NOT EXISTS idx_purchase_items_gst ON purchase_items(gst_rate);
CREATE INDEX IF NOT EXISTS idx_expense_items_gst ON expense_items(gst_rate);

CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(invoice_date);
CREATE INDEX IF NOT EXISTS idx_purchases_date ON purchases(bill_date);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_incoming_payments_date ON incoming_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_date ON bank_transactions(transaction_date);

PRAGMA foreign_keys = ON;
`;