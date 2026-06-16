const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { ok } = require('./helpers');
const activity = require('../services/activitylog.service');

module.exports = ipcMain => {
  ipcMain.handle('users:list', ok(() => getDb().prepare('SELECT id, name, email, role, is_active, created_at FROM users ORDER BY name').all()));
  ipcMain.handle('users:create', ok(({ name, email, password, role }) => {
    if (!name) throw new Error('Name is required');
    if (!email) throw new Error('Email is required');
    if (!password) throw new Error('Password is required');
    const hash = bcrypt.hashSync(password || 'admin123', 10);
    const info = getDb().prepare('INSERT INTO users (name, email, password_hash, role, is_active) VALUES (?, ?, ?, ?, 1)').run(name, email, hash, role || 'operator');
    activity.log('user:created', { entityType: 'user', entityId: info.lastInsertRowid, message: email });
    return getDb().prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(info.lastInsertRowid);
  }));
  ipcMain.handle('users:update', ok(({ id, name, email, password, role, is_active }) => {
    if (!id) throw new Error('User id is required');
    if (!name) throw new Error('Name is required');
    if (!email) throw new Error('Email is required');
    const db = getDb();
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!current) throw new Error('User not found');
    const hash = password ? bcrypt.hashSync(password, 10) : current.password_hash;
    db.prepare(`
      UPDATE users SET name = ?, email = ?, password_hash = ?, role = ?, is_active = ?
      WHERE id = ?
    `).run(name, email, hash, role || current.role, is_active === undefined ? current.is_active : Number(is_active), id);
    activity.log('user:updated', { entityType: 'user', entityId: id, message: email });
    return db.prepare('SELECT id, name, email, role, is_active, created_at FROM users WHERE id = ?').get(id);
  }));
  ipcMain.handle('users:delete', ok(({ id }) => {
    if (Number(id) === 1) throw new Error('Default super admin cannot be deactivated');
    return getDb().prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(id);
  }));
};
