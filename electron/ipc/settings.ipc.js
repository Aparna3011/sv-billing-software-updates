const { getDb } = require('../db/database');
const { ok } = require('./helpers');
const activity = require('../services/activitylog.service');

module.exports = ipcMain => {
  ipcMain.handle('settings:list', ok(() => getDb().prepare('SELECT * FROM settings ORDER BY key').all()));
  ipcMain.handle('settings:get', ok(({ key }) => getDb().prepare('SELECT * FROM settings WHERE key = ?').get(key)));
  ipcMain.handle('settings:set', ok(({ key, value }) => {
    getDb().prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
    activity.log('settings:changed', { entityType: 'settings', message: key });
    return { key, value };
  }));
  ipcMain.handle('settings:update',  ok(({ oldKey, key, value }) => {
    const db = getDb();
    db.prepare(`
      UPDATE settings
      SET
        key = ?,
        value = ?
      WHERE key = ?
    `).run(
      key,
      value,
      oldKey
    );

    return true;

  })
);
};
