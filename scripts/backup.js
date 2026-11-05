const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cron = require('node-cron');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');
const RETENTION_DAYS = 7;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

/**
 * Ensures backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Cleans up backup files older than 7 days to preserve AWS disk space
 */
function cleanupOldBackups() {
  try {
    ensureBackupDir();
    const files = fs.readdirSync(BACKUP_DIR);
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      if (file.endsWith('.sql')) {
        const filePath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > RETENTION_MS) {
          fs.unlinkSync(filePath);
          console.log(`[Backup Retention] Purged backup older than ${RETENTION_DAYS} days: ${file}`);
          deletedCount++;
        }
      }
    }
    if (deletedCount > 0) {
      console.log(`[Backup Retention] Cleaned up ${deletedCount} old backup file(s).`);
    }
  } catch (err) {
    console.error('⚠️ [Backup Retention Error]:', err.message);
  }
}

/**
 * Executes mysqldump to generate a timestamped SQL backup file
 */
function runBackup() {
  return new Promise((resolve, reject) => {
    ensureBackupDir();

    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'umanarayani';
    const dbPort = process.env.DB_PORT || 3306;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${dbName}_${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    // Build mysqldump command
    // Use --single-transaction for transactional table consistency without locking
    const passArg = dbPass ? `-p"${dbPass}"` : '';
    const cmd = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${passArg} --single-transaction --quick ${dbName} > "${filepath}"`;

    console.log(`[Database Backup] Starting automated backup for database '${dbName}'...`);

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ [Database Backup Failed]: ${error.message}`);
        if (fs.existsSync(filepath) && fs.statSync(filepath).size === 0) {
          fs.unlinkSync(filepath);
        }
        return reject(error);
      }

      const sizeKb = (fs.statSync(filepath).size / 1024).toFixed(2);
      console.log(`✅ [Database Backup Complete] Successfully saved to: ${filename} (${sizeKb} KB)`);

      // Run retention cleanup immediately after successful backup
      cleanupOldBackups();

      resolve({ filename, filepath, sizeKb });
    });
  });
}

/**
 * Starts the automated nightly backup cron job
 */
function startBackupSchedule() {
  // Every night at 02:00 AM server time
  const schedule = '0 2 * * *';

  cron.schedule(schedule, async () => {
    console.log('[Database Backup Cron] Triggered scheduled 2:00 AM database backup.');
    try {
      await runBackup();
    } catch (err) {
      console.error('[Database Backup Cron Error]:', err.message);
    }
  });

  console.log('⏰ Automated MySQL backup scheduled: Every night at 02:00 AM (7-day retention enabled).');
}

// Allow running directly via CLI: node scripts/backup.js
if (require.main === module) {
  require('dotenv').config();
  runBackup()
    .then(res => {
      console.log('Backup script finished successfully:', res);
      process.exit(0);
    })
    .catch(err => {
      console.error('Backup script failed:', err);
      process.exit(1);
    });
}

module.exports = {
  runBackup,
  cleanupOldBackups,
  startBackupSchedule
};
