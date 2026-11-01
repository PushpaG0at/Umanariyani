require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

// Initialize the MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'umanarayani',
  waitForConnections: true,
  connectionLimit: process.env.DB_CONNECTION_LIMIT ? Number(process.env.DB_CONNECTION_LIMIT) : 10,
  maxIdle: process.env.DB_MAX_IDLE ? Number(process.env.DB_MAX_IDLE) : 10,
  idleTimeout: 60000, // close idle connections after 60s
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

/**
 * Ensures users table has phone_number, is_verified, otp_code, and otp_expiry columns
 */
async function ensureUserOtpColumns() {
  try {
    const [cols] = await pool.query('DESCRIBE users');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('phone_number')) {
      await pool.query('ALTER TABLE users ADD COLUMN phone_number VARCHAR(32) NULL UNIQUE AFTER email');
      console.log(' [DB] Added phone_number column to users table.');
    }
    if (!colNames.includes('is_verified')) {
      await pool.query('ALTER TABLE users ADD COLUMN is_verified BOOLEAN DEFAULT FALSE AFTER phone_number');
      console.log(' [DB] Added is_verified column to users table.');
    }
    if (!colNames.includes('otp_code')) {
      await pool.query('ALTER TABLE users ADD COLUMN otp_code VARCHAR(255) NULL AFTER is_verified');
      console.log(' [DB] Added otp_code column to users table.');
    }
    if (!colNames.includes('otp_expiry')) {
      await pool.query('ALTER TABLE users ADD COLUMN otp_expiry DATETIME NULL AFTER otp_code');
      console.log(' [DB] Added otp_expiry column to users table.');
    }

    // Allow email to be NULL in case user signs up exclusively via phone number
    const emailCol = cols.find(c => c.Field === 'email');
    if (emailCol && emailCol.Null === 'NO') {
      await pool.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(160) NULL');
      console.log(' [DB] Modified email column to allow NULL for phone-first authentication.');
    }

    // Ensure existing accounts are marked as verified so they can log in seamlessly
    await pool.query('UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL');
  } catch (err) {
    console.warn('⚠️  [DB] Could not verify/alter users OTP schema:', err.message);
  }
}

/**
 * Helper to test the connection pool on startup
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(' Connected to MySQL database via connection pool.');
    connection.release();
    await ensureUserOtpColumns();
    return true;
  } catch (error) {
    const detail = error.code ? `${error.code}${error.message ? `: ${error.message}` : ''}` : error.message || 'Connection error';
    console.warn(`⚠️  MySQL connection pool check failed (${detail})`);
    if (error.code === 'ER_BAD_DB_ERROR') {
      console.warn(`   Database '${process.env.DB_NAME || 'umanarayani'}' does not exist. Create it with: CREATE DATABASE ${process.env.DB_NAME || 'umanarayani'};`);
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.warn('   Access denied: Verify DB_USER and DB_PASSWORD in your .env file.');
    } else {
      console.warn('   Ensure MySQL is running and your credentials in .env are correct.');
    }
    return false;
  }
}

/**
 * Finds user by email or phone number
 */
async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = identifier.toString().trim();
  const isEmail = clean.includes('@');

  if (isEmail) {
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?)',
      [clean]
    );
    return rows[0] || null;
  } else {
    const digitsOnly = clean.replace(/[^0-9+]/g, '');
    const [rows] = await pool.query(
      'SELECT * FROM users WHERE phone_number = ? OR phone_number = ?',
      [clean, digitsOnly]
    );
    return rows[0] || null;
  }
}

/**
 * Saves a hashed OTP and expiry timestamp for a user
 */
async function saveUserOtp(identifier, hashedOtp, expiryDate) {
  if (!identifier) return false;
  const clean = identifier.toString().trim();
  const isEmail = clean.includes('@');

  if (isEmail) {
    const [res] = await pool.query(
      'UPDATE users SET otp_code = ?, otp_expiry = ? WHERE LOWER(email) = LOWER(?)',
      [hashedOtp, expiryDate, clean]
    );
    return res.affectedRows > 0;
  } else {
    const digitsOnly = clean.replace(/[^0-9+]/g, '');
    const [res] = await pool.query(
      'UPDATE users SET otp_code = ?, otp_expiry = ? WHERE phone_number = ? OR phone_number = ?',
      [hashedOtp, expiryDate, clean, digitsOnly]
    );
    return res.affectedRows > 0;
  }
}

/**
 * Verifies if entered OTP matches and hasn't expired (5-minute validity)
 */
async function verifyUserOtp(identifier, enteredOtp) {
  if (!identifier || !enteredOtp) {
    return { success: false, message: 'Identifier and OTP code are required.' };
  }

  const user = await findUserByIdentifier(identifier);
  if (!user) {
    return { success: false, message: 'User account not found.' };
  }

  if (!user.otp_code || !user.otp_expiry) {
    return { success: false, message: 'No active OTP found. Please request a new code.' };
  }

  const now = new Date();
  const expiry = new Date(user.otp_expiry);
  if (now > expiry) {
    return { success: false, message: 'OTP code has expired. Please request a new one.' };
  }

  const cleanOtp = enteredOtp.toString().trim();
  let isMatch = false;

  if (user.otp_code.startsWith('$2a$') || user.otp_code.startsWith('$2b$')) {
    isMatch = await bcrypt.compare(cleanOtp, user.otp_code);
  } else {
    isMatch = user.otp_code.trim() === cleanOtp;
  }

  if (!isMatch) {
    return { success: false, message: 'Invalid OTP code. Please check and try again.' };
  }

  // OTP verified: mark user verified and clear OTP
  await pool.query(
    'UPDATE users SET is_verified = TRUE, otp_code = NULL, otp_expiry = NULL WHERE id = ?',
    [user.id]
  );

  user.is_verified = 1;
  user.otp_code = null;
  user.otp_expiry = null;

  return { success: true, user };
}

/**
 * Clears any pending OTP for a user
 */
async function clearUserOtp(userId) {
  await pool.query('UPDATE users SET otp_code = NULL, otp_expiry = NULL WHERE id = ?', [userId]);
}

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params),
  execute: (sql, params) => pool.execute(sql, params),
  testConnection,
  ensureUserOtpColumns,
  findUserByIdentifier,
  saveUserOtp,
  verifyUserOtp,
  clearUserOtp,
};
