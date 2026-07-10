const bcrypt = require('bcryptjs');
const { getDb } = require('../db/database');
const { ok } = require('./helpers');
const activity = require('../services/activitylog.service');

module.exports = ipcMain => {
 ipcMain.handle('auth:login', ok(({ email, password }) => {
  const user = getDb()
    .prepare('SELECT * FROM users WHERE email = ? AND is_active = 1')
    .get(email);

  console.log("EMAIL:", email);
  console.log("USER FOUND:", !!user);

  if (!user) throw new Error('Invalid email or password');

  console.log("HASH:", user.password_hash);
  console.log("PASSWORD:", password);

  const valid = bcrypt.compareSync(password || '', user.password_hash);

  console.log("VALID:", valid);

  if (!valid) throw new Error('Invalid email or password');

  const { password_hash, ...safeUser } = user;
  return safeUser;
}));
};
