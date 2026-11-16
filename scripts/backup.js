const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const cron = require('node-cron');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { sendBackupAlert } = require('../services/alertService');

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
 * Cleans up local backup files older than 7 days to preserve AWS EC2 disk space
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
          console.log(`[Backup Retention] Purged local backup older than ${RETENTION_DAYS} days: ${file}`);
          deletedCount++;
        }
      }
    }
    if (deletedCount > 0) {
      console.log(`[Backup Retention] Cleaned up ${deletedCount} old local backup file(s).`);
    }
  } catch (err) {
    console.error('⚠️ [Backup Retention Error]:', err.message);
  }
}

/**
 * Uploads a local backup file to Amazon S3 with SSE-S3 encryption (AES256)
 * and retention/environment metadata tagging.
 *
 * @param {string} filepath - Absolute local path of the backup file
 * @param {string} filename - Base filename of the backup
 * @returns {Promise<string|null>} - Returns the S3 URI if uploaded, or null if S3 is not configured
 */
async function uploadToS3(filepath, filename) {
  const bucket = (process.env.S3_BACKUP_BUCKET || '').trim();
  if (!bucket) {
    console.log('ℹ️ [S3 Backup] S3_BACKUP_BUCKET not configured. Keeping local backup copy only.');
    return null;
  }

  const region = process.env.AWS_REGION || 'ap-south-1'; // Default: AWS Mumbai
  const prefix = (process.env.S3_BACKUP_PREFIX || 'database-backups/').replace(/^\/+/, '');

  // Year/Month partitioned S3 key prefix for lifecycle organization
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const s3Key = `${prefix}${year}/${month}/${filename}`;

  const clientConfig = { region };
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
  }

  const s3 = new S3Client(clientConfig);
  const fileStream = fs.createReadStream(filepath);
  const fileStats = fs.statSync(filepath);

  console.log(`[S3 Backup] Uploading ${filename} to s3://${bucket}/${s3Key} (Encrypted: AES256)...`);

  const putCmd = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    Body: fileStream,
    ContentLength: fileStats.size,
    ContentType: 'application/x-sql',
    ServerSideEncryption: 'AES256', // Enforce AWS S3 server-side encryption at rest
    Tagging: 'Environment=production&Retention=30Days&Service=database-backup',
    Metadata: {
      'database-name': process.env.DB_NAME || 'umanarayani',
      'created-at': now.toISOString(),
      'retention-policy': '30-days-glacier-transition'
    }
  });

  await s3.send(putCmd);
  const s3Uri = `s3://${bucket}/${s3Key}`;
  console.log(`✅ [S3 Backup Complete] Successfully uploaded and encrypted at: ${s3Uri}`);
  return s3Uri;
}

/**
 * Executes mysqldump to generate a timestamped SQL backup file,
 * uploads to Amazon S3 (if configured), performs local rolling retention,
 * and sends alerts on failure.
 *
 * @returns {Promise<Object>}
 */
function runBackup() {
  return new Promise((resolve, reject) => {
    ensureBackupDir();
    const startTime = Date.now();

    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASSWORD || '';
    const dbName = process.env.DB_NAME || 'umanarayani';
    const dbPort = process.env.DB_PORT || 3306;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${dbName}_${timestamp}.sql`;
    const filepath = path.join(BACKUP_DIR, filename);

    // Build mysqldump command
    // Use --single-transaction for InnoDB transactional consistency without table locks
    const passArg = dbPass ? `-p"${dbPass}"` : '';
    const cmd = `mysqldump -h ${dbHost} -P ${dbPort} -u ${dbUser} ${passArg} --single-transaction --quick ${dbName} > "${filepath}"`;

    console.log(`[Database Backup] Starting automated backup for database '${dbName}' on ${dbHost}:${dbPort}...`);

    exec(cmd, async (error, stdout, stderr) => {
      const durationMs = Date.now() - startTime;

      if (error) {
        console.error(`❌ [Database Backup Failed]: ${error.message}`);
        if (fs.existsSync(filepath) && fs.statSync(filepath).size === 0) {
          try { fs.unlinkSync(filepath); } catch {}
        }

        // Fire failure alert
        await sendBackupAlert({
          success: false,
          operation: 'MySQL Dump',
          filename,
          error: error.message,
          durationMs
        });

        return reject(error);
      }

      const sizeKb = (fs.statSync(filepath).size / 1024).toFixed(2);
      console.log(`✅ [Database Backup Complete] Successfully saved local copy: ${filename} (${sizeKb} KB)`);

      // Run local retention cleanup immediately
      cleanupOldBackups();

      // S3 Upload phase
      let s3Location = null;
      try {
        s3Location = await uploadToS3(filepath, filename);
      } catch (s3Err) {
        console.error(`❌ [S3 Upload Failed]: ${s3Err.message}`);
        // Alert that while local backup succeeded, offsite S3 sync failed
        await sendBackupAlert({
          success: false,
          operation: 'S3 Offsite Backup Upload',
          filename,
          sizeKb,
          error: s3Err.message,
          durationMs: Date.now() - startTime
        });
        // We still resolve with local backup info so process doesn't completely crash
        return resolve({ filename, filepath, sizeKb, s3Location: null, s3Error: s3Err.message });
      }

      // If user enabled success notifications
      if (process.env.NOTIFY_BACKUP_SUCCESS === 'true') {
        await sendBackupAlert({
          success: true,
          operation: 'Scheduled Database Backup',
          filename,
          sizeKb,
          s3Location,
          durationMs
        });
      }

      resolve({ filename, filepath, sizeKb, s3Location });
    });
  });
}

/**
 * Starts the automated nightly backup cron job
 */
function startBackupSchedule() {
  // Every night at 02:00 AM server time (or configured cron pattern)
  const schedule = process.env.BACKUP_CRON_SCHEDULE || '0 2 * * *';

  cron.schedule(schedule, async () => {
    console.log(`[Database Backup Cron] Triggered scheduled backup (${schedule}).`);
    try {
      await runBackup();
    } catch (err) {
      console.error('[Database Backup Cron Error]:', err.message);
    }
  });

  console.log(`⏰ Automated MySQL backup scheduled: '${schedule}' with local 7-day retention and S3 cloud offsite.`);
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
      console.error('Backup script failed:', err.message);
      process.exit(1);
    });
}

module.exports = {
  runBackup,
  cleanupOldBackups,
  uploadToS3,
  startBackupSchedule
};
