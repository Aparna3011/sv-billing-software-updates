const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const { getDb } = require('../db/database');
const { ok } = require('./helpers');
const activity = require('../services/activitylog.service');

module.exports = ipcMain => {
  ipcMain.handle('company:get', ok(() => getDb().prepare('SELECT * FROM company WHERE id = 1').get()));
  ipcMain.handle('company:uploadLogo', ok(data => {
  if (!data?.base64) throw new Error('Missing logo payload');

  const uploadsDir = path.join(
    app.getPath('userData'),
    'uploads',
    'company'
  );

  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const fileName = `company-logo-${Date.now()}.png`;

  const filePath = path.join(uploadsDir, fileName);

  const base64Data = data.base64.replace(
    /^data:image\/\w+;base64,/,
    ''
  );

  fs.writeFileSync(
    filePath,
    Buffer.from(base64Data, 'base64')
  );

  return {
    fileName,
    filePath
  };

}));
  
  ipcMain.handle('company:update', ok(data => {
    const allowed = [
  'name',
  'legal_name',
  'tagline',

  'address',
  'city',
  'state',
  'pincode',
  'country',

  'email',
  'phone',
  'mobile',
  'website',

  'gstin',
  'pan',
  'cin',

  'logo_path',

  'bank_name',
  'bank_account',
  'ifsc',
  'upi_id',

  'term1',
  'term2',
  'term3',
  'term4',
  'term5',

  'invoice_footer'
];
    const keys = allowed.filter(key => data[key] !== undefined);
    if (!keys.length) return getDb().prepare('SELECT * FROM company WHERE id = 1').get();
    getDb().prepare(`UPDATE company SET ${keys.map(key => `${key} = ?`).join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run(...keys.map(key => data[key]));
    activity.log('settings:changed', { entityType: 'company', entityId: 1, message: 'Company profile updated' });
    return getDb().prepare('SELECT * FROM company WHERE id = 1').get();
  }));
};
