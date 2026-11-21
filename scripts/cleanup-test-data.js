/**
 * ==============================================================================
 * UMANARAYNI AYURVEDA — SAFE TEST DATA CLEANUP UTILITY
 * ==============================================================================
 * 
 * SAFETY GUARDS:
 * 1. DRY-RUN BY DEFAULT: Lists all candidate test users, test orders, and test
 *    records without deleting anything.
 * 2. Requires --execute to enable real deletion.
 * 3. Requires --confirm="DELETE_TEST_DATA" argument.
 * 4. Requires --force if the total number of records to delete exceeds 50.
 * 5. ALWAYS triggers an automated database backup (runBackup()) before deleting.
 * 6. Hard-coded exclusion of all ADMIN_EMAIL addresses so admin accounts can
 *    never be deleted.
 * ==============================================================================
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { runBackup } = require('./backup');

async function cleanupTestData() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const confirmArg = args.find(a => a.startsWith('--confirm='));
  const confirmVal = confirmArg ? confirmArg.split('=')[1].replace(/["']/g, '') : '';
  const isForce = args.includes('--force');

  console.log('================================================================');
  console.log('🧹 UMANARAYNI AYURVEDA — TEST DATA CLEANUP UTILITY');
  console.log('================================================================');
  console.log(`Mode: ${isExecute ? '⚠️ LIVE EXECUTION' : '🔍 DRY RUN (Default - No records will be deleted)'}`);

  // 1. Establish database connection
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'umanarayani',
    waitForConnections: true,
    connectionLimit: 5
  });

  try {
    // 2. Identify protected admin emails
    const adminEmailsRaw = process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS || 'admin@umanarayni.com,raoa6526@gmail.com,singhpushpendra95734@gmail.com';
    const protectedEmails = adminEmailsRaw
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    console.log(`🔒 Protected Administrator Accounts (${protectedEmails.length} emails excluded from cleanup)`);

    // 3. Scan for candidate test records
    // Test users
    const [testUsers] = await pool.query(`
      SELECT id, name, email, created_at 
      FROM users 
      WHERE (
        email LIKE '%@test.com' 
        OR email LIKE '%@example.com' 
        OR email LIKE '%tester%' 
        OR email LIKE '%audit_test%' 
        OR id LIKE 'test_%' 
        OR id LIKE 'audit_test_%'
      )
    `);
    const candidateUsers = testUsers.filter(u => !protectedEmails.includes((u.email || '').toLowerCase()));

    // Test orders
    const [testOrders] = await pool.query(`
      SELECT id, customerName, customerEmail, total, orderStatus, created_at 
      FROM orders 
      WHERE (
        customerEmail LIKE '%@test.com' 
        OR customerEmail LIKE '%@example.com' 
        OR customerEmail LIKE '%tester%' 
        OR customerEmail LIKE '%audit_test%' 
        OR id LIKE 'test_%' 
        OR id LIKE 'audit_test_%'
        OR id LIKE 'ord_test_%'
        OR orderStatus = 'Test'
      )
    `);
    const candidateOrders = testOrders.filter(o => !protectedEmails.includes((o.customerEmail || '').toLowerCase()));

    // Test password resets
    const [candidateResets] = await pool.query(`
      SELECT id, user_id, identifier, channel, created_at 
      FROM password_resets 
      WHERE (
        identifier LIKE '%@test.com' 
        OR identifier LIKE '%@example.com' 
        OR identifier LIKE '%tester%'
        OR identifier LIKE '%audit_test%'
      )
    `);

    // Test promo codes
    const [candidatePromos] = await pool.query(`
      SELECT code, value, created_at 
      FROM promo_codes 
      WHERE code LIKE 'TEST%'
    `);

    const totalCandidateRows = candidateUsers.length + candidateOrders.length + candidateResets.length + candidatePromos.length;

    console.log('\n📊 Candidate Test Records Identified:');
    console.log(`   - Candidate Test Users:          ${candidateUsers.length}`);
    console.log(`   - Candidate Test Orders:         ${candidateOrders.length}`);
    console.log(`   - Candidate Test Password Resets: ${candidateResets.length}`);
    console.log(`   - Candidate Test Promo Codes:    ${candidatePromos.length}`);
    console.log(`   -------------------------------------------------`);
    console.log(`   Total Identified Test Rows:      ${totalCandidateRows}\n`);

    if (candidateUsers.length > 0) {
      console.log('👤 Sample Test Users:');
      candidateUsers.slice(0, 5).forEach(u => {
        console.log(`   • [${u.id}] ${u.name} <${u.email}> (${new Date(u.created_at).toISOString()})`);
      });
      if (candidateUsers.length > 5) console.log(`   ... and ${candidateUsers.length - 5} more.`);
    }

    if (candidateOrders.length > 0) {
      console.log('\n📦 Sample Test Orders:');
      candidateOrders.slice(0, 5).forEach(o => {
        console.log(`   • [${o.id}] ${o.customerName} <${o.customerEmail}> ₹${o.total} [${o.orderStatus}]`);
      });
      if (candidateOrders.length > 5) console.log(`   ... and ${candidateOrders.length - 5} more.`);
    }

    // 4. DRY RUN EXIT
    if (!isExecute) {
      console.log('\n----------------------------------------------------------------');
      console.log('✅ DRY RUN COMPLETE: 0 records were deleted.');
      console.log('----------------------------------------------------------------');
      console.log('To execute real deletion, you must run with exact safety flags:');
      console.log('  node scripts/cleanup-test-data.js --execute --confirm="DELETE_TEST_DATA"');
      if (totalCandidateRows > 50) {
        console.log('  (Notice: Over 50 rows detected. You must also include the --force flag)');
      }
      return;
    }

    // 5. LIVE EXECUTION VALIDATION
    if (confirmVal !== 'DELETE_TEST_DATA') {
      console.error('\n🚫 EXECUTION ABORTED: Invalid or missing confirmation string.');
      console.error('   Expected: --confirm="DELETE_TEST_DATA"');
      console.error(`   Received: "${confirmVal}"`);
      process.exit(1);
    }

    if (totalCandidateRows > 50 && !isForce) {
      console.error(`\n🚫 EXECUTION ABORTED: Deletion would affect ${totalCandidateRows} records (> 50 threshold).`);
      console.error('   To proceed with deleting more than 50 rows, specify the --force flag:');
      console.error('   node scripts/cleanup-test-data.js --execute --confirm="DELETE_TEST_DATA" --force');
      process.exit(1);
    }

    if (totalCandidateRows === 0) {
      console.log('\n✨ Database is already clean. 0 test records to delete.');
      return;
    }

    // 6. TRIGGER MANDATORY PRE-CLEANUP BACKUP
    console.log('\n📦 SAFETY GUARD: Triggering automated database backup before cleanup...');
    const backupResult = await runBackup();
    console.log(`✅ Pre-cleanup backup completed: ${backupResult.filename}`);

    // 7. PERFORM ATOMIC DELETION
    console.log('\n🗑️ Executing test data deletion in database...');
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let deletedResets = 0;
      if (candidateResets.length > 0) {
        const resetIds = candidateResets.map(r => r.id);
        const [res] = await conn.query('DELETE FROM password_resets WHERE id IN (?)', [resetIds]);
        deletedResets = res.affectedRows;
      }

      let deletedOrders = 0;
      if (candidateOrders.length > 0) {
        const orderIds = candidateOrders.map(o => o.id);
        const [res] = await conn.query('DELETE FROM orders WHERE id IN (?)', [orderIds]);
        deletedOrders = res.affectedRows;
      }

      let deletedUsers = 0;
      if (candidateUsers.length > 0) {
        const userIds = candidateUsers.map(u => u.id);
        const [res] = await conn.query('DELETE FROM users WHERE id IN (?)', [userIds]);
        deletedUsers = res.affectedRows;
      }

      let deletedPromos = 0;
      if (candidatePromos.length > 0) {
        const promoCodes = candidatePromos.map(p => p.code);
        const [res] = await conn.query('DELETE FROM promo_codes WHERE code IN (?)', [promoCodes]);
        deletedPromos = res.affectedRows;
      }

      await conn.commit();

      console.log('\n🎉 CLEANUP COMPLETED SUCCESSFULLY:');
      console.log(`   - Deleted Users:          ${deletedUsers}`);
      console.log(`   - Deleted Orders:         ${deletedOrders}`);
      console.log(`   - Deleted Password Resets: ${deletedResets}`);
      console.log(`   - Deleted Promo Codes:    ${deletedPromos}`);
      console.log(`   Total Rows Removed:       ${deletedUsers + deletedOrders + deletedResets + deletedPromos}`);
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  cleanupTestData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ Cleanup Failed:', err);
      process.exit(1);
    });
}

module.exports = { cleanupTestData };
