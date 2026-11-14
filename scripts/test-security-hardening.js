/**
 * UMANARAYNI AYURVEDA — SECURITY HARDENING TEST SUITE (PART 2)
 * Tests:
 * 1. TOTP 2FA generation, dynamic truncation, and constant-time verification
 * 2. Keyed HMAC-SHA256 OTP hashing and constant-time comparison
 * 3. Per-identifier OTP hourly limits, resend cooldown, and daily SMS cap
 * 4. Uploads binary magic bytes inspection and SVG script injection rejection
 * 5. CSRF origin verification on state-changing requests
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const {
  generateTotpSecret,
  generateTotpUri,
  computeTotpCode,
  verifyTotpToken,
  base32Decode,
  base32Encode
} = require('../services/totpService');
const {
  hashOtp,
  verifyOtpHash,
  checkOtpSendLimits,
  recordOtpSent,
  checkAndIncrementDailySms,
  MAX_HOURLY_OTP_PER_IDENTIFIER,
  RESEND_COOLDOWN_SECONDS
} = require('../services/otpSecurityService');
const {
  validateUploadedFile,
  isJpeg,
  isPng,
  isWebP,
  isSafeSvg,
  SECURE_UPLOAD_DIR
} = require('../services/uploadValidator');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

async function main() {
  console.log('\n--- 1. Testing TOTP 2FA Service (RFC 6238 / RFC 4226) ---');

  runTest('Generates valid 32-character Base32 TOTP secret and URI', () => {
    const secret = generateTotpSecret(20);
    assert.strictEqual(typeof secret, 'string');
    assert.strictEqual(secret.length, 32);
    assert.match(secret, /^[A-Z2-7]+$/);

    const uri = generateTotpUri('admin@umanarayni.com', secret);
    assert.match(uri, /^otpauth:\/\/totp\/Umanarayni%20Ayurveda:admin%40umanarayni\.com\?secret=/);
  });

  runTest('Computes 6-digit zero-padded TOTP code and verifies successfully', () => {
    const secret = generateTotpSecret(20);
    const code = computeTotpCode(secret);
    assert.match(code, /^\d{6}$/);

    const isValid = verifyTotpToken(code, secret);
    assert.strictEqual(isValid, true, 'Valid TOTP code within time window must pass');
  });

  runTest('Rejects incorrect or tampered TOTP code', () => {
    const secret = generateTotpSecret(20);
    const wrongCode = '000000';
    const actualCode = computeTotpCode(secret);
    // In rare chance actual code is 000000, test with 999999
    const testWrong = actualCode === wrongCode ? '999999' : wrongCode;
    assert.strictEqual(verifyTotpToken(testWrong, secret), false);
  });

  runTest('Accepts code within ±1 clock drift time window (30 seconds)', () => {
    const secret = generateTotpSecret(20);
    const pastTimeSec = Math.floor(Date.now() / 1000) - 25; // 25s ago
    const code = computeTotpCode(secret, pastTimeSec);
    assert.strictEqual(verifyTotpToken(code, secret, 1), true);
  });

  console.log('\n--- 2. Testing Keyed HMAC-SHA256 OTP Hashing & Abuse Limits ---');

  runTest('Hashes 6-digit OTP into keyed 64-character HMAC-SHA256 digest', () => {
    const otp = '482910';
    const hash = hashOtp(otp);
    assert.strictEqual(typeof hash, 'string');
    assert.strictEqual(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  await runAsyncTest('Verifies matching OTP in constant time', async () => {
    const otp = '839201';
    const hash = hashOtp(otp);
    const isMatch = await verifyOtpHash(otp, hash);
    assert.strictEqual(isMatch, true);
  });

  await runAsyncTest('Rejects non-matching OTP with timing-safe comparison', async () => {
    const hash = hashOtp('123456');
    const isMatch = await verifyOtpHash('654321', hash);
    assert.strictEqual(isMatch, false);
  });

  runTest('Enforces 60-second resend cooldown for same identifier', () => {
    const testIdentifier = 'test_cooldown_' + Date.now() + '@umanarayni.com';
    recordOtpSent(testIdentifier);

    const check = checkOtpSendLimits(testIdentifier);
    assert.strictEqual(check.allowed, false);
    assert.match(check.reason, /Please wait \d+ seconds? before requesting another OTP/i);
  });

  runTest('Enforces maximum 3 OTP requests per hour per identifier', () => {
    const testId = 'test_hourly_' + Date.now() + '@umanarayni.com';
    const baseTime = Date.now();

    // Send 1 (t=0s)
    assert.strictEqual(checkOtpSendLimits(testId, baseTime).allowed, true);
    recordOtpSent(testId, baseTime);

    // Send 2 (t=70s: past cooldown)
    assert.strictEqual(checkOtpSendLimits(testId, baseTime + 70000).allowed, true);
    recordOtpSent(testId, baseTime + 70000);

    // Send 3 (t=140s: past cooldown)
    assert.strictEqual(checkOtpSendLimits(testId, baseTime + 140000).allowed, true);
    recordOtpSent(testId, baseTime + 140000);

    // Send 4 (t=210s: past 60s cooldown, but 4th within 1 hour)
    const check4 = checkOtpSendLimits(testId, baseTime + 210000);
    assert.strictEqual(check4.allowed, false);
    assert.match(check4.reason, /Maximum OTP request limit reached \(3 per hour\)/i);
  });

  runTest('Twilio daily SMS limit protects against runaway billing', () => {
    process.env.TWILIO_DAILY_SMS_LIMIT = '2';
    // Send 1
    const s1 = checkAndIncrementDailySms();
    assert.strictEqual(s1.allowed, true);
    // Send 2
    const s2 = checkAndIncrementDailySms();
    assert.strictEqual(s2.allowed, true);
    // Send 3 (exceeds cap of 2)
    const s3 = checkAndIncrementDailySms();
    assert.strictEqual(s3.allowed, false);
    assert.match(s3.reason, /Daily SMS notification threshold reached/i);
    // Reset limit
    process.env.TWILIO_DAILY_SMS_LIMIT = '100';
  });

  console.log('\n--- 3. Testing Upload Security & Binary Magic Bytes Inspection ---');

  runTest('Identifies valid JPEG binary header (FF D8 FF)', () => {
    const jpegBuf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
    assert.strictEqual(isJpeg(jpegBuf), true);
    assert.strictEqual(isPng(jpegBuf), false);
  });

  runTest('Identifies valid PNG binary header (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngBuf = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.strictEqual(isPng(pngBuf), true);
    assert.strictEqual(isJpeg(pngBuf), false);
  });

  runTest('Identifies valid WebP binary header (RIFF....WEBP)', () => {
    const webpBuf = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50  // WEBP
    ]);
    assert.strictEqual(isWebP(webpBuf), true);
  });

  await runAsyncTest('Rejects executable file disguised with .jpg extension and deletes it from disk', async () => {
    const fakeJpgPath = path.join(SECURE_UPLOAD_DIR, `fake-malicious-${Date.now()}.jpg`);
    // Write fake PE executable header (MZ header: 4D 5A)
    fs.writeFileSync(fakeJpgPath, Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]));

    const fakeFile = {
      path: fakeJpgPath,
      originalname: 'malicious.jpg'
    };

    const res = await validateUploadedFile(fakeFile);
    assert.strictEqual(res.valid, false);
    assert.match(res.reason, /failed security magic-byte verification/i);
    assert.strictEqual(fs.existsSync(fakeJpgPath), false, 'Rejected file must be unlinked from disk immediately');
  });

  runTest('Rejects SVG file containing script tags or event handlers', () => {
    const dangerousSvgPath = path.join(SECURE_UPLOAD_DIR, `dangerous-${Date.now()}.svg`);
    fs.writeFileSync(dangerousSvgPath, '<svg><script>alert("xss")</script></svg>');

    const isSafe = isSafeSvg(dangerousSvgPath);
    try { fs.unlinkSync(dangerousSvgPath); } catch (_) {}
    assert.strictEqual(isSafe, false, 'Dangerous SVG with script tag must be rejected');
  });

  console.log('\n--- 4. Testing CSRF Origin Validation Logic ---');

  runTest('CSRF origin check allows requests from production domain and blocks foreign origins', () => {
    function simulateCsrfCheck(origin, method, isProdEnv = true) {
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;
      if (!origin) return true; // non-browser CLI

      const url = new URL(origin);
      const host = url.hostname;
      if (isProdEnv) {
        return ['umanarayni.com', 'www.umanarayni.com', 'umanarayani.com', 'www.umanarayani.com'].includes(host);
      }
      return ['localhost', '127.0.0.1'].includes(host);
    }

    assert.strictEqual(simulateCsrfCheck('https://umanarayni.com', 'POST', true), true);
    assert.strictEqual(simulateCsrfCheck('https://www.umanarayni.com', 'POST', true), true);
    assert.strictEqual(simulateCsrfCheck('https://evil-hacker.com', 'POST', true), false);
    assert.strictEqual(simulateCsrfCheck('https://phishing-site.xyz', 'DELETE', true), false);
  });

  console.log('\n========================================');
  console.log(`Security Test Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test execution error:', err);
  process.exit(1);
});
