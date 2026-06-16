module.exports = `
-- 1. Create expense_items table
CREATE TABLE IF NOT EXISTS expense_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,

  category_id INTEGER REFERENCES expense_categories(id),

  name TEXT NOT NULL,
  description TEXT,

  qty REAL NOT NULL DEFAULT 1,
  rate REAL NOT NULL DEFAULT 0,

  gst_rate REAL NOT NULL DEFAULT 0,
  cgst REAL NOT NULL DEFAULT 0,
  sgst REAL NOT NULL DEFAULT 0,
  igst REAL NOT NULL DEFAULT 0,

  line_total REAL NOT NULL DEFAULT 0,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

  sac_code TEXT,
  billing_type TEXT
);
-- 2. Add missing breakdown columns to expenses header to match Invoices/Purchases
ALTER TABLE expenses ADD COLUMN subtotal REAL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN cgst_total REAL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN sgst_total REAL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN igst_total REAL DEFAULT 0;
ALTER TABLE expenses ADD COLUMN tax_total REAL DEFAULT 0;

-- 3. Migration logic: Create one item for every legacy expense
INSERT INTO expense_items (
  expense_id,
  category_id,
  name,
  description,
  qty,
  rate,
  gst_rate,
  line_total,
  billing_type,
  created_at
)
SELECT
  id,
  category_id,
  COALESCE(NULLIF(TRIM(category),''), 'Expense'),
  COALESCE(NULLIF(TRIM(notes),''), category, 'Expense Item'),
  1,
  amount,
  gst_rate,
  total_amount,
  'Expense',
  created_at
FROM expenses
WHERE id NOT IN (
  SELECT DISTINCT expense_id
  FROM expense_items
);

-- 4. Update header totals for legacy records
UPDATE expenses
SET
  subtotal = amount,
  tax_total = gst_amount,
  cgst_total = 0,
  sgst_total = 0,
  igst_total = 0
WHERE subtotal = 0;
`;
