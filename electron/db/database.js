const fs = require("fs");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");
const { getDbPath, ensureAppDirs } = require("../utils/appPaths");
const initialSchema = [
  { name: "001_initial", sql: require("./migrations/001_initial") },
  { name: "002_update_company", sql: require("./migrations/002_update_company") },
  { name: "003_description_points", sql: require("./migrations/003_description_points") },
  { name: "004_activity_logs_json", sql: require("./migrations/004_activity_logs_json") },
  { name: "005_update_gst_rates_nullable", sql: require("./migrations/005_update_gst_rates_nullable") },
  { name: "006_make_item_gst_nullable", sql: require("./migrations/006_make_item_gst_nullable") },
  { name: "007_recurring_upgrade", sql: require("./migrations/007_recurring_upgrade") },
  { name: "008_recurring_history_upgrade", sql: require("./migrations/008_recurring_history_upgrade") },
  { name: "009_make_invoice_id_nullable", sql: require("./migrations/009_make_invoice_id_nullable") },
  { name: "010_recurring_schema_refactor", sql: require("./migrations/010_recurring_schema_refactor") },
  { name: "011_restore_foreign_keys", sql: require("./migrations/011_restore_foreign_keys") },
  { name: "012_accounting_erp_upgrade", sql: require("./migrations/012_accounting_erp_upgrade") },
  { name: "013_income_categories", sql: require("./migrations/013_income_categories") },
  { name: "014_banking_foreign_keys", sql: require("./migrations/014_banking_foreign_keys") },
  { name: "015_category_refactor", sql: require("./migrations/015_category_refactor") },
  { name: "016_expense_items", sql: require("./migrations/016_expense_items") },
  { name: "017_gst_configuration", sql: require("./migrations/017_gst_configuration") },
];

let db;

function getDb() {
  if (!db) initDatabase();
  return db;
}

function initDatabase() {
  ensureAppDirs();
  const firstRun = !fs.existsSync(getDbPath());
  db = new Database(getDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = OFF"); // Disabled during initialization to allow table rebuild migrations
  db.pragma("synchronous = NORMAL");

  // Setup migration tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      migration_name TEXT PRIMARY KEY,
      executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const migrationReport = [];

  initialSchema.forEach((m) => {
    const row = db.prepare("SELECT executed_at FROM migrations WHERE migration_name = ?").get(m.name);
    
    if (row) {
      migrationReport.push({ Migration: m.name, Status: "Skipped", AppliedAt: row.executed_at });
    } else {
      try {
        db.transaction(() => {
          db.exec(m.sql);
          db.prepare("INSERT INTO migrations (migration_name) VALUES (?)").run(m.name);
        })();
        const now = new Date().toISOString();
        migrationReport.push({ Migration: m.name, Status: "Executed", AppliedAt: now });
        console.log(`[Migration] Success: ${m.name}`);
      } catch (err) {
        console.error(`[Migration] Failed: ${m.name} - ${err.message}`);
        throw err;
      }
    }
  });

  // Backfill Services billing_type
  db.prepare(`
    UPDATE services SET billing_type = 'Fixed Price' 
    WHERE billing_type IS NULL OR TRIM(billing_type) = ''
  `).run();

  // console.table(migrationReport);

  // Re-enable foreign keys after all migrations and schema changes are complete
  db.pragma("foreign_keys = ON");

  ensureColumn(db, "expenses", "gst_rate", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "expenses", "expense_no", "TEXT");
  ensureColumn(db, "expenses", "is_deleted", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "expenses", "vendor_id", "INTEGER");
  ensureColumn(db, "expenses", "category_id", "INTEGER");
  ensureColumn(db, "expenses", "payment_mode", "TEXT");
  ensureColumn(db, "expenses", "reference_no", "TEXT");
  ensureColumn(db, "expenses", "attachment_path", "TEXT");
  ensureColumn(db, "expenses", "bank_account_id", "INTEGER");
  ensureColumn(db, "expenses", "bank_transaction_id", "INTEGER");
  ensureColumn(db, "expenses", "total_amount", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "expenses", "paid_amount", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "expenses", "due_date", "TEXT");
  ensureColumn(db, "expenses", "balance_due", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "expenses", "status", "TEXT NOT NULL DEFAULT 'unpaid'");
  ensureColumn(db, "expenses", "is_gst_enabled", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "purchases", "gst_rate", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "purchases", "is_deleted", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "purchases", "vendor_id", "INTEGER");
  ensureColumn(db, "purchases", "vendor_bill_no", "TEXT");
  ensureColumn(db, "purchases", "due_date", "TEXT");
  ensureColumn(db, "purchases", "bank_account_id", "INTEGER");
  ensureColumn(db, "purchases", "subtotal", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "purchases", "cgst_total", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "purchases", "sgst_total", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "purchases", "igst_total", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "purchases", "tax_total", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "purchases", "grand_total", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "purchases", "paid_amount", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "purchases", "balance_due", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "purchases", "status", "TEXT NOT NULL DEFAULT 'pending'");
  ensureColumn(db, "purchases", "is_gst_enabled", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "purchase_items", "sac_code", "TEXT");
  ensureColumn(db, "purchase_items", "billing_type", "TEXT");
  ensureColumn(db, "outgoing_payments", "bank_account_id", "INTEGER");
  ensureColumn(db, "outgoing_payments", "bank_transaction_id", "INTEGER");
  ensureColumn(db, "incoming_payments", "bank_account_id", "INTEGER");
  ensureColumn(db, "incoming_payments", "bank_transaction_id", "INTEGER");
  ensureColumn(db, "bank_transactions", "balance_after", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "outgoing_payments", "is_deleted", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "outgoing_payments", "expense_id", "INTEGER");
  ensureColumn(db, "bank_transactions", "is_deleted", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "bank_transactions", "deleted_at", "TEXT");
  ensureColumn(db, "bank_transactions", "created_at", "TEXT");
  ensureColumn(db, "bank_transactions", "updated_at", "TEXT");
  ensureColumn(db, "company", "tagline", "TEXT");
  ensureColumn(db, "company", "city", "TEXT");
  ensureColumn(db, "company", "pincode", "TEXT");
  ensureColumn(db, "company", "country", "TEXT");
  ensureColumn(db, "company", "mobile", "TEXT");
  ensureColumn(db, "company", "website", "TEXT");
  ensureColumn(db, "company", "pan", "TEXT");
  ensureColumn(db, "company", "cin", "TEXT");
  ensureColumn(db, "company", "term1", "TEXT");
  ensureColumn(db, "company", "term2", "TEXT");
  ensureColumn(db, "company", "term3", "TEXT");
  ensureColumn(db, "company", "term4", "TEXT");
  ensureColumn(db, "company", "term5", "TEXT");
  ensureColumn(db, "company", "invoice_footer", "TEXT");
  ensureColumn(db, "bank_accounts", "account_type", "TEXT DEFAULT 'Current'");
  ensureColumn(db, "bank_accounts", "branch_name", "TEXT DEFAULT ''");
  ensureColumn(db, "bank_accounts", "is_default", "INTEGER DEFAULT 0");
  ensureColumn(db, "expense_categories", "is_system", "INTEGER DEFAULT 0");

  // Incoming Payments
ensureColumn(db, "incoming_payments", "category_id", "INTEGER");
ensureColumn(db, "incoming_payments", "bank_account_id", "INTEGER");
ensureColumn(db, "incoming_payments", "bank_transaction_id", "INTEGER");

ensureColumn(db, "outgoing_payments", "category_id", "INTEGER");
ensureColumn(db, "outgoing_payments", "bank_account_id", "INTEGER");
ensureColumn(db, "outgoing_payments", "bank_transaction_id", "INTEGER");

ensureColumn(db, "expenses", "category_id", "INTEGER");
ensureColumn(db, "expenses", "bank_account_id", "INTEGER");
ensureColumn(db, "expenses", "bank_transaction_id", "INTEGER");

  ensureColumn(
    db,
    "quotations",
    "discount_is_percent",
    "INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(db, "quotations", "is_gst_enabled", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(
    db,
    "invoices",
    "discount_is_percent",
    "INTEGER NOT NULL DEFAULT 0",
  );
  ensureColumn(db, "invoices", "is_gst_enabled", "INTEGER NOT NULL DEFAULT 1");
  ensureColumn(db, "quotations", "round_off", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "invoices", "round_off", "REAL NOT NULL DEFAULT 0");
  ensureColumn(db, "customers", "country", "TEXT");
  ensureColumn(db, "customers", "city", "TEXT");
  ensureColumn(db, "activity_logs", "old_data", "TEXT");
  ensureColumn(db, "recurring", "is_stopped", "INTEGER NOT NULL DEFAULT 0");

  ensureColumn(db, "recurring", "stopped_reason", "TEXT");

  ensureColumn(db, "recurring", "is_deleted", "INTEGER NOT NULL DEFAULT 0");

  ensureColumn(db, "incoming_payments", "recurring_invoice_id", "INTEGER");
  ensureColumn(db, "incoming_payments", "is_deleted", "INTEGER NOT NULL DEFAULT 0");

  ensureColumn(db, "recurring_invoices", "is_gst_enabled", "INTEGER NOT NULL DEFAULT 1");

  // Recurring Lifecycle History Fields

 
  ensureColumn(db, "recurring_invoice_history", "paid_on_date", "TEXT");
  ensureColumn(db, "recurring_invoice_history", "paid_amount", "REAL");
  ensureColumn(db, "recurring_invoice_history", "pending_amount", "REAL");
  ensureColumn(db, "recurring_invoice_history", "overdue_days", "INTEGER");
  ensureColumn(db, "recurring_invoice_history", "collection_status", "TEXT");
  ensureColumn(db, "recurring_invoice_history", "last_generated_at", "TEXT");

  const recurringPrefixExists = db
    .prepare(
      `
    SELECT value
    FROM settings
    WHERE key = ?
  `,
    )
    .get("recurring_prefix");

  if (!recurringPrefixExists) {
    db.prepare(
      `
    INSERT INTO settings (
      key,
      value
    )
    VALUES (?, ?)
  `,
    ).run("recurring_prefix", "REC");
  }

  if (firstRun) seedDefaultData(db);

  const noGstExists = db
    .prepare(
      `
    SELECT *
    FROM gst_rates
    WHERE label = ?
  `,
    )
    .get("No GST");

  if (!noGstExists) {
    db.prepare(
      `
    INSERT INTO gst_rates (
      rate,
      label,
      is_active
    )
    VALUES (?, ?, ?)
  `,
    ).run(null, "No GST", 1);
  }

  syncAccountingMasters(db);
  return db;
}

function closeDb() {
  if (db) db.close();
  db = null;
}

function seedDefaultData(connection) {
  const passwordHash = bcrypt.hashSync("admin123", 10);
  const tx = connection.transaction(() => {
    connection
      .prepare(
        `
      INSERT OR IGNORE INTO users (id, name, email, password_hash, role, is_active)
      VALUES (1, 'Super Admin', 'admin@svithub.local', ?, 'super_admin', 1)
    `,
      )
      .run(passwordHash);
    connection
      .prepare(
        `
      INSERT OR IGNORE INTO company (id, name, legal_name, state, gstin, email, phone, address, bank_name, bank_account, ifsc, upi_id)
      VALUES (1, 'SV IT Hub', 'SV IT Hub', 'Gujarat', '', 'billing@svithub.local', '', '', '', '', '', '')
    `,
      )
      .run();
    [
      [null, "No GST"],
      [0, "0% GST"],
      [5, "5% GST"],
      [12, "12% GST"],
      [18, "18% GST"],
      [28, "28% GST"],
    ].forEach(([rate, label]) => {
      connection
        .prepare(
          `
      INSERT OR IGNORE INTO gst_rates (
        rate,
        label,
        is_active
      )
      VALUES (?, ?, 1)
    `,
        )
        .run(rate, label);
    });
    [
      ["invoice_prefix", "INV"],
      ["quotation_prefix", "SV/QU"],
      ["payment_prefix", "PAY"],
      ["recurring_prefix", "REC"],
      ["currency", "INR"],
      ["date_format", "dd/MM/yyyy"],
      ["gst_enabled_outgoing", "1"],
      ["gst_enabled_incoming", "1"],
    ].forEach(([key, value]) =>
      connection
        .prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)")
        .run(key, value),
    );
  });
  tx();
}

function ensureColumn(connection, table, column, definition) {
  const columns = connection
    .prepare(`PRAGMA table_info(${table})`)
    .all()
    .map((row) => row.name);
  if (!columns.includes(column)) {
    connection.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function syncAccountingMasters(connection) {
  try {
    console.log("[Sync] Starting accounting master synchronization...");

    // 1. Run Foreign Key Check for diagnostics
    const violations = connection.prepare("PRAGMA foreign_key_check").all();
    if (violations.length > 0) {
      console.warn("[Sync] Found pre-existing Foreign Key violations:");
      console.table(violations);
    }

    const vendorRows = connection
      .prepare(
        `
        SELECT vendor
        FROM expenses
        WHERE vendor IS NOT NULL AND TRIM(vendor) <> ''
        UNION
        SELECT vendor
        FROM purchases
        WHERE vendor IS NOT NULL AND TRIM(vendor) <> ''
      `,
      )
      .all();

    const insertVendor = connection.prepare(
      `
      INSERT OR IGNORE INTO vendors (
        vendor_code,
        company_name
      )
      VALUES (?, ?)
    `,
    );

    vendorRows.forEach((row) => {
      const name = String(row.vendor || "").trim();
      if (!name) return;
      insertVendor.run(`VEN-${name.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 24)}`, name);
    });

    connection.exec(`
      UPDATE expenses
      SET vendor_id = (
        SELECT id FROM vendors WHERE vendors.company_name = expenses.vendor LIMIT 1
      )
      WHERE vendor_id IS NULL AND vendor IS NOT NULL AND TRIM(vendor) <> '';

      UPDATE purchases
      SET vendor_id = (
        SELECT id FROM vendors WHERE vendors.company_name = purchases.vendor LIMIT 1
      )
      WHERE vendor_id IS NULL AND vendor IS NOT NULL AND TRIM(vendor) <> '';

      INSERT OR IGNORE INTO expense_categories (name)
      SELECT DISTINCT category
      FROM expenses
      WHERE category IS NOT NULL AND TRIM(category) <> '';

      UPDATE expenses
      SET category_id = (
        SELECT id FROM expense_categories WHERE expense_categories.name = expenses.category LIMIT 1
      )
      WHERE category_id IS NULL AND category IS NOT NULL AND TRIM(category) <> '';

      INSERT OR IGNORE INTO vendors (vendor_code, company_name)
      SELECT 'VEN-GENERAL', 'General Vendor'
      WHERE NOT EXISTS (SELECT 1 FROM vendors WHERE is_deleted = 0);

      UPDATE expenses
      SET vendor_id = COALESCE(
            (SELECT id FROM vendors WHERE vendor_code = 'VEN-GENERAL' LIMIT 1),
            (SELECT id FROM vendors WHERE is_deleted = 0 ORDER BY id LIMIT 1)
          ),
          vendor = COALESCE(NULLIF(TRIM(vendor), ''), 'General Vendor')
      WHERE vendor_id IS NULL;

      UPDATE purchases
      SET vendor_id = COALESCE(
            (SELECT id FROM vendors WHERE vendor_code = 'VEN-GENERAL' LIMIT 1),
            (SELECT id FROM vendors WHERE is_deleted = 0 ORDER BY id LIMIT 1)
          ),
          vendor = COALESCE(NULLIF(TRIM(vendor), ''), 'General Vendor')
      WHERE vendor_id IS NULL;

      UPDATE purchases
      SET subtotal = CASE WHEN subtotal = 0 THEN amount ELSE subtotal END,
          tax_total = CASE WHEN tax_total = 0 THEN gst_amount ELSE tax_total END,
          cgst_total = CASE WHEN cgst_total = 0 THEN ROUND(gst_amount / 2.0, 2) ELSE cgst_total END,
          sgst_total = CASE WHEN sgst_total = 0 THEN ROUND(gst_amount - ROUND(gst_amount / 2.0, 2), 2) ELSE sgst_total END,
          grand_total = CASE WHEN grand_total = 0 THEN ROUND(amount + gst_amount, 2) ELSE grand_total END,
          balance_due = CASE WHEN balance_due = 0 THEN ROUND((CASE WHEN grand_total = 0 THEN amount + gst_amount ELSE grand_total END) - paid_amount, 2) ELSE balance_due END,
          status = CASE
            WHEN paid_amount >= (CASE WHEN grand_total = 0 THEN amount + gst_amount ELSE grand_total END) THEN 'paid'
            WHEN paid_amount > 0 THEN 'partially_paid'
            ELSE status
          END
      WHERE is_deleted = 0;

      INSERT INTO purchase_items (
        purchase_id,
        name,
        description,
        qty,
        rate,
        gst_rate,
        cgst,
        sgst,
        igst,
        line_total
      )
      SELECT
        p.id,
        p.service_name,
        IFNULL(p.notes, ''),
        1,
        p.amount,
        p.gst_rate,
        p.cgst_total,
        p.sgst_total,
        p.igst_total,
        p.amount
      FROM purchases p
      WHERE NOT EXISTS (
        SELECT 1
        FROM purchase_items pi
        WHERE pi.purchase_id = p.id
      );
    `);

    // Sync historical paid expenses into outgoing_payments ledger
    // Requirement: Add defensive filters to select only records where Foreign Key references exist
    console.log("[Sync] Synchronizing historical expenses to outgoing payments...");
    connection.prepare(`
      INSERT INTO outgoing_payments (
        expense_id, vendor_id, category_id, payment_no, payment_date, 
        amount, mode, reference_no, notes, bank_account_id, bank_transaction_id
      )
      SELECT 
        e.id, e.vendor_id, e.category_id, 'PPAY-SYNC-' || e.expense_no, e.expense_date, 
        e.total_amount, COALESCE(e.payment_mode, 'bank_transfer'), e.reference_no, e.notes, 
        e.bank_account_id, e.bank_transaction_id
      FROM expenses e
      WHERE e.is_deleted = 0
        AND e.paid_amount > 0 -- Only sync if there was a payment
        AND e.status = 'paid'
        AND e.bank_account_id IS NOT NULL 
        AND NOT EXISTS (SELECT 1 FROM outgoing_payments op WHERE op.expense_id = e.id)
        -- Validate References
        AND EXISTS (SELECT 1 FROM vendors v WHERE v.id = e.vendor_id)
        AND EXISTS (SELECT 1 FROM expense_categories ec WHERE ec.id = e.category_id)
        AND EXISTS (SELECT 1 FROM bank_accounts ba WHERE ba.id = e.bank_account_id)
    `).run();

    console.log("[Sync] Master synchronization completed successfully.");
  } catch (error) {
    console.error("[Sync] Critical failure during master synchronization:");
    console.error(`  - Message: ${error.message}`);
    console.error(`  - Statement trace: ${error.stack}`);
    // Do not re-throw, prevent application startup crash
  }
}

module.exports = { getDb, initDatabase, closeDb };
