const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const mysql = require('mysql2/promise');
const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

/**
 * Ensures backup directory exists
 */
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

/**
 * Parses CLI arguments into an options object.
 * e.g., --file=backups/dump.sql --target-db=test_db --force
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    file: null,
    latestLocal: false,
    fromS3: false,
    s3Key: null,
    listLocal: false,
    listS3: false,
    targetDb: null,
    force: false,
    help: false
  };

  for (const arg of args) {
    if (arg === '--latest-local') options.latestLocal = true;
    else if (arg === '--from-s3') options.fromS3 = true;
    else if (arg === '--list-local') options.listLocal = true;
    else if (arg === '--list-s3') options.listS3 = true;
    else if (arg === '--force' || arg === '-f') options.force = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--file=')) options.file = arg.split('=')[1];
    else if (arg.startsWith('--s3-key=')) options.s3Key = arg.split('=')[1];
    else if (arg.startsWith('--target-db=')) options.targetDb = arg.split('=')[1];
  }

  return options;
}

/**
 * Lists all local backup files in the backups directory
 */
function listLocalBackups() {
  ensureBackupDir();
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.endsWith('.sql'))
    .map(f => {
      const fullPath = path.join(BACKUP_DIR, f);
      const stats = fs.statSync(fullPath);
      return {
        file: f,
        sizeKb: (stats.size / 1024).toFixed(2),
        mtime: stats.mtime
      };
    })
    .sort((a, b) => b.mtime - a.mtime);

  console.log('\n📂 Local Backups in:', BACKUP_DIR);
  if (files.length === 0) {
    console.log('   (No local .sql backup files found)');
  } else {
    files.forEach((f, idx) => {
      console.log(`   ${idx + 1}. ${f.file} (${f.sizeKb} KB) - ${f.mtime.toISOString()}`);
    });
  }
  console.log('');
  return files;
}

/**
 * Finds the latest local SQL dump file
 */
function getLatestLocalBackup() {
  const files = listLocalBackups();
  if (files.length === 0) return null;
  return path.join(BACKUP_DIR, files[0].file);
}

/**
 * Initializes AWS S3 client
 */
function getS3Client() {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const clientConfig = { region };
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
    };
  }
  return new S3Client(clientConfig);
}

/**
 * Lists backups available in the remote S3 bucket
 */
async function listS3Backups() {
  const bucket = (process.env.S3_BACKUP_BUCKET || '').trim();
  if (!bucket) {
    throw new Error('S3_BACKUP_BUCKET is not set in environment variables.');
  }

  const s3 = getS3Client();
  const prefix = (process.env.S3_BACKUP_PREFIX || 'database-backups/').replace(/^\/+/, '');

  console.log(`\n☁️ Listing S3 backups in s3://${bucket}/${prefix}...`);
  const cmd = new ListObjectsV2Command({
    Bucket: bucket,
    Prefix: prefix
  });

  const response = await s3.send(cmd);
  const contents = (response.Contents || [])
    .filter(item => item.Key.endsWith('.sql'))
    .sort((a, b) => b.LastModified - a.LastModified);

  if (contents.length === 0) {
    console.log('   (No S3 backup files found with prefix: ' + prefix + ')');
  } else {
    contents.forEach((item, idx) => {
      const sizeKb = (item.Size / 1024).toFixed(2);
      console.log(`   ${idx + 1}. ${item.Key} (${sizeKb} KB) - ${item.LastModified.toISOString()}`);
    });
  }
  console.log('');
  return contents;
}

/**
 * Downloads a backup file from S3 to local backups/ directory
 */
async function downloadFromS3(s3KeyToDownload = null) {
  ensureBackupDir();
  const bucket = (process.env.S3_BACKUP_BUCKET || '').trim();
  if (!bucket) {
    throw new Error('S3_BACKUP_BUCKET is not set in environment variables.');
  }

  const s3 = getS3Client();
  let key = s3KeyToDownload;

  if (!key) {
    const items = await listS3Backups();
    if (items.length === 0) {
      throw new Error(`No backups found in S3 bucket '${bucket}'.`);
    }
    key = items[0].Key;
  }

  const baseFilename = path.basename(key);
  const localTarget = path.join(BACKUP_DIR, baseFilename);

  console.log(`[S3 Download] Downloading s3://${bucket}/${key} -> ${localTarget}...`);
  const getCmd = new GetObjectCommand({
    Bucket: bucket,
    Key: key
  });

  const response = await s3.send(getCmd);
  const writeStream = fs.createWriteStream(localTarget);

  await new Promise((resolve, reject) => {
    response.Body.pipe(writeStream);
    writeStream.on('finish', resolve);
    writeStream.on('error', reject);
  });

  const sizeKb = (fs.statSync(localTarget).size / 1024).toFixed(2);
  console.log(`✅ [S3 Download Complete] Saved to: ${localTarget} (${sizeKb} KB)`);
  return localTarget;
}

/**
 * Executes mysql client to restore a SQL file into the target database.
 */
function executeSqlRestore(sqlFilePath, targetDb) {
  return new Promise((resolve, reject) => {
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbUser = process.env.DB_USER || 'root';
    const dbPass = process.env.DB_PASSWORD || '';
    const dbPort = process.env.DB_PORT || 3306;

    const passArg = dbPass ? `-p"${dbPass}"` : '';
    const cmd = `mysql -h ${dbHost} -P ${dbPort} -u ${dbUser} ${passArg} ${targetDb} < "${sqlFilePath}"`;

    console.log(`[Database Restore] Executing restore on database '${targetDb}' from '${path.basename(sqlFilePath)}'...`);

    exec(cmd, (error, stdout, stderr) => {
      if (error) {
        console.error(`❌ [Database Restore Failed]: ${error.message}`);
        return reject(error);
      }
      resolve(true);
    });
  });
}

/**
 * Connects to target database and runs verification queries
 */
async function verifyRestoredDatabase(targetDb) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: targetDb
  });

  try {
    const [tables] = await connection.query('SHOW TABLES');
    const tableNames = tables.map(t => Object.values(t)[0]);

    console.log(`\n🔍 [Verification] Tables found in '${targetDb}': (${tableNames.length} total)`);
    console.log(`   ${tableNames.join(', ')}`);

    const checks = {};
    for (const table of ['products', 'users', 'orders', 'addresses', 'password_resets']) {
      if (tableNames.includes(table)) {
        const [cnt] = await connection.query(`SELECT COUNT(*) as count FROM ${table}`);
        checks[table] = cnt[0].count;
      }
    }

    console.log('\n📊 [Record Count Verification]:');
    Object.entries(checks).forEach(([tbl, count]) => {
      console.log(`   - ${tbl.padEnd(16)}: ${count} records`);
    });

    return { tableCount: tableNames.length, checks };
  } finally {
    await connection.end();
  }
}

/**
 * Main Restore Controller
 */
async function main() {
  const options = parseArgs();

  if (options.help) {
    console.log(`
🌿 Umanarayani Database Restore Utility
Usage:
  node scripts/restore-database.js [options]

Options:
  --file=<path>        Path to local .sql dump file
  --latest-local       Automatically pick the latest dump from backups/
  --from-s3            Download and restore the latest backup from Amazon S3
  --s3-key=<key>       Specific S3 object key to download and restore
  --list-local         List all local backup files in backups/
  --list-s3            List all backup files available in Amazon S3
  --target-db=<name>   Database name to restore into (default: DB_NAME from .env)
  --force, -f          Bypass safety warning (required when restoring to production DB)
  --help, -h           Show this help message

Examples:
  # Safe test restore into a scratch testing database:
  node scripts/restore-database.js --latest-local --target-db=umanarayani_restore_test --force

  # Download latest backup from S3 and restore into test DB:
  node scripts/restore-database.js --from-s3 --target-db=umanarayani_restore_test --force
    `);
    process.exit(0);
  }

  if (options.listLocal) {
    listLocalBackups();
    process.exit(0);
  }

  if (options.listS3) {
    await listS3Backups();
    process.exit(0);
  }

  const defaultDb = process.env.DB_NAME || 'umanarayani';
  const targetDb = options.targetDb || defaultDb;

  // Resolve SQL file to restore
  let sqlFilePath = null;
  if (options.file) {
    sqlFilePath = path.resolve(options.file);
  } else if (options.fromS3 || options.s3Key) {
    sqlFilePath = await downloadFromS3(options.s3Key);
  } else if (options.latestLocal) {
    sqlFilePath = getLatestLocalBackup();
  }

  if (!sqlFilePath) {
    console.error('❌ Error: No backup file specified.');
    console.error('   Please specify --file=<path>, --latest-local, or --from-s3.');
    console.error('   Run with --help for detailed usage.');
    process.exit(1);
  }

  if (!fs.existsSync(sqlFilePath)) {
    console.error(`❌ Error: Backup file not found at: ${sqlFilePath}`);
    process.exit(1);
  }

  // Safety confirmation check
  if (targetDb === defaultDb && !options.force) {
    console.error('\n⚠️  SAFETY WARNING: You are attempting to restore into the PRIMARY DATABASE: ' + targetDb);
    console.error('   This will OVERWRITE existing tables and data.');
    console.error('   To proceed, rerun the command with the --force flag:');
    console.error(`   node scripts/restore-database.js --file="${sqlFilePath}" --target-db=${targetDb} --force\n`);
    process.exit(1);
  }

  console.log('=============================================================');
  console.log('🌿 UMANARAYANI DATABASE RESTORE INITIATED');
  console.log('=============================================================');
  console.log(`Target Database : ${targetDb}`);
  console.log(`Source File     : ${sqlFilePath}`);
  console.log(`File Size       : ${(fs.statSync(sqlFilePath).size / 1024).toFixed(2)} KB`);
  console.log('=============================================================\n');

  const startTime = Date.now();
  await executeSqlRestore(sqlFilePath, targetDb);
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log(`\n✅ [Restore Complete] Database '${targetDb}' restored successfully in ${duration}s.`);

  // Verify the restored data
  await verifyRestoredDatabase(targetDb);

  console.log('\n=============================================================');
  console.log('🎉 RESTORE & INTEGRITY VERIFICATION FINISHED SUCCESSFULLY!');
  console.log('=============================================================\n');
}

if (require.main === module) {
  require('dotenv').config();
  main().catch(err => {
    console.error('\n❌ Fatal Restore Error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  executeSqlRestore,
  verifyRestoredDatabase,
  downloadFromS3,
  listLocalBackups,
  listS3Backups
};
