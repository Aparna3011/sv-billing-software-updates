module.exports = `
ALTER TABLE quotations ADD COLUMN is_gst_enabled INTEGER DEFAULT 1;
ALTER TABLE invoices ADD COLUMN is_gst_enabled INTEGER DEFAULT 1;
ALTER TABLE purchases ADD COLUMN is_gst_enabled INTEGER DEFAULT 1;
ALTER TABLE expenses ADD COLUMN is_gst_enabled INTEGER DEFAULT 1;
ALTER TABLE recurring_invoices ADD COLUMN is_gst_enabled INTEGER DEFAULT 1;

UPDATE quotations SET is_gst_enabled = 1 WHERE is_gst_enabled IS NULL;
UPDATE invoices SET is_gst_enabled = 1 WHERE is_gst_enabled IS NULL;
UPDATE purchases SET is_gst_enabled = 1 WHERE is_gst_enabled IS NULL;
UPDATE expenses SET is_gst_enabled = 1 WHERE is_gst_enabled IS NULL;
UPDATE recurring_invoices SET is_gst_enabled = 1 WHERE is_gst_enabled IS NULL;
`;