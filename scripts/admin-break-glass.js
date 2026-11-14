#!/usr/bin/env node
/**
 * UMANARAYNI AYURVEDA — EMERGENCY BREAK-GLASS ADMIN RECOVERY SCRIPT
 * Usage:
 *   node scripts/admin-break-glass.js status
 *   node scripts/admin-break-glass.js reset-totp <admin-email>
 *   node scripts/admin-break-glass.js issue-token <admin-email>
 *
 * This utility runs locally on the host server (EC2) with direct access to MySQL.
 * All break-glass actions are recorded to the admin_audit_logs table.
 */

require('dotenv').config();
const jwt = require('jsonwebtoken');
const db = require('../db');
const { generateTotpSecret, generateTotpUri, computeTotpCode } = require('../services/totpService');

const SESSION_SECRET = process.env.SESSION_SECRET || 'umanarayani_sacred_ayurveda_jwt_secret_2026_salt';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';
  const targetEmail = args[1] ? args[1].trim().toLowerCase() : '';

  console.log('\n======================================================');
  console.log('   UMANARAYNI AYURVEDA — ADMIN BREAK-GLASS RECOVERY   ');
  console.log('======================================================\n');

  try {
    await db.testConnection();
    const adminEmails = db.getAdminEmails();

    if (command === 'status') {
      console.log('Designated Admin Emails (from ADMIN_EMAIL env):');
      adminEmails.forEach(e => console.log(` - ${e}`));

      const [users] = await db.query(
        'SELECT id, name, email, role, totp_enabled, is_verified FROM users WHERE role = "admin" OR LOWER(email) IN (?)',
        [adminEmails]
      );

      console.log('\nRegistered Admin Accounts in Database:');
      if (users.length === 0) {
        console.log(' (No admin accounts found in database. Create or register an admin account first)');
      } else {
        users.forEach(u => {
          console.log(` - ID: ${u.id} | Name: ${u.name} | Email: ${u.email} | 2FA Enabled: ${u.totp_enabled ? 'YES' : 'NO'}`);
        });
      }
      console.log('\nCommands available:');
      console.log('  node scripts/admin-break-glass.js reset-totp <email>');
      console.log('  node scripts/admin-break-glass.js issue-token <email>\n');
      process.exit(0);
    }

    if (!targetEmail) {
      console.error('Error: Please provide a target admin email address.');
      console.error('Example: node scripts/admin-break-glass.js reset-totp admin@umanarayni.com');
      process.exit(1);
    }

    const [userRows] = await db.query('SELECT * FROM users WHERE LOWER(email) = LOWER(?)', [targetEmail]);
    if (userRows.length === 0) {
      console.error(`Error: User with email "${targetEmail}" does not exist in database.`);
      process.exit(1);
    }
    const adminUser = userRows[0];

    if (command === 'reset-totp') {
      const newSecret = generateTotpSecret(20);
      const uri = generateTotpUri(adminUser.email, newSecret);
      const currentCode = computeTotpCode(newSecret);

      await db.query(
        'UPDATE users SET totp_secret = ?, totp_enabled = TRUE, role = "admin" WHERE id = ?',
        [newSecret, adminUser.id]
      );

      // Record break-glass in audit logs
      try {
        await db.recordAdminAuditLog({
          adminId: adminUser.id,
          adminEmail: adminUser.email,
          action: 'BREAK_GLASS_TOTP_RESET',
          resourceType: 'admin_account',
          resourceId: String(adminUser.id),
          details: { reason: 'CLI break-glass invocation by server operator' }
        });
      } catch (_) {}

      console.log(`[SUCCESS] TOTP 2FA secret reset successfully for: ${adminUser.email}`);
      console.log(`\nNew Base32 Secret: ${newSecret}`);
      console.log(`Authenticator Setup URI:\n${uri}`);
      console.log(`\nCurrent 30-Second Verification Code: [ ${currentCode} ]`);
      console.log('\nAdd this secret to your Google Authenticator or 1Password app to resume login.\n');
      process.exit(0);
    }

    if (command === 'issue-token') {
      const emergencyToken = jwt.sign(
        {
          id: adminUser.id,
          name: adminUser.name,
          email: adminUser.email,
          role: 'admin',
          isAdmin: true,
          breakGlass: true
        },
        SESSION_SECRET,
        { expiresIn: '15m' }
      );

      try {
        await db.recordAdminAuditLog({
          adminId: adminUser.id,
          adminEmail: adminUser.email,
          action: 'BREAK_GLASS_EMERGENCY_SESSION_ISSUED',
          resourceType: 'admin_account',
          resourceId: String(adminUser.id),
          details: { validMinutes: 15, reason: 'CLI emergency session issued' }
        });
      } catch (_) {}

      console.log(`[SUCCESS] Emergency 15-Minute Admin Session Token Issued for: ${adminUser.email}`);
      console.log('\nBearer Token:\n');
      console.log(emergencyToken);
      console.log('\nYou can set this token as a cookie (umanarayni_auth) or Authorization header to access /admin.html.\n');
      process.exit(0);
    }

    console.error(`Unknown command: ${command}`);
    process.exit(1);
  } catch (err) {
    console.error('Break-glass recovery execution error:', err.message);
    process.exit(1);
  }
}

main();
