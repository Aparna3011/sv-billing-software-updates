module.exports = `
-- 1. Essential Company Placeholder (Required for foreign keys/logic)
INSERT OR IGNORE INTO company (id, name, state, country) 
VALUES (1, 'My Business', 'Maharashtra', 'India');

-- 2. Document Numbering Sequences
INSERT OR IGNORE INTO document_sequences (type, prefix, next_value) VALUES 
('INV', 'INV', 1),
('QU', 'SV/QU', 1),
('PUR', 'BILL', 1),
('EXP', 'EXP', 1),
('PAY', 'PAY', 1),
('PPAY', 'PPAY', 1),
('REC', 'REC', 1);

-- 3. Default GST Rates
INSERT OR IGNORE INTO gst_rates (rate, label, is_active) VALUES 
(null, 'No GST', 1),
(0, 'GST 0%', 1),
(5, 'GST 5%', 1),
(12, 'GST 12%', 1),
(18, 'GST 18%', 1),
(28, 'GST 28%', 1);

-- 4. Global Settings
INSERT OR IGNORE INTO settings (key, value) VALUES 
('gst_enabled_outgoing', '1'),
('gst_enabled_incoming', '1'),
('banking_preferences', '{"require_narration":false,"allow_negative_balance":true}');

-- 5. Income Categories
INSERT OR IGNORE INTO income_categories (name, description, is_system, is_active) VALUES 
('Customer Payment', 'Payments received against invoices', 1, 1),
('Sales Revenue', 'Direct sales income', 1, 1),
('Service Income', 'Consulting or service fees', 1, 1),
('Recurring Income', 'Subscription-based revenue', 1, 1),
('Interest Income', 'Bank interest and other earnings', 1, 1);

-- 6. Expense Categories
INSERT OR IGNORE INTO expense_categories (name, description, is_system, is_active) VALUES 
('Hosting', 'Server and cloud infrastructure', 1, 1),
('Software', 'Subscripts and digital tools', 1, 1),
('Office', 'Office and administration', 1, 1),
('Travel', 'Travel and conveyance', 1, 1),
('Professional Fees', 'Legal and consultant charges', 1, 1),
('Miscellaneous', 'Other operating expenses', 1, 1);

-- 7. Initial Service Placeholder
INSERT OR IGNORE INTO services (name, description, sac_code, billing_type, rate, gst_rate, category)
VALUES ('General Service', 'Standard service delivery', '998314', 'Fixed Price', 0, 18, 'Software Service');

-- 8. Default Cash Account
INSERT OR IGNORE INTO bank_accounts (account_name, bank_name, account_no, account_type, is_default, is_active)
VALUES ('Cash', 'Cash in Hand', 'CASH-001', 'Cash', 1, 1);

-- 9. Initial Super Admin (Password: admin123)
-- Note: In production, this should be handled via a setup wizard.
INSERT OR IGNORE INTO users (name, email, password_hash, role, is_active)
VALUES ('Administrator', 'admin@system.com', '$2a$10$7pM9.f4Yv/fQZpS5Yq.VduPzLpXzJjXzYpXzJjXzYpXzJjXzYpXzJ', 'super_admin', 1);
`;