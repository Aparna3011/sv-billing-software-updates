const { getDb } = require('../db/database');

function ok(handler) {
  return async (_event, payload) => {
    try {
      return { data: await handler(payload || {}) };
    } catch (error) {
      return { error: error.message };
    }
  };
}

function fields(data, allowed) {
  return Object.fromEntries(Object.entries(data || {}).filter(([key]) => allowed.includes(key)));
}

function insert(table, data, allowed) {
  const clean = fields(data, allowed);
  const keys = Object.keys(clean);
  const placeholders = keys.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
  const info = getDb().prepare(sql).run(...keys.map(key => clean[key]));
  return getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
}

function update(table, id, data, allowed) {
  const clean = fields(data, allowed);
  const keys = Object.keys(clean);
  if (!keys.length) return getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  const sql = `UPDATE ${table} SET ${keys.map(key => `${key} = ?`).join(', ')} WHERE id = ?`;
  getDb().prepare(sql).run(...keys.map(key => clean[key]), id);
  return getDb().prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
}

module.exports = { ok, insert, update };
