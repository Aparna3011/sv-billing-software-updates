const { getDb } = require('../db/database');
const { ok } = require('./helpers');
const gstService = require('../services/gst.service');

module.exports = ipcMain => {
  ipcMain.handle('gst:list', ok(() => getDb().prepare('SELECT * FROM gst_rates ORDER BY rate').all()));
  ipcMain.handle('gst:listGstTreatments', ok(() => gstService.listGstTreatments()));
  ipcMain.handle('gst:create', ok(({ rate, label }) => getDb().prepare('INSERT INTO gst_rates (rate, label, is_active) VALUES (?, ?, 1)').run(rate, label || `${rate}% GST`)));
  ipcMain.handle('gst:update', ok(({ id, rate, label, is_active }) => {
    const current = getDb().prepare('SELECT * FROM gst_rates WHERE id = ?').get(id);
    if (!current) throw new Error('GST rate not found');
    return getDb().prepare('UPDATE gst_rates SET rate = ?, label = ?, is_active = ? WHERE id = ?').run(
      rate ?? current.rate,
      label ?? current.label,
      is_active === undefined ? current.is_active : (is_active ? 1 : 0),
      id
    );
  }));
  ipcMain.handle('gst:delete', ok(({ id }) => getDb().prepare('UPDATE gst_rates SET is_active = 0 WHERE id = ?').run(id)));
};
