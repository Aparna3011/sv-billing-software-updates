const fs = require('fs');
const path = require('path');
const { getDb, closeDb, initDatabase } = require('../db/database');
const { getDbPath, getBackupsDir, ensureAppDirs } = require('./appPaths');
const activity = require('../services/activitylog.service');

class BackupService {
  static async create(label = 'manual') {
    // Ensure directories exist before backup
    ensureAppDirs();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const filename = `backup_${label}_${timestamp}.db`;
    const backupPath = path.join(getBackupsDir(), filename);

    try {
      // Keep only the latest 3 existing backups to make room for the new one (Total 4)
      const existingBackups = this.list();
      if (existingBackups.length >= 4) {
        existingBackups.slice(3).forEach(file => {
          try { 
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path); 
          } catch (err) { 
            console.error('Failed to delete old backup:', err); 
          }
        });
      }
    } catch (err) {
      console.error('Error during backup cleanup:', err);
    }

    await getDb().backup(backupPath);
    
    activity.log('backup:created', { entityType: 'backup', message: filename });
    return { filename, path: backupPath, timestamp: new Date().toISOString() };
  }

  static list() {
    return fs.readdirSync(getBackupsDir()).filter(file => file.endsWith('.db')).map(file => {
      const fullPath = path.join(getBackupsDir(), file);
      const stats = fs.statSync(fullPath);
      return { filename: file, path: fullPath, size: stats.size, created: stats.mtime };
    }).sort((a, b) => b.created - a.created);
  }

  static restore(backupPath) {
    if (!fs.existsSync(backupPath)) throw new Error('Backup file not found');
    closeDb();
    fs.copyFileSync(backupPath, getDbPath());
    initDatabase();
    activity.log('backup:restored', { entityType: 'backup', message: backupPath });
    return true;
  }
}

module.exports = { BackupService };
