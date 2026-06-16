module.exports = `
CREATE TABLE IF NOT EXISTS income_categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO income_categories (name, is_system) VALUES 
('Customer Payment', 1), ('Sales Revenue', 1), ('Service Income', 1), 
('Recurring Income', 1), ('Interest Income', 1);
`;