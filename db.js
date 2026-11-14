require('dotenv').config();
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { verifyOtpHash } = require('./services/otpSecurityService');

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
  timezone: 'Z', // Enforce UTC timezone to prevent timestamp drift
  charset: 'utf8mb4',
});

/**
 * Returns array of normalized designated admin email addresses
 */
function getAdminEmails() {
  const envVal = process.env.ADMIN_EMAIL || 'raoa6526@gmail.com,singhpushpendra95734@gmail.com';
  return envVal.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
}

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
    if (!colNames.includes('role')) {
      await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user' AFTER otp_expiry");
      console.log(' [DB] Added role column to users table.');
    } else {
      await pool.query("ALTER TABLE users MODIFY COLUMN role VARCHAR(20) DEFAULT 'user'");
    }

    if (!colNames.includes('totp_secret')) {
      await pool.query('ALTER TABLE users ADD COLUMN totp_secret VARCHAR(128) NULL AFTER role');
      console.log(' [DB] Added totp_secret column to users table.');
    }
    if (!colNames.includes('totp_enabled')) {
      await pool.query('ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE AFTER totp_secret');
      console.log(' [DB] Added totp_enabled column to users table.');
    }
    if (!colNames.includes('otp_attempts')) {
      await pool.query('ALTER TABLE users ADD COLUMN otp_attempts INT DEFAULT 0 AFTER totp_enabled');
      console.log(' [DB] Added otp_attempts column to users table.');
    }
    if (!colNames.includes('otp_last_sent_at')) {
      await pool.query('ALTER TABLE users ADD COLUMN otp_last_sent_at DATETIME NULL AFTER otp_attempts');
      console.log(' [DB] Added otp_last_sent_at column to users table.');
    }

    // Allow email to be NULL in case user signs up exclusively via phone number
    const emailCol = cols.find(c => c.Field === 'email');
    if (emailCol && emailCol.Null === 'NO') {
      await pool.query('ALTER TABLE users MODIFY COLUMN email VARCHAR(160) NULL');
      console.log(' [DB] Modified email column to allow NULL for phone-first authentication.');
    }

    // Ensure existing accounts are marked as verified so they can log in seamlessly
    await pool.query('UPDATE users SET is_verified = TRUE WHERE is_verified IS NULL');

    // Sanitize any corrupt question-mark avatars into botanical emblems
    await pool.query("UPDATE users SET avatar = '🌿' WHERE avatar = '?' OR avatar IS NULL OR avatar = ''");

    // Automatically ensure designated ADMIN_EMAILs have role = 'admin', and everyone else has 'user'
    const adminEmails = getAdminEmails();
    if (adminEmails.length > 0) {
      await pool.query("UPDATE users SET role = 'admin' WHERE LOWER(email) IN (?)", [adminEmails]);
      await pool.query("UPDATE users SET role = 'user' WHERE (LOWER(email) NOT IN (?) OR email IS NULL) AND role = 'admin'", [adminEmails]);
    }
  } catch (err) {
    console.warn('⚠️  [DB] Could not verify/alter users OTP schema:', err.message);
  }
}

/**
 * Ensures orders table has transactionId, stockReserved, promoCode, and reconciliation columns
 */
async function ensureOrderColumns() {
  try {
    const [cols] = await pool.query('DESCRIBE orders');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('transactionId')) {
      await pool.query('ALTER TABLE orders ADD COLUMN transactionId VARCHAR(100) NULL UNIQUE AFTER paymentMethod');
      console.log(' [DB] Added transactionId column (with UNIQUE index) to orders table.');
    }
    if (!colNames.includes('stockReserved')) {
      await pool.query('ALTER TABLE orders ADD COLUMN stockReserved BOOLEAN DEFAULT TRUE AFTER paymentStatus');
      console.log(' [DB] Added stockReserved column to orders table.');
    }
    if (!colNames.includes('promoCode')) {
      await pool.query('ALTER TABLE orders ADD COLUMN promoCode VARCHAR(50) NULL AFTER discount');
      console.log(' [DB] Added promoCode column to orders table.');
    }
    if (!colNames.includes('reconciliationNote')) {
      await pool.query('ALTER TABLE orders ADD COLUMN reconciliationNote TEXT NULL AFTER orderStatus');
      console.log(' [DB] Added reconciliationNote column to orders table.');
    }
    if (!colNames.includes('reconciledAt')) {
      await pool.query('ALTER TABLE orders ADD COLUMN reconciledAt DATETIME NULL AFTER reconciliationNote');
      console.log(' [DB] Added reconciledAt column to orders table.');
    }
    if (!colNames.includes('reconciledBy')) {
      await pool.query('ALTER TABLE orders ADD COLUMN reconciledBy VARCHAR(120) NULL AFTER reconciledAt');
      console.log(' [DB] Added reconciledBy column to orders table.');
    }
    if (!colNames.includes('paymentProcessedAt')) {
      await pool.query('ALTER TABLE orders ADD COLUMN paymentProcessedAt DATETIME NULL AFTER reconciledBy');
      console.log(' [DB] Added paymentProcessedAt column to orders table.');
    }
  } catch (err) {
    console.warn('⚠️  [DB] Could not verify/alter orders schema:', err.message);
  }
}

/**
 * Ensures products table has stockCount and reservedStock columns
 */
async function ensureStockColumns() {
  try {
    const [cols] = await pool.query('DESCRIBE products');
    const colNames = cols.map(c => c.Field);

    if (!colNames.includes('stockCount')) {
      await pool.query('ALTER TABLE products ADD COLUMN stockCount INT DEFAULT 0 AFTER inStock');
      console.log(' [DB] Added stockCount column to products table.');
    }
    if (!colNames.includes('reservedStock')) {
      await pool.query('ALTER TABLE products ADD COLUMN reservedStock INT DEFAULT 0 AFTER stockCount');
      console.log(' [DB] Added reservedStock column to products table.');
    }
  } catch (err) {
    console.warn('⚠️  [DB] Could not verify/alter products stock columns:', err.message);
  }
}

/**
 * Ensures promo_codes table exists and has seed coupons
 */
async function ensurePromoCodeTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS promo_codes (
        code VARCHAR(50) PRIMARY KEY,
        type ENUM('percentage', 'flat') NOT NULL DEFAULT 'percentage',
        value DECIMAL(10, 2) NOT NULL,
        minCart DECIMAL(10, 2) DEFAULT 0,
        maxDiscount DECIMAL(10, 2) DEFAULT NULL,
        usageLimit INT DEFAULT 1000,
        usageCount INT DEFAULT 0,
        isActive BOOLEAN DEFAULT TRUE,
        expiresAt DATETIME DEFAULT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const [existing] = await pool.query('SELECT COUNT(*) as cnt FROM promo_codes');
    if (existing[0].cnt === 0) {
      await pool.query(`
        INSERT INTO promo_codes (code, type, value, minCart, maxDiscount, usageLimit, isActive, expiresAt)
        VALUES 
          ('AYUR10', 'percentage', 10.00, 499.00, 150.00, 500, TRUE, DATE_ADD(NOW(), INTERVAL 90 DAY)),
          ('WELCOME50', 'flat', 50.00, 299.00, 50.00, 1000, TRUE, DATE_ADD(NOW(), INTERVAL 180 DAY)),
          ('VEDA100', 'flat', 100.00, 999.00, 100.00, 300, TRUE, DATE_ADD(NOW(), INTERVAL 90 DAY))
      `);
      console.log(' [DB] Seeded initial launch promo codes: AYUR10, WELCOME50, VEDA100');
    }
  } catch (err) {
    console.warn('⚠️  [DB] Could not ensure promo_codes table:', err.message);
  }
}

/**
 * Ensures admin_audit_logs table exists for compliance and tracking of all administrative actions
 */
async function ensureAdminAuditLogTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id VARCHAR(64) NULL,
        admin_email VARCHAR(160) NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource_type VARCHAR(64) NOT NULL,
        resource_id VARCHAR(128) NULL,
        details JSON NULL,
        ip_address VARCHAR(64) NULL,
        user_agent VARCHAR(255) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_audit_admin_email (admin_email),
        INDEX idx_audit_action (action),
        INDEX idx_audit_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ [DB] Verified/created admin_audit_logs table.');
  } catch (err) {
    console.warn('⚠️  [DB] Could not ensure admin_audit_logs table:', err.message);
  }
}

/**
 * Records an immutable audit log entry for administrative actions
 */
async function recordAdminAuditLog({ adminId, adminEmail, action, resourceType, resourceId, details, req }) {
  try {
    let ip = null;
    let ua = null;
    if (req) {
      const fwd = req.headers['x-forwarded-for'];
      ip = fwd ? fwd.split(',')[0].trim() : (req.ip || (req.socket && req.socket.remoteAddress));
      ua = (req.headers['user-agent'] || '').slice(0, 255);
    }
    const detailsJson = details ? JSON.stringify(details) : null;

    await pool.query(`
      INSERT INTO admin_audit_logs (admin_id, admin_email, action, resource_type, resource_id, details, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [adminId ? String(adminId) : null, adminEmail || 'system', action, resourceType || 'general', resourceId ? String(resourceId) : null, detailsJson, ip, ua]);
  } catch (err) {
    console.warn('[Audit Log Error]: Failed to write admin audit log:', err.message);
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
    await ensureOrderColumns();
    await ensureStockColumns();
    await ensurePromoCodeTable();
    await ensureAdminAuditLogTable();
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
 * Saves a hashed OTP and expiry timestamp for a user, resetting attempt counters
 */
async function saveUserOtp(identifier, hashedOtp, expiryDate) {
  if (!identifier) return false;
  const clean = identifier.toString().trim();
  const isEmail = clean.includes('@');

  if (isEmail) {
    const [res] = await pool.query(
      'UPDATE users SET otp_code = ?, otp_expiry = ?, otp_attempts = 0, otp_last_sent_at = NOW() WHERE LOWER(email) = LOWER(?)',
      [hashedOtp, expiryDate, clean]
    );
    return res.affectedRows > 0;
  } else {
    const digitsOnly = clean.replace(/[^0-9+]/g, '');
    const [res] = await pool.query(
      'UPDATE users SET otp_code = ?, otp_expiry = ?, otp_attempts = 0, otp_last_sent_at = NOW() WHERE phone_number = ? OR phone_number = ?',
      [hashedOtp, expiryDate, clean, digitsOnly]
    );
    return res.affectedRows > 0;
  }
}

/**
 * Verifies if entered OTP matches and hasn't expired (5-minute validity)
 * Uses constant-time HMAC-SHA256 comparison and enforces 5 attempts max limit.
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
  const isMatch = await verifyOtpHash(cleanOtp, user.otp_code, bcrypt.compare);

  if (!isMatch) {
    const attempts = (Number(user.otp_attempts) || 0) + 1;
    if (attempts >= 5) {
      await pool.query('UPDATE users SET otp_code = NULL, otp_expiry = NULL, otp_attempts = 0 WHERE id = ?', [user.id]);
      return { success: false, message: 'Too many failed verification attempts (5/5). This OTP has been invalidated for security. Please request a new code.' };
    } else {
      await pool.query('UPDATE users SET otp_attempts = ? WHERE id = ?', [attempts, user.id]);
      return { success: false, message: `Invalid OTP code. (${attempts}/5 attempts used). Please check and try again.` };
    }
  }

  // OTP verified: mark user verified, set role, and clear OTP
  const adminEmails = getAdminEmails();
  const isMatchAdmin = Boolean(user.email && adminEmails.includes(user.email.trim().toLowerCase()));
  const targetRole = isMatchAdmin ? 'admin' : (user.role === 'admin' ? 'admin' : 'user');

  await pool.query(
    'UPDATE users SET is_verified = TRUE, otp_code = NULL, otp_expiry = NULL, otp_attempts = 0, role = ? WHERE id = ?',
    [targetRole, user.id]
  );

  user.is_verified = 1;
  user.otp_code = null;
  user.otp_expiry = null;
  user.otp_attempts = 0;
  user.role = targetRole;

  return { success: true, user };
}

/**
 * Clears any pending OTP for a user
 */
async function clearUserOtp(userId) {
  await pool.query('UPDATE users SET otp_code = NULL, otp_expiry = NULL WHERE id = ?', [userId]);
}

/**
 * Finds an order by its unique UPI UTR / Transaction ID
 */
async function findOrderByTransactionId(transactionId) {
  if (!transactionId) return null;
  const [rows] = await pool.query(
    'SELECT * FROM orders WHERE transactionId = ? LIMIT 1',
    [transactionId.trim()]
  );
  return rows[0] || null;
}

/**
 * Safely records a verified UPI QR code payment and order with race-condition defense
 * Uses 100% parameterized queries (?) and handles ER_DUP_ENTRY gracefully
 */
async function recordQrPayment(orderData) {
  const {
    orderId,
    userId,
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
    items,
    subtotal,
    discount,
    tax,
    shippingFee,
    total,
    transactionId
  } = orderData;

  const cleanTxId = (transactionId || '').toString().trim();

  // Enforce mandatory field presence
  if (!cleanTxId || !customerName || !customerEmail || !items || !total) {
    throw new Error('Missing mandatory fields for QR payment record');
  }

  // Pre-emptive duplicate transaction check to avoid unnecessary insert attempts
  const [existing] = await pool.query(
    'SELECT id, customerName, total, created_at FROM orders WHERE transactionId = ? LIMIT 1',
    [cleanTxId]
  );

  if (existing.length > 0) {
    return {
      success: false,
      duplicate: true,
      existingOrderId: existing[0].id,
      message: `Transaction/UTR '${cleanTxId}' has already been processed for order ${existing[0].id}.`
    };
  }

  try {
    const paymentStatus = orderData.paymentStatus || 'Awaiting_Verification';
    const orderStatus = orderData.orderStatus || 'Awaiting_Verification';
    const stockReserved = orderData.stockReserved !== undefined ? Boolean(orderData.stockReserved) : true;

    const sql = `
      INSERT INTO orders (
        id, userId, customerName, customerEmail, customerPhone, shippingAddress,
        items, subtotal, discount, tax, shippingFee, total, paymentMethod, transactionId,
        paymentStatus, orderStatus, stockReserved
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UPI_QR', ?, ?, ?, ?)
    `;

    const params = [
      orderId,
      userId || null,
      customerName,
      customerEmail,
      customerPhone || '',
      shippingAddress || '',
      typeof items === 'string' ? items : JSON.stringify(items),
      Number(subtotal || total),
      Number(discount || 0),
      Number(tax || 0),
      Number(shippingFee || 0),
      Number(total),
      cleanTxId,
      paymentStatus,
      orderStatus,
      stockReserved
    ];

    await pool.query(sql, params);

    return {
      success: true,
      orderId,
      transactionId: cleanTxId,
      message: 'Order and QR payment recorded successfully'
    };
  } catch (err) {
    // Gracefully catch MySQL duplicate entry error (ER_DUP_ENTRY / 1062) for concurrent submissions
    if (err.code === 'ER_DUP_ENTRY' || err.errno === 1062) {
      console.warn(`[DB Duplicate Prevented] Transaction ID collision detected: ${cleanTxId}`);
      return {
        success: false,
        duplicate: true,
        message: `Transaction reference '${cleanTxId}' was just recorded by another request.`
      };
    }
    // Re-throw unexpected DB errors to be caught by route-level try/catch
    throw err;
  }
}

module.exports = {
  pool,
  query: (sql, params) => pool.query(sql, params),
  execute: (sql, params) => pool.execute(sql, params),
  testConnection,
  ensureUserOtpColumns,
  ensureOrderColumns,
  ensureStockColumns,
  ensurePromoCodeTable,
  ensureAdminAuditLogTable,
  recordAdminAuditLog,
  findUserByIdentifier,
  findOrderByTransactionId,
  recordQrPayment,
  saveUserOtp,
  verifyUserOtp,
  clearUserOtp,
  getAdminEmails,
};
