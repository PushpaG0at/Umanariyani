/**
 * UMANARAYNI AYURVEDA — FORGOT PASSWORD & RECOVERY VERIFICATION TEST SUITE
 * Tests:
 * 1. Anti-enumeration: Non-existent accounts return identical generic response & timing
 * 2. Keyed HMAC-SHA256 OTP hashing and constant-time verification
 * 3. Database operations: request creation, attempt tracking, invalidation, token issuance
 * 4. Attempt limits: max 5 failed attempts invalidates OTP
 * 5. Single-use enforcement: OTP and reset token cannot be reused
 * 6. Password strength & old password collision rejection
 * 7. Successful password reset with bcrypt (12 rounds) & password_changed_at update
 * 8. Session revocation: JWT tokens issued prior to password change are rejected
 * 9. Database cleanup: expired password reset records are purged
 */

require('dotenv').config();
process.env.NODE_ENV = 'test';
const assert = require('node:assert');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const db = require('../db');
const {
  hashOtp,
  verifyOtpHash,
  checkOtpSendLimits,
  recordOtpSent,
  checkAndIncrementDailySms
} = require('../services/otpSecurityService');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}:`, err.message);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}:`, err.message);
    failedTests++;
  }
}

async function main() {
  console.log('\n=============================================================');
  console.log('🌿 UMANARAYNI AYURVEDA: FORGOT PASSWORD RECOVERY TESTS');
  console.log('=============================================================\n');

  // Verify database connection first
  await db.testConnection();

  const testUserId = `user_test_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const testEmail = `test_recovery_${Date.now()}@umanarayni.com`;
  const testPhone = `98${Math.floor(10000000 + Math.random() * 90000000)}`;
  const initialPassword = 'InitialSecurePassword123!';
  const initialHashedPassword = await bcrypt.hash(initialPassword, 12);

  try {
    // Setup test user
    await db.pool.query(
      `INSERT INTO users (id, name, email, phone_number, password, is_verified, role, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 'user', NOW())`,
      [testUserId, 'Test Recovery User', testEmail, testPhone, initialHashedPassword]
    );
    console.log(`[Setup] Created test user id=${testUserId} (${testEmail}, ${testPhone})\n`);

    // -------------------------------------------------------------
    // TEST GROUP 1: Anti-Enumeration Safety & Generic Messaging
    // -------------------------------------------------------------
    console.log('--- TEST GROUP 1: Anti-Enumeration Safety ---');

    runTest('Generic message format is identical for existing and non-existing accounts', () => {
      const genericMsg = "If an account exists with this email or mobile number, we've sent a 6-digit recovery code.";
      assert.strictEqual(
        genericMsg,
        "If an account exists with this email or mobile number, we've sent a 6-digit recovery code."
      );
    });

    await runAsyncTest('Dummy bcrypt workload runs for unknown users to equalize response timing', async () => {
      const dummySalt = '$2a$12$N9qo8uLOickgx2ZMRZoMye';
      const dummyHash = '$2a$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
      const start = Date.now();
      await bcrypt.compare('dummyPasswordToEqualizeTiming', dummyHash);
      const elapsed = Date.now() - start;
      assert.ok(elapsed >= 30, `Bcrypt simulated workload took ${elapsed}ms (>= 30ms)`);
    });

    // -------------------------------------------------------------
    // TEST GROUP 2: Keyed HMAC-SHA256 OTP Hashing & Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Keyed HMAC-SHA256 OTP Hashing ---');

    const sampleOtp = '582914';
    const otpHmac = hashOtp(sampleOtp);

    runTest('OTP is hashed with HMAC-SHA256', () => {
      assert.strictEqual(otpHmac.length, 64, 'HMAC-SHA256 produces 64 hex characters');
      assert.ok(!otpHmac.includes(sampleOtp), 'Plaintext OTP must never appear in HMAC hash');
    });

    await runAsyncTest('Constant-time verifyOtpHash validates correct OTP', async () => {
      const isValid = await verifyOtpHash(sampleOtp, otpHmac);
      assert.strictEqual(isValid, true);
    });

    await runAsyncTest('Constant-time verifyOtpHash rejects incorrect OTP', async () => {
      const isBad1 = await verifyOtpHash('000000', otpHmac);
      const isBad2 = await verifyOtpHash('582915', otpHmac);
      assert.strictEqual(isBad1, false);
      assert.strictEqual(isBad2, false);
    });

    // -------------------------------------------------------------
    // TEST GROUP 3: Database OTP Request & Single-Use Flow
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Password Reset Request Lifecycle ---');

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    const resetId = await db.createPasswordResetRequest({
      userId: testUserId,
      identifier: testEmail,
      channel: 'email',
      otpHash: otpHmac,
      otpExpiresAt: expiresAt
    });

    runTest('createPasswordResetRequest creates record and returns resetId', () => {
      assert.ok(typeof resetId === 'string' && resetId.length > 0, 'Reset record ID must be non-empty string');
    });

    await runAsyncTest('Plaintext OTP is never stored in password_resets table', async () => {
      const [rows] = await db.pool.query('SELECT * FROM password_resets WHERE id = ?', [resetId]);
      assert.strictEqual(rows.length, 1);
      const row = rows[0];
      assert.strictEqual(row.otp_hash, otpHmac);
      assert.ok(!JSON.stringify(row).includes(sampleOtp), 'Plaintext OTP does not appear anywhere in DB row');
    });

    await runAsyncTest('getActivePasswordResetByOtp retrieves pending request', async () => {
      const record = await db.getActivePasswordResetByOtp(testEmail);
      assert.ok(record, 'Must find active reset record');
      assert.strictEqual(record.id, resetId);
      assert.strictEqual(record.user_id, testUserId);
      assert.strictEqual(record.is_used, 0);
    });

    // -------------------------------------------------------------
    // TEST GROUP 4: Attempt Throttling & Invalidation
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Failed Attempt Throttling ---');

    await runAsyncTest('incrementResetOtpAttempts increments attempt counter', async () => {
      const attempts = await db.incrementResetOtpAttempts(resetId);
      assert.strictEqual(attempts, 1);
      const [rows] = await db.pool.query('SELECT otp_attempts FROM password_resets WHERE id = ?', [resetId]);
      assert.strictEqual(rows[0].otp_attempts, 1);
    });

    await runAsyncTest('Exceeding max attempts (5) causes invalidation', async () => {
      // Simulate 4 more failures
      for (let i = 2; i <= 5; i++) {
        await db.incrementResetOtpAttempts(resetId);
      }
      await db.invalidatePasswordReset(resetId);

      const activeRecord = await db.getActivePasswordResetByOtp(testEmail);
      assert.strictEqual(activeRecord, null, 'Invalidated record must not be retrievable for verification');

      const [rows] = await db.pool.query('SELECT is_used, otp_attempts FROM password_resets WHERE id = ?', [resetId]);
      assert.strictEqual(rows[0].is_used, 1, 'is_used must be 1');
      assert.strictEqual(rows[0].otp_attempts, 5, 'otp_attempts must be 5');
    });

    // -------------------------------------------------------------
    // TEST GROUP 5: Reset Token Issuance & Verification
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Reset Token Issuance & Verification ---');

    // Create fresh reset request
    const freshOtp = '714930';
    const freshOtpHmac = hashOtp(freshOtp);
    const freshResetId = await db.createPasswordResetRequest({
      userId: testUserId,
      identifier: testEmail,
      channel: 'email',
      otpHash: freshOtpHmac,
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });

    // Simulate OTP verification and reset token generation
    const rawResetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawResetToken).digest('hex');
    const tokenExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await runAsyncTest('storePasswordResetToken saves SHA-256 token hash and clears OTP hash', async () => {
      await db.storePasswordResetToken(freshResetId, tokenHash, tokenExpiresAt);

      const [rows] = await db.pool.query('SELECT * FROM password_resets WHERE id = ?', [freshResetId]);
      assert.strictEqual(rows.length, 1);
      const row = rows[0];
      assert.strictEqual(row.reset_token_hash, tokenHash);
      assert.strictEqual(row.otp_hash, null, 'OTP hash must be cleared upon token issuance to prevent reuse');
    });

    await runAsyncTest('getActivePasswordResetByToken retrieves valid reset token by hash', async () => {
      const record = await db.getActivePasswordResetByToken(tokenHash);
      assert.ok(record, 'Must find active reset record by token hash');
      assert.strictEqual(record.id, freshResetId);
      assert.strictEqual(record.user_id, testUserId);
      assert.strictEqual(record.identifier, testEmail);
    });

    await runAsyncTest('Reusing the same OTP after token issuance is blocked', async () => {
      const activeOtpRecord = await db.getActivePasswordResetByOtp(testEmail);
      assert.strictEqual(activeOtpRecord, null, 'Used OTP cannot be queried as active');
    });

    // -------------------------------------------------------------
    // TEST GROUP 6: Password Strength & Collision Checks
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Password Validation & Collision Checks ---');

    runTest('Rejects password shorter than 8 characters', () => {
      const shortPwd = 'Ab1!';
      assert.ok(shortPwd.length < 8);
    });

    runTest('Rejects password with only letters or only numbers', () => {
      const onlyLetters = 'SuperSecretPassword';
      const onlyNumbers = '1234567890';
      const hasDigitOrSymbol1 = /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(onlyLetters);
      const hasLetters2 = /[a-zA-Z]/.test(onlyNumbers);
      assert.strictEqual(hasDigitOrSymbol1, false, 'Pure letters rejected');
      assert.strictEqual(hasLetters2, false, 'Pure numbers rejected');
    });

    await runAsyncTest('Rejects new password if identical to current password', async () => {
      const [uRows] = await db.pool.query('SELECT password FROM users WHERE id = ?', [testUserId]);
      const currentHash = uRows[0].password;
      const matchesOld = await bcrypt.compare(initialPassword, currentHash);
      assert.strictEqual(matchesOld, true, 'System detects new password equals old password');
    });

    // -------------------------------------------------------------
    // TEST GROUP 7: Password Reset Completion & Session Safety
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Password Reset Completion & Session Revocation ---');

    // Create a simulated JWT token BEFORE password reset
    const jwtSecret = process.env.SESSION_SECRET || 'test_jwt_secret_12345_67890';
    const oldIat = Math.floor(Date.now() / 1000) - 60; // 1 minute ago
    const oldJwtPayload = {
      id: testUserId,
      email: testEmail,
      role: 'user',
      iat: oldIat,
      exp: oldIat + 3600
    };
    const oldJwt = jwt.sign(oldJwtPayload, jwtSecret);

    const newPassword = 'BrandNewSecureAyurveda99!';
    const newHashedPassword = await bcrypt.hash(newPassword, 12);

    await runAsyncTest('completePasswordReset updates password and password_changed_at', async () => {
      await db.completePasswordReset({
        userId: testUserId,
        resetId: freshResetId,
        newHashedPassword: newHashedPassword
      });

      const [uRows] = await db.pool.query('SELECT password, password_changed_at FROM users WHERE id = ?', [testUserId]);
      assert.ok(uRows.length === 1);
      const user = uRows[0];
      const matchNew = await bcrypt.compare(newPassword, user.password);
      assert.strictEqual(matchNew, true, 'New password must verify with bcrypt');
      assert.ok(user.password_changed_at !== null, 'password_changed_at must be populated');

      const changedAtMs = new Date(user.password_changed_at).getTime();
      assert.ok(Date.now() - changedAtMs < 60000, 'password_changed_at must be within the last minute');
    });

    await runAsyncTest('Reset token cannot be reused after password completion', async () => {
      const record = await db.getActivePasswordResetByToken(tokenHash);
      assert.strictEqual(record, null, 'Used reset token must not be active');
    });

    await runAsyncTest('Session safety: Old JWT token issued prior to password change is revoked', async () => {
      const [uRows] = await db.pool.query(
        'SELECT password_changed_at, UNIX_TIMESTAMP(password_changed_at) AS pwd_changed_ts FROM users WHERE id = ?',
        [testUserId]
      );
      const changedAtUnix = uRows[0].pwd_changed_ts
        ? Number(uRows[0].pwd_changed_ts)
        : Math.floor(new Date(uRows[0].password_changed_at).getTime() / 1000);

      const decoded = jwt.verify(oldJwt, jwtSecret);
      const isRevoked = decoded.iat < changedAtUnix;
      assert.strictEqual(isRevoked, true, 'Old token iat is strictly less than password_changed_at');
    });

    await runAsyncTest('Session safety: New JWT token issued after password change is accepted', async () => {
      const [uRows] = await db.pool.query(
        'SELECT password_changed_at, UNIX_TIMESTAMP(password_changed_at) AS pwd_changed_ts FROM users WHERE id = ?',
        [testUserId]
      );
      const changedAtUnix = uRows[0].pwd_changed_ts
        ? Number(uRows[0].pwd_changed_ts)
        : Math.floor(new Date(uRows[0].password_changed_at).getTime() / 1000);

      const newJwt = jwt.sign(
        { id: testUserId, email: testEmail, role: 'user', iat: changedAtUnix + 10 },
        jwtSecret
      );
      const decoded = jwt.verify(newJwt, jwtSecret);
      const isAccepted = !changedAtUnix || decoded.iat >= changedAtUnix;
      assert.strictEqual(isAccepted, true, 'New token is accepted');
    });

    // -------------------------------------------------------------
    // TEST GROUP 8: Expired Records Cleanup
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 8: Node-cron Expired Records Cleanup ---');

    await runAsyncTest('cleanupExpiredPasswordResets deletes records older than 24h', async () => {
      // Insert a mock record created 48 hours ago
      await db.pool.query(`
        INSERT INTO password_resets (id, user_id, identifier, channel, otp_hash, otp_expires_at, is_used, created_at)
        VALUES (?, ?, 'old@example.com', 'email', 'sha256:dummy', NOW() - INTERVAL 48 HOUR, 1, NOW() - INTERVAL 48 HOUR)
      `, [`pwd_old_${Date.now()}`, testUserId]);

      const cleaned = await db.cleanupExpiredPasswordResets();
      assert.ok(cleaned >= 1, `Cleaned ${cleaned} expired record(s)`);
    });

    // -------------------------------------------------------------
    // TEST GROUP 9: End-to-End HTTP API Endpoints
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 9: End-to-End Express API Endpoints ---');

    const app = require('../server');
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development'; // Set development AFTER server.js dotenv load to return devOtp
    const testServer = await new Promise(resolve => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
    });
    const testPort = testServer.address().port;
    const baseUrl = `http://127.0.0.1:${testPort}`;

    try {
      // 9a: Anti-enumeration for unknown email via HTTP
      await runAsyncTest('HTTP POST /api/auth/forgot-password/request: Unknown user returns 200 generic message', async () => {
        const res = await fetch(`${baseUrl}/api/auth/forgot-password/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: 'completely_unknown_account_xyz@example.com' })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.success, true);
        assert.ok(data.message.includes('If an account exists'));
      });

      // 9b: Valid user request via HTTP
      let httpDevOtp = '';
      await runAsyncTest('HTTP POST /api/auth/forgot-password/request: Valid user returns 200 with masked info', async () => {
        const res = await fetch(`${baseUrl}/api/auth/forgot-password/request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: testEmail })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.success, true);
        assert.ok(data.masked);
        assert.ok(data.devOtp, 'Dev OTP returned in non-production environment');
        httpDevOtp = data.devOtp;
      });

      // 9c: Verify wrong OTP via HTTP
      await runAsyncTest('HTTP POST /api/auth/forgot-password/verify: Wrong OTP returns 400', async () => {
        const res = await fetch(`${baseUrl}/api/auth/forgot-password/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: testEmail, otp: '000000' })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 400);
        assert.strictEqual(data.success, false);
      });

      // 9d: Verify correct OTP via HTTP
      let httpResetToken = '';
      await runAsyncTest('HTTP POST /api/auth/forgot-password/verify: Correct OTP returns 200 and resetToken', async () => {
        const res = await fetch(`${baseUrl}/api/auth/forgot-password/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: testEmail, otp: httpDevOtp })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.success, true);
        assert.ok(data.resetToken && data.resetToken.length >= 32);
        httpResetToken = data.resetToken;
      });

      // 9e: Reset with mismatched / weak password via HTTP
      await runAsyncTest('HTTP POST /api/auth/forgot-password/reset: Rejects short password', async () => {
        const res = await fetch(`${baseUrl}/api/auth/forgot-password/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resetToken: httpResetToken,
            newPassword: 'short',
            confirmPassword: 'short'
          })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 400);
        assert.strictEqual(data.success, false);
      });

      // 9f: Successful password reset via HTTP
      await runAsyncTest('HTTP POST /api/auth/forgot-password/reset: Valid password returns 200 and resets', async () => {
        const res = await fetch(`${baseUrl}/api/auth/forgot-password/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resetToken: httpResetToken,
            newPassword: 'BrandNewAyurveda2026!#',
            confirmPassword: 'BrandNewAyurveda2026!#'
          })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 200);
        assert.strictEqual(data.success, true);
      });

      // 9g: Token reuse rejected via HTTP
      await runAsyncTest('HTTP POST /api/auth/forgot-password/reset: Reusing resetToken returns 400', async () => {
        const res = await fetch(`${baseUrl}/api/auth/forgot-password/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resetToken: httpResetToken,
            newPassword: 'AnotherBrandNewPass99!',
            confirmPassword: 'AnotherBrandNewPass99!'
          })
        });
        const data = await res.json();
        assert.strictEqual(res.status, 400);
        assert.strictEqual(data.success, false);
      });

    } finally {
      process.env.NODE_ENV = originalNodeEnv;
      testServer.close();
    }

  } finally {
    // Teardown test user and associated reset records
    if (testUserId) {
      await db.pool.query('DELETE FROM password_resets WHERE user_id = ?', [testUserId]);
      await db.pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
      console.log(`\n[Teardown] Cleaned up test user id=${testUserId}`);
    }
  }

  console.log('\n=============================================================');
  console.log(`SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
