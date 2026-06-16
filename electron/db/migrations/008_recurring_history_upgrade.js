module.exports = `
CREATE TABLE IF NOT EXISTS recurring_invoice_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  recurring_invoice_id INTEGER NOT NULL
    REFERENCES recurring_invoices(id),

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

  created_at TEXT NOT NULL
    DEFAULT CURRENT_TIMESTAMP
);
`;