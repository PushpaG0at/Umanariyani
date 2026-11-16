require('dotenv').config();
const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');
const app = require('../server');
const { generateTotpSecret, computeTotpCode } = require('../services/totpService');

const SESSION_SECRET = process.env.SESSION_SECRET || 'umanarayani_sacred_ayurveda_jwt_secret_2026_salt';

function makeRequest(baseUrl, path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runAdminSecurityTests() {
  console.log('=============================================================');
  console.log('🛡️ UMANARAYANI ADMIN SECURITY & BYPASS REMOVAL TESTS');
  console.log('=============================================================\n');

  const testServer = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} - ${err.message}`);
      failed++;
    }
  }

  try {
    // 1. Prove x-admin-key header is REJECTED
    await test('Request with x-admin-key header is REJECTED with 403', async () => {
      const res = await makeRequest(baseUrl, '/api/admin/reconciliation/pending-utr', 'GET', null, {
        'x-admin-key': 'umanarayani_admin_secret_key_2026'
      });
      assert.strictEqual(res.statusCode, 403, `Expected 403 Forbidden, got ${res.statusCode}`);
      assert.strictEqual(res.data?.success, false);
    });

    // 2. Unauthenticated request to admin route is REJECTED
    await test('Unauthenticated request to /api/admin/reconciliation/pending-utr is REJECTED with 403', async () => {
      const res = await makeRequest(baseUrl, '/api/admin/reconciliation/pending-utr', 'GET');
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data?.success, false);
    });

    // 3. Regular non-admin user JWT is REJECTED
    await test('Regular user JWT session is REJECTED from admin routes with 403', async () => {
      const regularUserToken = jwt.sign(
        { id: 'usr_reg_123', email: 'regular_patron@example.com', role: 'user' },
        SESSION_SECRET,
        { expiresIn: '1h' }
      );
      const res = await makeRequest(baseUrl, '/api/admin/reconciliation/pending-utr', 'GET', null, {
        'Authorization': `Bearer ${regularUserToken}`
      });
      assert.strictEqual(res.statusCode, 403);
    });

    // 4. Authenticated admin with TOTP session is ACCEPTED
    await test('Authenticated admin session with totpVerified: true is ACCEPTED with 200', async () => {
      const adminToken = jwt.sign(
        { id: 'usr_admin_test', email: 'raoa6526@gmail.com', role: 'admin', totpVerified: true },
        SESSION_SECRET,
        { expiresIn: '1h' }
      );
      const res = await makeRequest(baseUrl, '/api/admin/reconciliation/pending-utr', 'GET', null, {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
      assert.strictEqual(res.data?.success, true);
    });

    // 5. Verify First-Time Admin TOTP Enrollment flow
    await test('First-time admin login prompts for TOTP setup and generates secret/URI', async () => {
      const testAdminEmail = `enroll_admin_${Date.now()}@umanarayni.com`;
      const testPassword = 'AdminSecurePassword2026!';
      const hashedPassword = await bcrypt.hash(testPassword, 10);
      const testAdminId = `adm_${Date.now()}`;

      // Insert admin user into database without TOTP enabled
      await db.query(`
        INSERT INTO users (id, name, email, password, role, is_verified, totp_enabled)
        VALUES (?, 'Enrollment Admin', ?, ?, 'admin', 1, 0)
      `, [testAdminId, testAdminEmail, hashedPassword]);

      try {
        // Step 1: Login with password - should require TOTP setup
        const step1 = await makeRequest(baseUrl, '/api/admin/login', 'POST', {
          email: testAdminEmail,
          password: testPassword
        });

        assert.strictEqual(step1.statusCode, 200);
        assert.strictEqual(step1.data?.requireTotpSetup, true, 'Should require TOTP setup for new admin');
        assert.ok(step1.data?.secret, 'Should return base32 TOTP secret');
        assert.ok(step1.data?.uri, 'Should return otpauth URI');

        const secret = step1.data.secret;
        const currentOtp = computeTotpCode(secret);

        // Step 2: Confirm setup with initial 6-digit TOTP code
        const step2 = await makeRequest(baseUrl, '/api/admin/login', 'POST', {
          email: testAdminEmail,
          password: testPassword,
          totpToken: currentOtp,
          setupConfirmed: true
        });

        assert.strictEqual(step2.statusCode, 200);
        assert.strictEqual(step2.data?.success, true);
        assert.ok(step2.data?.token, 'Should issue authenticated admin session token');

        // Verify in DB that totp_enabled is now 1
        const [rows] = await db.query('SELECT totp_enabled FROM users WHERE id = ?', [testAdminId]);
        assert.strictEqual(rows[0].totp_enabled, 1, 'totp_enabled should be updated to 1');
      } finally {
        await db.query('DELETE FROM users WHERE id = ?', [testAdminId]);
      }
    });

  } finally {
    testServer.close();
  }

  console.log('\n=============================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runAdminSecurityTests().catch(err => {
    console.error('Fatal Admin Security Test Error:', err);
    process.exit(1);
  });
}

module.exports = { runAdminSecurityTests };
