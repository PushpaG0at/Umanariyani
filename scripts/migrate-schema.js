/**
 * ==============================================================================
 * UMANARAYNI AYURVEDA — SAFE IDEMPOTENT DATABASE SCHEMA MIGRATION
 * ==============================================================================
 * Safe to execute on EVERY deployment.
 * 
 * Guarantees:
 * 1. Creates missing tables with CREATE TABLE IF NOT EXISTS.
 * 2. Idempotently adds missing columns to existing tables.
 * 3. Never deletes, overwrites, or truncates live customer orders, users,
 *    inventory levels, prices, or product content.
 * ==============================================================================
 */

require('dotenv').config();
const mysql = require('mysql2/promise');

async function migrateSchema() {
  console.log('🔄 [Schema Migration] Connecting to MySQL...');

  const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'umanarayani',
    multipleStatements: true,
  };

  const connection = await mysql.createConnection(dbConfig);
  console.log(`✅ [Schema Migration] Connected to database "${dbConfig.database}" at ${dbConfig.host}:${dbConfig.port}`);

  try {
    console.log('📦 [Schema Migration] Ensuring all core tables exist...');

    await connection.query(`
      -- USERS TABLE
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(160) NULL UNIQUE,
        phone_number VARCHAR(32) NULL UNIQUE,
        is_verified BOOLEAN DEFAULT FALSE,
        otp_code VARCHAR(255) NULL,
        otp_expiry DATETIME NULL,
        password VARCHAR(255) NOT NULL,
        dosha VARCHAR(100) DEFAULT 'Balanced Tridosha',
        hairType VARCHAR(100) DEFAULT 'Normal',
        avatar VARCHAR(50) DEFAULT '🌿',
        role VARCHAR(20) DEFAULT 'user',
        joinedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_user_email (email),
        INDEX idx_user_phone (phone_number)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- HERBS TABLE
      CREATE TABLE IF NOT EXISTS herbs (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        hindi VARCHAR(120),
        botanical VARCHAR(255),
        image VARCHAR(255),
        tagline VARCHAR(255),
        shortBenefit VARCHAR(255),
        role TEXT,
        benefits JSON,
        presentIn JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- PRODUCTS TABLE
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        subtitle VARCHAR(255),
        tagline VARCHAR(255),
        category VARCHAR(100),
        categorySlug VARCHAR(100),
        price DECIMAL(10, 2) NOT NULL,
        mrp DECIMAL(10, 2),
        discountPercent INT DEFAULT 0,
        rating DECIMAL(3, 2) DEFAULT 5.0,
        ratingCount INT DEFAULT 0,
        badge VARCHAR(50),
        volume VARCHAR(100),
        image VARCHAR(500),
        gallery JSON,
        inStock BOOLEAN DEFAULT TRUE,
        stockCount INT DEFAULT 0,
        asin VARCHAR(50),
        shortDescription TEXT,
        description LONGTEXT,
        keyBenefits JSON,
        featuredIngredients JSON,
        ingredientsDetails JSON,
        howToUse TEXT,
        usageSteps JSON,
        suitableFor TEXT,
        certifications JSON,
        faqs JSON,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_product_category (categorySlug),
        INDEX idx_product_name (name),
        INDEX idx_product_cat (category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- REVIEWS TABLE
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(64) PRIMARY KEY,
        productId VARCHAR(100) NOT NULL,
        author VARCHAR(120) NOT NULL,
        location VARCHAR(120),
        rating INT NOT NULL,
        date VARCHAR(60),
        title VARCHAR(255),
        body TEXT NOT NULL,
        verifiedPurchase BOOLEAN DEFAULT TRUE,
        helpfulCount INT DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_review_product (productId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- ORDERS TABLE
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(64) PRIMARY KEY,
        userId VARCHAR(64),
        customerName VARCHAR(120) NOT NULL,
        customerEmail VARCHAR(160) NOT NULL,
        customerPhone VARCHAR(50),
        shippingAddress TEXT NOT NULL,
        items JSON NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(10, 2) DEFAULT 0,
        tax DECIMAL(10, 2) DEFAULT 0,
        shippingFee DECIMAL(10, 2) DEFAULT 0,
        total DECIMAL(10, 2) NOT NULL,
        paymentMethod VARCHAR(50) DEFAULT 'COD',
        paymentStatus VARCHAR(50) DEFAULT 'Pending',
        orderStatus VARCHAR(50) DEFAULT 'Processing',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_order_user (userId)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- SITE STATS TABLE
      CREATE TABLE IF NOT EXISTS site_stats (
        stat_key VARCHAR(64) PRIMARY KEY,
        stat_value BIGINT NOT NULL DEFAULT 0,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      INSERT IGNORE INTO site_stats (stat_key, stat_value) VALUES ('total_visitors', 1240);

      -- PASSWORD RESETS TABLE
      CREATE TABLE IF NOT EXISTS password_resets (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        identifier VARCHAR(255) NOT NULL,
        channel ENUM('email', 'sms') NOT NULL,
        otp_hash VARCHAR(255) NULL,
        otp_expires_at DATETIME NULL,
        otp_attempts INT DEFAULT 0,
        reset_token_hash VARCHAR(255) NULL,
        token_expires_at DATETIME NULL,
        is_used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_pwd_resets_user (user_id),
        INDEX idx_pwd_resets_ident (identifier),
        INDEX idx_pwd_resets_token (reset_token_hash),
        INDEX idx_pwd_resets_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- ADDRESSES TABLE
      CREATE TABLE IF NOT EXISTS addresses (
        id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        label VARCHAR(50) DEFAULT 'Home',
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(160) NOT NULL,
        address_line1 VARCHAR(255) NOT NULL,
        address_line2 VARCHAR(255) NULL,
        landmark VARCHAR(255) NULL,
        city VARCHAR(100) NOT NULL,
        state VARCHAR(100) NOT NULL,
        pincode VARCHAR(10) NOT NULL,
        is_default BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_address_user (user_id),
        INDEX idx_address_user_default (user_id, is_default),
        CONSTRAINT fk_address_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

      -- PROMO CODES TABLE
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

      -- ADMIN AUDIT LOGS TABLE
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

    // Idempotent Column Migrations
    console.log('🔍 [Schema Migration] Checking and applying idempotent column additions...');
    
    // Users columns
    const [userCols] = await connection.query('DESCRIBE users');
    const userColNames = userCols.map(c => c.Field);
    if (!userColNames.includes('password_changed_at')) {
      await connection.query('ALTER TABLE users ADD COLUMN password_changed_at DATETIME NULL AFTER password');
      console.log('   ✅ Added password_changed_at column to users table.');
    }
    if (!userColNames.includes('totp_secret')) {
      await connection.query('ALTER TABLE users ADD COLUMN totp_secret VARCHAR(128) NULL AFTER role');
      console.log('   ✅ Added totp_secret column to users table.');
    }
    if (!userColNames.includes('totp_enabled')) {
      await connection.query('ALTER TABLE users ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE AFTER totp_secret');
      console.log('   ✅ Added totp_enabled column to users table.');
    }

    // Orders columns
    const [orderCols] = await connection.query('DESCRIBE orders');
    const orderColNames = orderCols.map(c => c.Field);
    if (!orderColNames.includes('shipping_address_json')) {
      await connection.query('ALTER TABLE orders ADD COLUMN shipping_address_json JSON NULL AFTER shippingAddress');
      console.log('   ✅ Added shipping_address_json column to orders table.');
    }
    if (!orderColNames.includes('city')) {
      await connection.query('ALTER TABLE orders ADD COLUMN city VARCHAR(100) NULL AFTER shipping_address_json');
      console.log('   ✅ Added city column to orders table.');
    }
    if (!orderColNames.includes('state')) {
      await connection.query('ALTER TABLE orders ADD COLUMN state VARCHAR(100) NULL AFTER city');
      console.log('   ✅ Added state column to orders table.');
    }
    if (!orderColNames.includes('pincode')) {
      await connection.query('ALTER TABLE orders ADD COLUMN pincode VARCHAR(10) NULL AFTER state');
      console.log('   ✅ Added pincode column to orders table.');
    }

    console.log('\n🎉 [Schema Migration] SUCCESS: All tables and columns are up to date.');
    console.log('ℹ️  [Schema Migration] 0 data rows were modified. Safe to run on every deploy.');
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  migrateSchema()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ [Schema Migration Failed]:', err);
      process.exit(1);
    });
}

module.exports = { migrateSchema };
