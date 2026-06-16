module.exports = `
  PRAGMA foreign_keys=OFF;

  DROP TABLE IF EXISTS quotation_items_new;

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
    line_total
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
    line_total
  FROM quotation_items;

  DROP TABLE quotation_items;

  ALTER TABLE quotation_items_new
  RENAME TO quotation_items;



  DROP TABLE IF EXISTS invoice_items_new;

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
    line_total
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
    line_total
  FROM invoice_items;

  DROP TABLE invoice_items;

  ALTER TABLE invoice_items_new
  RENAME TO invoice_items;

  PRAGMA foreign_keys=ON;
`;
