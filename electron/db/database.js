const fs = require("fs");
const Database = require("better-sqlite3");
const { getDbPath, ensureAppDirs } = require("../utils/appPaths");
const initialSchema = [
  // All schema changes for the unified 'contacts' architecture have been
  // consolidated into 001_initial.js. Subsequent migration files (003-017)
  // are considered redundant for schema creation and should be removed.
  { name: "001_initial", sql: require("./migrations/001_initial") },
  { name: "002_update_company", sql: require("./migrations/002_update_company") },
];

let db;

function getDb() {
  if (!db) initDatabase();
  return db;
}

function initDatabase() {
  ensureAppDirs();
  db = new Database(getDbPath());
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("synchronous = NORMAL");

  db.exec("CREATE TABLE IF NOT EXISTS migrations (migration_name TEXT PRIMARY KEY, executed_at TEXT DEFAULT CURRENT_TIMESTAMP)");

  initialSchema.forEach((m) => {
    const row = db.prepare("SELECT executed_at FROM migrations WHERE migration_name = ?").get(m.name);
    if (!row) {
      db.transaction(() => {
        db.exec(m.sql);
        db.prepare("INSERT INTO migrations (migration_name) VALUES (?)").run(m.name);
      })();
    }
  });
  return db;
}

function closeDb() {
  if (db) db.close();
  db = null;
}

module.exports = { getDb, initDatabase, closeDb };
