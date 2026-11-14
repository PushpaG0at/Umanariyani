/**
 * UMANARAYNI AYURVEDA — TOTP 2FA SERVICE (RFC 6238 / RFC 4226)
 * Implemented using Node.js built-in 'crypto' module for zero dependencies and zero attack surface.
 * Standard 6-digit TOTP, 30-second time step, with clock-drift window support and constant-time verification.
 */

const crypto = require('node:crypto');

// Base32 character set (RFC 4648)
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/**
 * Encodes a buffer to Base32 string
 */
function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Decodes a Base32 string into a Buffer
 */
function base32Decode(base32Str) {
  const clean = base32Str.replace(/=+$/, '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes = [];

  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_CHARS.indexOf(clean[i]);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Generates a random Base32 secret key for TOTP setup
 * @param {number} numBytes Default 20 bytes (160 bits)
 * @returns {string} Base32 encoded secret
 */
function generateTotpSecret(numBytes = 20) {
  const buffer = crypto.randomBytes(numBytes);
  return base32Encode(buffer);
}

/**
 * Generates an otpauth:// URI for scanning with Google Authenticator, 1Password, or Authy
 */
function generateTotpUri(email, secret, issuer = 'Umanarayni Ayurveda') {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Computes standard 6-digit TOTP code for a given timestamp
 * @param {string} secret Base32 encoded secret
 * @param {number} timeSec Unix timestamp in seconds
 * @returns {string} 6-digit zero-padded OTP
 */
function computeTotpCode(secret, timeSec = Math.floor(Date.now() / 1000), timeStepSec = 30) {
  const key = base32Decode(secret);
  const counter = Math.floor(timeSec / timeStepSec);

  // 8-byte big-endian counter buffer
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeBigInt64BE(BigInt(counter), 0);

  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();

  // Dynamic truncation (RFC 4226 Section 5.4)
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, '0');
}

/**
 * Verifies a 6-digit TOTP token against a secret with clock-drift window support
 * @param {string} token The 6-digit code entered by the admin
 * @param {string} secret Base32 encoded secret
 * @param {number} window Window of time-steps to check before and after (default 1 = ±30 seconds)
 * @returns {boolean} True if token matches
 */
function verifyTotpToken(token, secret, window = 1) {
  if (!token || !secret) return false;
  const cleanToken = token.toString().trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanToken)) return false;

  const currentSec = Math.floor(Date.now() / 1000);
  const timeStep = 30;

  for (let offset = -window; offset <= window; offset++) {
    const checkTime = currentSec + (offset * timeStep);
    const expected = computeTotpCode(secret, checkTime, timeStep);

    if (expected.length === cleanToken.length) {
      const match = crypto.timingSafeEqual(Buffer.from(cleanToken), Buffer.from(expected));
      if (match) return true;
    }
  }

  return false;
}

module.exports = {
  generateTotpSecret,
  generateTotpUri,
  computeTotpCode,
  verifyTotpToken,
  base32Encode,
  base32Decode
};
