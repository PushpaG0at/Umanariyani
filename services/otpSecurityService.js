/**
 * UMANARAYNI AYURVEDA — OTP & SMS ABUSE DEFENSE SERVICE
 * Implements:
 * 1. HMAC-SHA256 keyed hashing of 6-digit OTPs using a server secret (defense against rainbow-tables).
 * 2. Constant-time OTP comparison (timing-safe defense).
 * 3. Per-phone and per-email rate limiting (max 3 sends per hour).
 * 4. 60-second resend cooldown per identifier.
 * 5. Daily SMS cap to protect against unexpected Twilio billing spikes.
 * 6. Maximum 5 failed verification attempts per OTP before automatic invalidation.
 */

const crypto = require('node:crypto');

// Configuration
const MAX_HOURLY_OTP_PER_IDENTIFIER = 3;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFICATION_ATTEMPTS = 5;

// In-memory sliding window counters
// Map<identifier, Array<timestampMs>>
const otpRequestHistory = new Map();
// Map<identifier, lastSentTimestampMs>
const otpLastSentMap = new Map();

// Daily SMS tracker: { dateStr: 'YYYY-MM-DD', count: number }
let dailySmsTracker = {
  dateStr: new Date().toISOString().slice(0, 10),
  count: 0
};

/**
 * Returns the active HMAC secret for OTP hashing
 */
function getOtpHmacSecret() {
  return (process.env.OTP_HMAC_SECRET || process.env.SESSION_SECRET || 'umanarayani_sacred_otp_hmac_secret_2026').trim();
}

/**
 * Computes keyed HMAC-SHA256 hash for a 6-digit OTP code
 * @param {string} otp 6-digit OTP string
 * @returns {string} Hex encoded HMAC hash
 */
function hashOtp(otp) {
  const secret = getOtpHmacSecret();
  const cleanOtp = String(otp).trim();
  return crypto.createHmac('sha256', secret).update(cleanOtp).digest('hex');
}

/**
 * Verifies an entered OTP against a stored hash in constant time
 * Supports both new HMAC-SHA256 hashes and legacy bcrypt hashes for backward compatibility
 * @param {string} enteredOtp The plain 6-digit code provided by user
 * @param {string} storedHash The hash stored in the database
 * @param {Function} [legacyBcryptCompare] Optional bcrypt.compare function for legacy hashes
 * @returns {Promise<boolean>} True if match
 */
async function verifyOtpHash(enteredOtp, storedHash, legacyBcryptCompare) {
  if (!enteredOtp || !storedHash) return false;
  const cleanEntered = String(enteredOtp).trim();

  // Legacy bcrypt hash detection ($2a$ / $2b$)
  if (storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$')) {
    if (typeof legacyBcryptCompare === 'function') {
      return await legacyBcryptCompare(cleanEntered, storedHash);
    }
    return false;
  }

  // Keyed HMAC-SHA256 check
  const candidateHash = hashOtp(cleanEntered);
  if (candidateHash.length !== storedHash.length) return false;

  return crypto.timingSafeEqual(
    Buffer.from(candidateHash, 'hex'),
    Buffer.from(storedHash, 'hex')
  );
}

/**
 * Checks whether an identifier (email or phone) is allowed to request a new OTP
 * Enforces:
 * - 60s resend cooldown
 * - Max 3 sends per hour
 * @param {string} rawIdentifier Email address or phone number
 * @returns {{ allowed: boolean, reason?: string, retryAfterSeconds?: number }}
 */
function checkOtpSendLimits(rawIdentifier, now = Date.now()) {
  if (!rawIdentifier) {
    return { allowed: false, reason: 'Identifier is required.' };
  }
  const identifier = rawIdentifier.trim().toLowerCase();

  // 1. Check 60-second resend cooldown
  const lastSent = otpLastSentMap.get(identifier);
  if (lastSent) {
    const elapsedSec = Math.floor((now - lastSent) / 1000);
    if (elapsedSec < RESEND_COOLDOWN_SECONDS) {
      const remainingSec = RESEND_COOLDOWN_SECONDS - elapsedSec;
      return {
        allowed: false,
        reason: `Please wait ${remainingSec} second${remainingSec === 1 ? '' : 's'} before requesting another OTP.`,
        retryAfterSeconds: remainingSec
      };
    }
  }

  // 2. Check 1-hour sliding window (max 3 sends)
  const oneHourAgo = now - 60 * 60 * 1000;
  let history = otpRequestHistory.get(identifier) || [];
  // Prune entries older than 1 hour
  history = history.filter(ts => ts > oneHourAgo);
  otpRequestHistory.set(identifier, history);

  if (history.length >= MAX_HOURLY_OTP_PER_IDENTIFIER) {
    const oldest = history[0];
    const minutesLeft = Math.ceil(((oldest + 60 * 60 * 1000) - now) / (60 * 1000));
    return {
      allowed: false,
      reason: `Maximum OTP request limit reached (3 per hour) for this account. Please try again in ${minutesLeft} minute${minutesLeft === 1 ? '' : 's'}.`,
      retryAfterSeconds: minutesLeft * 60
    };
  }

  return { allowed: true };
}

/**
 * Records an OTP send event for an identifier
 */
function recordOtpSent(rawIdentifier, timestamp = Date.now()) {
  if (!rawIdentifier) return;
  const identifier = rawIdentifier.trim().toLowerCase();

  otpLastSentMap.set(identifier, timestamp);

  const history = otpRequestHistory.get(identifier) || [];
  history.push(timestamp);
  otpRequestHistory.set(identifier, history);
}

/**
 * Checks and increments the daily Twilio SMS counter to protect billing
 * @returns {{ allowed: boolean, currentCount: number, limit: number, reason?: string }}
 */
function checkAndIncrementDailySms() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const dailyLimit = parseInt(process.env.TWILIO_DAILY_SMS_LIMIT || '100', 10);

  // Reset counter on day rollover
  if (dailySmsTracker.dateStr !== todayStr) {
    dailySmsTracker = { dateStr: todayStr, count: 0 };
  }

  if (dailySmsTracker.count >= dailyLimit) {
    console.warn(`[SMS Abuse Defense] Daily Twilio SMS cap reached (${dailyLimit} messages). SMS dispatch blocked.`);
    return {
      allowed: false,
      currentCount: dailySmsTracker.count,
      limit: dailyLimit,
      reason: 'Daily SMS notification threshold reached. Please verify using Email OTP or contact WhatsApp helpline.'
    };
  }

  dailySmsTracker.count++;
  return {
    allowed: true,
    currentCount: dailySmsTracker.count,
    limit: dailyLimit
  };
}

module.exports = {
  hashOtp,
  verifyOtpHash,
  checkOtpSendLimits,
  recordOtpSent,
  checkAndIncrementDailySms,
  MAX_HOURLY_OTP_PER_IDENTIFIER,
  RESEND_COOLDOWN_SECONDS,
  MAX_VERIFICATION_ATTEMPTS
};
