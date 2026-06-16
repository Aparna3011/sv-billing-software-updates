module.exports = `
  CREATE TABLE IF NOT EXISTS gst_rates_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rate REAL UNIQUE,
    label TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  INSERT INTO gst_rates_new (
    id,
    rate,
    label,
    is_active
  )
  SELECT
    id,
    rate,
    label,
    is_active
  FROM gst_rates;

  DROP TABLE gst_rates;

  ALTER TABLE gst_rates_new
  RENAME TO gst_rates;
`;