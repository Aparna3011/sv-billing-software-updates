const { getDb } = require('../db/database');
const { ok } = require('./helpers');

module.exports = ipcMain => {
  ipcMain.handle('activitylog:list', ok(() => getDb().prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 500').all()));
};
