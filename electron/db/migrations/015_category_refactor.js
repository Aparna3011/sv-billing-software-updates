module.exports = `
-- Move income-related categories from expense_categories to income_categories
INSERT OR IGNORE INTO income_categories (name, description, is_active, is_system)
SELECT name, description, is_active, 0 AS is_system
FROM expense_categories
WHERE LOWER(name) IN ('customer payment', 'sales revenue', 'service income', 'recurring income', 'interest income');

-- Delete them from expense_categories
DELETE FROM expense_categories 
WHERE LOWER(name) IN ('customer payment', 'sales revenue', 'service income', 'recurring income', 'interest income');
`;