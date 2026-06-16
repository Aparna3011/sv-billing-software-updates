const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { ok } = require('./helpers');
const activity = require('../services/activitylog.service');

module.exports = ipcMain => {
  ipcMain.handle('auth:login', ok(({ email, password }) => {
    const user = getDb().prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
    if (!user || !bcrypt.compareSync(password || '', user.password_hash)) throw new Error('Invalid email or password');
    activity.log('user:login', { actorUserId: user.id, entityType: 'user', entityId: user.id, message: user.email });
    const { password_hash, ...safeUser } = user;
    return safeUser;
  }));
  ipcMain.handle('auth:logout', ok(() => true));
};
