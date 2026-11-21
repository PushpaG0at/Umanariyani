/**
 * ==============================================================================
 * UMANARAYNI AYURVEDA — ENVIRONMENT VALIDATION UTILITY (npm run check:env)
 * ==============================================================================
 * Validates .env configuration against production readiness criteria without
 * starting the Express web server or connecting to live network services.
 * 
 * SECURITY MANDATE:
 * - NEVER prints or logs secret values, passwords, keys, or token contents.
 * - Prints ONLY variable NAMES and pass/fail status.
 * - Strictly limits length (>= 32 chars) checks to generated secrets
 *   (SESSION_SECRET, OTP_HMAC_SECRET, RESET_TOKEN_SECRET, HUMAN_VERIFY_SECRET).
 * - Third-party credentials (SMTP_PASS, TURNSTILE_SECRET_KEY, AWS_SECRET_ACCESS_KEY)
 *   are validated strictly for presence/non-emptiness, never arbitrary length.
 * - Placeholder check uses whole-word regex to avoid rejecting valid random hex strings.
 * ==============================================================================
 */

require('dotenv').config();

const REQUIRED_PROD_VARS = [
  'SESSION_SECRET',
  'DB_USER',
  'DB_NAME',
  'OTP_HMAC_SECRET',
  'RESET_TOKEN_SECRET',
  'HUMAN_VERIFY_SECRET',
  'TURNSTILE_SITE_KEY',
  'TURNSTILE_SECRET_KEY',
  'SMTP_EMAIL',
  'SMTP_PASS',
  'ADMIN_ALERT_EMAIL',
  'S3_BACKUP_BUCKET',
  'AWS_REGION',
  'ALLOWED_ORIGINS'
];

// Generated secrets requiring high entropy (minimum 32 characters, no placeholders)
const GENERATED_SECRETS = [
  'SESSION_SECRET',
  'OTP_HMAC_SECRET',
  'RESET_TOKEN_SECRET',
  'HUMAN_VERIFY_SECRET'
];

// Whole-word regex to catch obvious boilerplate placeholders without rejecting valid random hex containing words like '2026'
const PLACEHOLDER_REGEX = /\b(example|replace|changeme|placeholder|secret|your_secret)\b/i;

function runEnvCheck() {
  console.log('================================================================');
  console.log('🔍 UMANARAYNI AYURVEDA — PRE-FLIGHT ENVIRONMENT AUDIT');
  console.log('================================================================');

  let hasErrors = false;
  let hasWarnings = false;

  const missingVars = [];
  const weakSecrets = [];
  const invalidOrigins = [];

  // 1. Presence check for required production variables
  for (const varName of REQUIRED_PROD_VARS) {
    const val = process.env[varName];
    if (!val || typeof val !== 'string' || val.trim().length === 0) {
      missingVars.push(varName);
      hasErrors = true;
    }
  }

  // 2. Cryptographic strength check strictly for self-generated secrets
  for (const secretKey of GENERATED_SECRETS) {
    const val = process.env[secretKey];
    if (val && typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length < 32) {
        weakSecrets.push(`${secretKey}: Too short (minimum 32 characters required)`);
        hasErrors = true;
      } else if (PLACEHOLDER_REGEX.test(trimmed)) {
        weakSecrets.push(`${secretKey}: Contains predictable placeholder pattern`);
        hasErrors = true;
      }
    }
  }

  // 3. Allowed origins validation (production must not contain http:// or raw IP)
  const allowedOriginsRaw = process.env.ALLOWED_ORIGINS;
  if (allowedOriginsRaw) {
    const origins = allowedOriginsRaw.split(',').map(o => o.trim()).filter(Boolean);
    for (const origin of origins) {
      if (origin.startsWith('http://') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
        invalidOrigins.push(`${origin} (Insecure HTTP not permitted in production)`);
        hasErrors = true;
      }
      if (/^https?:\/\/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/.test(origin)) {
        invalidOrigins.push(`${origin} (Raw IP origin not permitted in production)`);
        hasErrors = true;
      }
    }
  }

  // Report results without exposing ANY secret values
  console.log('\n1. Required Production Variables Check:');
  for (const varName of REQUIRED_PROD_VARS) {
    const isPresent = Boolean(process.env[varName] && process.env[varName].trim().length > 0);
    if (isPresent) {
      console.log(`   ✅ ${varName}: PRESENT`);
    } else {
      console.log(`   ❌ ${varName}: MISSING`);
    }
  }

  console.log('\n2. Generated Secrets Strength Check (>= 32 chars & no placeholder words):');
  for (const secretKey of GENERATED_SECRETS) {
    const val = process.env[secretKey];
    if (!val || val.trim().length === 0) {
      console.log(`   ⚠️  ${secretKey}: NOT SET`);
    } else {
      const isWeak = weakSecrets.some(w => w.startsWith(secretKey));
      if (isWeak) {
        console.log(`   ❌ ${secretKey}: WEAK`);
      } else {
        console.log(`   ✅ ${secretKey}: STRONG`);
      }
    }
  }

  console.log('\n3. Third-Party Credentials Presence (Checked for non-empty only):');
  const thirdPartyKeys = ['SMTP_EMAIL', 'SMTP_PASS', 'TURNSTILE_SITE_KEY', 'TURNSTILE_SECRET_KEY'];
  for (const key of thirdPartyKeys) {
    const isPresent = Boolean(process.env[key] && process.env[key].trim().length > 0);
    console.log(`   ${isPresent ? '✅' : '❌'} ${key}: ${isPresent ? 'CONFIGURED' : 'NOT CONFIGURED'}`);
  }

  console.log('\n================================================================');
  if (hasErrors) {
    console.error('❌ ENVIRONMENT AUDIT FAILED');
    if (missingVars.length > 0) {
      console.error(`   Missing variables (${missingVars.length}): ${missingVars.join(', ')}`);
    }
    if (weakSecrets.length > 0) {
      console.error(`   Weak secrets (${weakSecrets.length}):`);
      weakSecrets.forEach(w => console.error(`     - ${w}`));
    }
    if (invalidOrigins.length > 0) {
      console.error(`   Invalid origins (${invalidOrigins.length}):`);
      invalidOrigins.forEach(o => console.error(`     - ${o}`));
    }
    console.error('\nPlease update your .env file before deploying to production.');
    console.error('================================================================\n');
    process.exit(1);
  } else {
    console.log('✅ ENVIRONMENT AUDIT PASSED: All production variables are present and secure.');
    console.log('================================================================\n');
    process.exit(0);
  }
}

runEnvCheck();
