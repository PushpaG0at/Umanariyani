/**
 * UMANARAYNI AYURVEDA — HUMAN VERIFICATION & BOT MITIGATION SERVICE
 * 
 * Provides low-friction, high-security Cloudflare Turnstile bot protection:
 * 1. Cryptographically signed, HTTP-only, Secure, SameSite cookie (`human_verified`).
 * 2. Session binding: Binds the verification token to the authenticated user ID when present.
 * 3. Frictionless Cart & Checkout: Reuses valid verification cookie or active session.
 * 4. High-Risk Action Guardrails: Registration, login OTP, and password reset ALWAYS require fresh tokens.
 * 5. Adaptive Re-challenge: Ignored and cleared when rate limits are tripped or repeated failures occur.
 */

const crypto = require('node:crypto');

const HUMAN_VERIFIED_COOKIE_NAME = 'human_verified';
const DEFAULT_VERIFY_TTL_SECONDS = 30 * 60; // 30 minutes

/**
 * Returns the active HMAC secret for signing verification cookies
 */
function getHumanVerifySecret() {
  return (
    process.env.HUMAN_VERIFY_SECRET ||
    process.env.SESSION_SECRET ||
    'umanarayani_sacred_human_verify_secret_key_2026'
  ).trim();
}

/**
 * Returns the verification cookie TTL in seconds
 */
function getVerificationTtlSeconds() {
  const envVal = parseInt(process.env.HUMAN_VERIFIED_MAX_AGE_SECONDS || '', 10);
  return !isNaN(envVal) && envVal > 0 ? envVal : DEFAULT_VERIFY_TTL_SECONDS;
}

// In-memory sliding window for risk tracking
// Map<clientIdentifier, { flaggedAt: number, reason: string }>
const clientRiskMap = new Map();
// Map<clientIdentifier, { count: number, firstFailureAt: number }>
const failureTrackerMap = new Map();

const RISK_FLAG_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout of cookie bypass
const FAILURE_WINDOW_MS = 10 * 60 * 1000;     // 10 minutes sliding window
const MAX_FAILURES_BEFORE_RISK = 3;            // 3 failures triggers risk flag

/**
 * Extracts a normalized client identifier for risk attribution
 */
function getClientIdentifier(req) {
  if (!req) return 'unknown';
  if (req.user && req.user.id) return `user:${req.user.id}`;
  const ip = req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || '';
  return `ip:${ip.replace(/^.*:/, '') || 'unknown'}`;
}

/**
 * Cryptographically signs a human verification payload using HMAC-SHA256
 * @param {object} params
 * @param {string|null} [params.userId]
 * @param {number} [params.customTtlSec]
 * @returns {string} Base64URL-encoded token with signature
 */
function signHumanVerificationToken({ userId = null, customTtlSec = null } = {}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl = customTtlSec || getVerificationTtlSeconds();

  const payload = {
    v: 1,
    userId: userId ? String(userId) : null,
    iat: nowSec,
    exp: nowSec + ttl
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getHumanVerifySecret())
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies a human verification cookie token
 * @param {string} tokenString
 * @param {string|null} [expectedUserId]
 * @returns {{ valid: boolean, reason?: string, payload?: object }}
 */
function verifyHumanVerificationToken(tokenString, expectedUserId = null) {
  if (!tokenString || typeof tokenString !== 'string') {
    return { valid: false, reason: 'missing_or_invalid_format' };
  }

  const parts = tokenString.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'malformed_structure' };
  }

  const [payloadB64, signature] = parts;
  const expectedSignature = crypto
    .createHmac('sha256', getHumanVerifySecret())
    .update(payloadB64)
    .digest('base64url');

  // Constant-time signature verification
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, reason: 'signature_mismatch' };
  }

  let payload;
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch (_) {
    return { valid: false, reason: 'unparseable_payload' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (!payload.exp || nowSec > payload.exp) {
    return { valid: false, reason: 'token_expired', exp: payload.exp };
  }

  // Session binding check: If user is authenticated, ensure cookie isn't bound to a different user
  if (expectedUserId && payload.userId && String(payload.userId) !== String(expectedUserId)) {
    return { valid: false, reason: 'user_mismatch' };
  }

  return { valid: true, payload };
}

/**
 * Issues the signed HTTP-only human verification cookie
 */
function issueHumanVerificationCookie(res, req, options = {}) {
  if (!res || typeof res.cookie !== 'function') return null;

  const userId = options.userId || req?.user?.id || null;
  const ttlSec = options.ttlSec || getVerificationTtlSeconds();
  const token = signHumanVerificationToken({ userId, customTtlSec: ttlSec });

  const isProd = process.env.NODE_ENV === 'production';
  const cookieOptions = {
    httpOnly: true,
    secure: isProd || Boolean(req?.secure),
    sameSite: 'lax',
    maxAge: ttlSec * 1000,
    path: '/'
  };

  res.cookie(HUMAN_VERIFIED_COOKIE_NAME, token, cookieOptions);

  // Clear any existing risk flag upon successful re-challenge
  if (req) {
    clearClientRisk(req);
  }

  return token;
}

/**
 * Clears the human verification cookie
 */
function clearHumanVerificationCookie(res, req) {
  if (!res || typeof res.clearCookie !== 'function') return;

  const isProd = process.env.NODE_ENV === 'production';
  res.clearCookie(HUMAN_VERIFIED_COOKIE_NAME, {
    httpOnly: true,
    secure: isProd || Boolean(req?.secure),
    sameSite: 'lax',
    path: '/'
  });
}

/**
 * Flags a client as high-risk (e.g. rate limiter tripped or repeated failures)
 * Forces re-challenge by ignoring the human_verified cookie
 */
function flagClientRisk(req, reason = 'suspicious_activity', res = null) {
  const clientId = getClientIdentifier(req);
  clientRiskMap.set(clientId, {
    flaggedAt: Date.now(),
    reason
  });
  console.warn(`⚠️ [Human Verification Risk] Client ${clientId} flagged for re-challenge: ${reason}`);

  if (res) {
    clearHumanVerificationCookie(res, req);
  }
}

/**
 * Checks whether the client is currently flagged for risk
 */
function isClientRiskFlagged(req) {
  const clientId = getClientIdentifier(req);
  const entry = clientRiskMap.get(clientId);
  if (!entry) return false;

  if (Date.now() - entry.flaggedAt > RISK_FLAG_DURATION_MS) {
    clientRiskMap.delete(clientId);
    return false;
  }
  return true;
}

/**
 * Clears risk status for a client after solving a fresh challenge
 */
function clearClientRisk(req) {
  const clientId = getClientIdentifier(req);
  clientRiskMap.delete(clientId);
  failureTrackerMap.delete(clientId);
}

/**
 * Records a verification failure (e.g. invalid Turnstile token or bad UTR attempts)
 */
function recordVerificationFailure(req, res = null) {
  const clientId = getClientIdentifier(req);
  const now = Date.now();
  const existing = failureTrackerMap.get(clientId) || { count: 0, firstFailureAt: now };

  if (now - existing.firstFailureAt > FAILURE_WINDOW_MS) {
    existing.count = 1;
    existing.firstFailureAt = now;
  } else {
    existing.count += 1;
  }

  failureTrackerMap.set(clientId, existing);

  if (existing.count >= MAX_FAILURES_BEFORE_RISK) {
    flagClientRisk(req, `Exceeded ${MAX_FAILURES_BEFORE_RISK} consecutive verification failures`, res);
  }
}

/**
 * Evaluates bot verification for Cart & Checkout requests:
 * 1. If risk is flagged -> requires fresh Turnstile token.
 * 2. If valid human_verified cookie is present -> passes.
 * 3. If authenticated user session is active -> passes and refreshes cookie.
 * 4. If guest without cookie -> validates fresh Turnstile token.
 * 
 * @param {object} req Express request
 * @param {object} res Express response
 * @param {Function} verifyTurnstileFn Existing Turnstile siteverify helper
 * @returns {Promise<{ success: boolean, verifiedBy?: string, message?: string, requireChallenge?: boolean, code?: string }>}
 */
async function verifyCheckoutBotProtection(req, res, verifyTurnstileFn) {
  const isRisk = isClientRiskFlagged(req);
  const token = req.body?.turnstileToken || req.headers?.['x-turnstile-token'];

  // 1. If risk is flagged: require a fresh token
  if (isRisk) {
    if (!token) {
      if (res) clearHumanVerificationCookie(res, req);
      return {
        success: false,
        requireChallenge: true,
        code: 'RECHALLENGE_REQUIRED',
        message: 'Security challenge required due to recent unusual activity. Please complete verification.'
      };
    }

    const botCheck = await verifyTurnstileFn(token, req);
    if (botCheck && botCheck.success) {
      clearClientRisk(req);
      issueHumanVerificationCookie(res, req);
      return { success: true, verifiedBy: 'fresh_turnstile_post_risk' };
    }

    recordVerificationFailure(req, res);
    return {
      success: false,
      requireChallenge: true,
      code: 'VERIFICATION_FAILED',
      message: botCheck?.message || 'Bot protection verification failed. Please try again.'
    };
  }

  // 2. Check for valid human_verified cookie
  const cookieVal = req.cookies?.[HUMAN_VERIFIED_COOKIE_NAME];
  if (cookieVal) {
    const verified = verifyHumanVerificationToken(cookieVal, req.user?.id);
    if (verified.valid) {
      return { success: true, verifiedBy: 'cookie', payload: verified.payload };
    }
    // Expired or tampered cookie: clear it silently
    if (res) clearHumanVerificationCookie(res, req);
  }

  // 3. Logged-in user with active authenticated session: skip widget and auto-issue cookie
  if (req.user && req.user.id) {
    issueHumanVerificationCookie(res, req, { userId: req.user.id });
    return { success: true, verifiedBy: 'active_session', userId: req.user.id };
  }

  // 4. Guest user: verify fresh token if provided
  if (token) {
    const botCheck = await verifyTurnstileFn(token, req);
    if (botCheck && botCheck.success) {
      issueHumanVerificationCookie(res, req);
      return { success: true, verifiedBy: 'turnstile_token' };
    }

    recordVerificationFailure(req, res);
    return {
      success: false,
      requireChallenge: true,
      code: 'VERIFICATION_FAILED',
      message: botCheck?.message || 'Bot protection verification failed. Please try again.'
    };
  }

  // 5. Guest with no cookie and no token
  return {
    success: false,
    requireChallenge: true,
    code: 'BOT_VERIFICATION_REQUIRED',
    message: 'Please complete the security verification challenge before continuing.'
  };
}

module.exports = {
  HUMAN_VERIFIED_COOKIE_NAME,
  DEFAULT_VERIFY_TTL_SECONDS,
  getVerificationTtlSeconds,
  signHumanVerificationToken,
  verifyHumanVerificationToken,
  issueHumanVerificationCookie,
  clearHumanVerificationCookie,
  flagClientRisk,
  isClientRiskFlagged,
  clearClientRisk,
  recordVerificationFailure,
  verifyCheckoutBotProtection
};
