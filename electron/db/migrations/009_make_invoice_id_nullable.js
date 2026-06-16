module.exports = `
  PRAGMA foreign_keys=OFF;

  CREATE TABLE incoming_payments_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_no TEXT NOT NULL UNIQUE,
    invoice_id INTEGER REFERENCES invoices(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    payment_date TEXT NOT NULL,
    amount REAL NOT NULL,
    mode TEXT NOT NULL DEFAULT 'bank_transfer',
    reference_no TEXT,
    notes TEXT,
    recurring_invoice_id INTEGER REFERENCES recurring_invoices(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  INSERT INTO incoming_payments_new (
    id, payment_no, invoice_id, customer_id, payment_date, 
    amount, mode, reference_no, notes, recurring_invoice_id, created_at
  )
  SELECT 
    id, payment_no, invoice_id, customer_id, payment_date, 
    amount, mode, reference_no, notes, recurring_invoice_id, created_at 
  FROM incoming_payments;

  DROP TABLE incoming_payments;

  ALTER TABLE incoming_payments_new
  RENAME TO incoming_payments;

  PRAGMA foreign_keys=ON;
`;