/**
 * UMANARAYNI AYURVEDA — Low-Friction Bot Protection & Turnstile Bypass Test Suite
 * 
 * Verifies:
 * 1. HMAC-SHA256 signature generation and constant-time validation of human_verified token.
 * 2. Token expiration enforcement and tamper detection.
 * 3. Session binding: Prevents presenting a token bound to a different authenticated user.
 * 4. Guest checkout with valid human_verified cookie skips Turnstile challenge.
 * 5. Logged-in checkout with active session skips Turnstile challenge.
 * 6. Guest checkout with no cookie and no token returns 403 BOT_VERIFICATION_REQUIRED.
 * 7. Guest checkout with valid Turnstile token succeeds and issues human_verified cookie.
 * 8. High-risk endpoints (register, login, forgot-password) strictly require fresh Turnstile tokens.
 * 9. Repeated verification failures or rate limit violations flag client risk and force re-challenge.
 */

require('dotenv').config();
const http = require('node:http');
const crypto = require('node:crypto');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');

const {
  HUMAN_VERIFIED_COOKIE_NAME,
  signHumanVerificationToken,
  verifyHumanVerificationToken,
  issueHumanVerificationCookie,
  clearHumanVerificationCookie,
  flagClientRisk,
  isClientRiskFlagged,
  clearClientRisk,
  recordVerificationFailure,
  verifyCheckoutBotProtection
} = require('../services/humanVerificationService');

const app = require('../server');

let passedTests = 0;
let failedTests = 0;

function runSyncTest(name, fn) {
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

/**
 * Helper to make HTTP requests to the test server
 */
function makeRequest(server, method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const port = address.port;

    const reqHeaders = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...headers
    };

    const options = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: reqHeaders
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runAll() {
  console.log('\n=============================================================');
  console.log('🌿 UMANARAYNI AYURVEDA: LOW-FRICTION BOT DEFENSE TEST SUITE');
  console.log('=============================================================\n');

  // ==========================================
  // SECTION 1: UNIT & CRYPTO INTEGRITY TESTS
  // ==========================================
  console.log('--- 1. Token Signature & Verification Logic ---');

  let validGuestToken = '';
  let validUserToken = '';
  const testUserId = 'test_user_human_999';

  runSyncTest('Sign guest human verification token', () => {
    validGuestToken = signHumanVerificationToken();
    assert(typeof validGuestToken === 'string' && validGuestToken.includes('.'), 'Token must be header.signature string');
    const result = verifyHumanVerificationToken(validGuestToken);
    assert.strictEqual(result.valid, true, 'Token must verify successfully');
    assert.strictEqual(result.payload.userId, null, 'Guest token has null userId');
  });

  runSyncTest('Sign user-bound human verification token', () => {
    validUserToken = signHumanVerificationToken({ userId: testUserId });
    const result = verifyHumanVerificationToken(validUserToken, testUserId);
    assert.strictEqual(result.valid, true, 'User token must verify for matching userId');
    assert.strictEqual(result.payload.userId, testUserId, 'Payload userId matches');
  });

  runSyncTest('Reject expired human verification token', () => {
    const expiredToken = signHumanVerificationToken({ customTtlSec: -10 });
    const result = verifyHumanVerificationToken(expiredToken);
    assert.strictEqual(result.valid, false, 'Expired token must not be valid');
    assert.strictEqual(result.reason, 'token_expired', 'Reason should be token_expired');
  });

  runSyncTest('Reject tampered token payload or signature', () => {
    const parts = validGuestToken.split('.');
    const tamperedPayload = Buffer.from(JSON.stringify({ v: 1, userId: 'hacker', exp: 9999999999 })).toString('base64url');
    const tamperedToken = `${tamperedPayload}.${parts[1]}`;
    const result = verifyHumanVerificationToken(tamperedToken);
    assert.strictEqual(result.valid, false, 'Tampered token must be rejected');
    assert.strictEqual(result.reason, 'signature_mismatch', 'Reason should be signature_mismatch');
  });

  runSyncTest('Reject token bound to different user (session binding)', () => {
    const result = verifyHumanVerificationToken(validUserToken, 'different_user_123');
    assert.strictEqual(result.valid, false, 'Mismatched user token must be rejected');
    assert.strictEqual(result.reason, 'user_mismatch', 'Reason should be user_mismatch');
  });

  console.log('\n--- 2. Risk Tracking & Auto-Rechallenge State ---');

  const mockIpReq = { ip: '198.51.100.42', connection: { remoteAddress: '198.51.100.42' } };

  runSyncTest('Client starts in unflagged risk state', () => {
    clearClientRisk(mockIpReq);
    assert.strictEqual(isClientRiskFlagged(mockIpReq), false, 'Initial state is unflagged');
  });

  runSyncTest('Manual risk flagging marks client and is cleared cleanly', () => {
    flagClientRisk(mockIpReq, 'Test trigger');
    assert.strictEqual(isClientRiskFlagged(mockIpReq), true, 'Client should be flagged');
    clearClientRisk(mockIpReq);
    assert.strictEqual(isClientRiskFlagged(mockIpReq), false, 'Client should be cleared');
  });

  runSyncTest('3 consecutive verification failures automatically trigger risk flag', () => {
    clearClientRisk(mockIpReq);
    recordVerificationFailure(mockIpReq);
    assert.strictEqual(isClientRiskFlagged(mockIpReq), false, 'Failure 1 should not flag');
    recordVerificationFailure(mockIpReq);
    assert.strictEqual(isClientRiskFlagged(mockIpReq), false, 'Failure 2 should not flag');
    recordVerificationFailure(mockIpReq);
    assert.strictEqual(isClientRiskFlagged(mockIpReq), true, 'Failure 3 must flag risk');
    clearClientRisk(mockIpReq);
  });

  // ==========================================
  // SECTION 2: HTTP ENDPOINT INTEGRATION TESTS
  // ==========================================
  console.log('\n--- 3. HTTP Integration & Bot Status Verification ---');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const testPort = server.address().port;
  console.log(`  (Test server running on ephemeral port ${testPort})`);

  try {
    // 3a. GET /api/bot-verification-status for unverified guest
    await runAsyncTest('GET /api/bot-verification-status returns requiresChallenge: true for unverified guest', async () => {
      const res = await makeRequest(server, 'GET', '/api/bot-verification-status');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.verified, false);
      assert.strictEqual(res.data.requiresChallenge, true);
      assert(typeof res.data.siteKey === 'string', 'Must provide Turnstile siteKey for client widget');
    });

    // 3b. GET /api/bot-verification-status with valid human_verified cookie
    await runAsyncTest('GET /api/bot-verification-status returns verified: true with valid human_verified cookie', async () => {
      const token = signHumanVerificationToken();
      const res = await makeRequest(server, 'GET', '/api/bot-verification-status', null, {
        Cookie: `${HUMAN_VERIFIED_COOKIE_NAME}=${token}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.verified, true);
      assert.strictEqual(res.data.requiresChallenge, false);
    });

    // 3c. GET /api/bot-verification-status for logged-in user (session cookie)
    await runAsyncTest('GET /api/bot-verification-status returns verified: true for logged-in user without challenge', async () => {
      const secret = process.env.SESSION_SECRET || 'umanarayani_sacred_jwt_secret_key_2026';
      const userSessionToken = jwt.sign(
        { id: 'usr_verified_test_1', email: 'verified@umanarayni.com', role: 'user', name: 'Verified Customer' },
        secret,
        { expiresIn: '1h' }
      );

      const res = await makeRequest(server, 'GET', '/api/bot-verification-status', null, {
        Cookie: `umanarayni_auth=${userSessionToken}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data.verified, true);
      assert.strictEqual(res.data.isLoggedIn, true);
      assert.strictEqual(res.data.requiresChallenge, false);
      
      // Also check that it set the human_verified cookie
      const setCookie = res.headers['set-cookie'];
      assert(Array.isArray(setCookie) && setCookie.some(c => c.startsWith(`${HUMAN_VERIFIED_COOKIE_NAME}=`)), 'Must issue human_verified cookie');
    });

    console.log('\n--- 4. Checkout Bot Protection Flow ---');

    // 4a. Guest checkout with NO cookie and NO token -> 403 BOT_VERIFICATION_REQUIRED
    await runAsyncTest('Initiate payment rejects guest with no cookie and no token with 403 BOT_VERIFICATION_REQUIRED', async () => {
      const payload = {
        amount: 499,
        deliveryAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          email: 'test@umanarayni.com',
          addressLine1: 'Ayurvedic Ashram Road',
          city: 'Haridwar',
          state: 'Uttarakhand',
          pincode: '249401'
        }
      };

      const res = await makeRequest(server, 'POST', '/api/payment/initiate-payment', payload);
      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.code, 'BOT_VERIFICATION_REQUIRED');
      assert.strictEqual(res.data.requireChallenge, true);
    });

    // 4b. Guest checkout with valid human_verified cookie skips challenge
    await runAsyncTest('Initiate payment accepts valid human_verified cookie without fresh Turnstile token', async () => {
      const token = signHumanVerificationToken();
      const payload = {
        amount: 499,
        cartTotal: 499,
        customerName: 'Test Customer',
        customerPhone: '9876543210',
        customerEmail: 'test@umanarayni.com',
        deliveryAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          email: 'test@umanarayni.com',
          addressLine1: 'Ayurvedic Ashram Road',
          city: 'Haridwar',
          state: 'Uttarakhand',
          pincode: '249401'
        },
        items: [{ id: 'PROD-01', name: 'Herbal Elixir', price: 499, quantity: 1 }]
      };

      const res = await makeRequest(server, 'POST', '/api/payment/initiate-payment', payload, {
        Cookie: `${HUMAN_VERIFIED_COOKIE_NAME}=${token}`
      });

      // It must pass the bot check (not 403 BOT_VERIFICATION_REQUIRED)
      assert.notStrictEqual(res.statusCode, 403, 'Must not be rejected with 403');
      assert(res.data.code !== 'BOT_VERIFICATION_REQUIRED', 'Must not require bot verification');
    });

    // 4c. Guest checkout with valid Turnstile token succeeds and issues human_verified cookie
    await runAsyncTest('Initiate payment verifies fresh Turnstile token and issues human_verified cookie', async () => {
      const payload = {
        amount: 499,
        cartTotal: 499,
        customerName: 'Test Customer',
        customerPhone: '9876543210',
        customerEmail: 'test@umanarayni.com',
        turnstileToken: 'cf_test_pass',
        deliveryAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          email: 'test@umanarayni.com',
          addressLine1: 'Ayurvedic Ashram Road',
          city: 'Haridwar',
          state: 'Uttarakhand',
          pincode: '249401'
        },
        items: [{ id: 'PROD-01', name: 'Herbal Elixir', price: 499, quantity: 1 }]
      };

      const res = await makeRequest(server, 'POST', '/api/payment/initiate-payment', payload);
      assert.notStrictEqual(res.statusCode, 403, 'Must not fail bot check');
      const setCookie = res.headers['set-cookie'];
      assert(Array.isArray(setCookie) && setCookie.some(c => c.startsWith(`${HUMAN_VERIFIED_COOKIE_NAME}=`)), 'Must issue human_verified cookie upon successful challenge');
    });

    // 4d. Reject tampered cookie and clear it
    await runAsyncTest('Initiate payment rejects tampered cookie and clears it', async () => {
      const payload = {
        amount: 499,
        cartTotal: 499,
        deliveryAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          email: 'test@umanarayni.com',
          addressLine1: 'Ayurvedic Ashram Road',
          city: 'Haridwar',
          state: 'Uttarakhand',
          pincode: '249401'
        }
      };

      const res = await makeRequest(server, 'POST', '/api/payment/initiate-payment', payload, {
        Cookie: `${HUMAN_VERIFIED_COOKIE_NAME}=eyJhbGciOiJIUzI1NiJ9.invalid`
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.code, 'BOT_VERIFICATION_REQUIRED');
      const setCookie = res.headers['set-cookie'];
      assert(Array.isArray(setCookie) && setCookie.some(c => c.includes(`${HUMAN_VERIFIED_COOKIE_NAME}=;`)), 'Must clear invalid cookie');
    });

    // 4e. Re-challenge enforced when risk is flagged
    await runAsyncTest('Initiate payment ignores valid cookie and forces re-challenge if client risk is flagged', async () => {
      // Flag risk for 127.0.0.1
      const reqMock = { ip: '127.0.0.1' };
      flagClientRisk(reqMock, 'Test rate limit breach');

      const token = signHumanVerificationToken();
      const payload = {
        amount: 499,
        cartTotal: 499,
        deliveryAddress: {
          fullName: 'Test Customer',
          phone: '9876543210',
          email: 'test@umanarayni.com',
          addressLine1: 'Ayurvedic Ashram Road',
          city: 'Haridwar',
          state: 'Uttarakhand',
          pincode: '249401'
        }
      };

      const res = await makeRequest(server, 'POST', '/api/payment/initiate-payment', payload, {
        Cookie: `${HUMAN_VERIFIED_COOKIE_NAME}=${token}`
      });

      assert.strictEqual(res.statusCode, 403);
      assert.strictEqual(res.data.code, 'RECHALLENGE_REQUIRED', 'Must return RECHALLENGE_REQUIRED when client is flagged');

      // Clear risk after test
      clearClientRisk(reqMock);
    });

    console.log('\n--- 5. High-Risk Action Guardrails ---');

    // 5a. Register must NOT bypass Turnstile with just a cookie
    await runAsyncTest('POST /api/auth/register rejects request with only human_verified cookie (demands fresh token)', async () => {
      const token = signHumanVerificationToken();
      const payload = {
        name: 'New Patron',
        email: `newpatron_${Date.now()}@example.com`,
        password: 'ValidPassword123!'
      };

      const res = await makeRequest(server, 'POST', '/api/auth/register', payload, {
        Cookie: `${HUMAN_VERIFIED_COOKIE_NAME}=${token}`,
        'x-enforce-turnstile': 'true'
      });

      // Must be rejected with 403 bot verification failed
      assert.strictEqual(res.statusCode, 403, 'Registration must strictly require fresh turnstileToken');
    });

    // 5b. Forgot password request must NOT bypass Turnstile with just a cookie
    await runAsyncTest('POST /api/auth/forgot-password/request rejects request with only human_verified cookie', async () => {
      const token = signHumanVerificationToken();
      const payload = {
        identifier: 'patron@example.com'
      };

      const res = await makeRequest(server, 'POST', '/api/auth/forgot-password/request', payload, {
        Cookie: `${HUMAN_VERIFIED_COOKIE_NAME}=${token}`,
        'x-enforce-turnstile': 'true'
      });

      assert.strictEqual(res.statusCode, 403, 'Forgot password request must strictly require fresh turnstileToken');
    });

    // 5c. Register succeeds when valid fresh turnstileToken is supplied
    await runAsyncTest('POST /api/auth/register succeeds past bot check when fresh turnstileToken is supplied', async () => {
      const payload = {
        name: 'New Patron',
        email: `newpatron_${Date.now()}@example.com`,
        password: 'ValidPassword123!',
        turnstileToken: 'cf_test_pass'
      };

      const res = await makeRequest(server, 'POST', '/api/auth/register', payload);
      // Status code may be 200 or DB error/duplicate depending on mail setup, but must not be 403
      assert.notStrictEqual(res.statusCode, 403, 'Must pass Turnstile check');
      const setCookie = res.headers['set-cookie'];
      assert(Array.isArray(setCookie) && setCookie.some(c => c.startsWith(`${HUMAN_VERIFIED_COOKIE_NAME}=`)), 'Must issue human_verified cookie');
    });

  } finally {
    await new Promise((resolve) => server.close(resolve));
  }

  console.log('\n=============================================================');
  console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
  console.log('=============================================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAll().catch((err) => {
  console.error('Fatal Test Suite Error:', err);
  process.exit(1);
});
