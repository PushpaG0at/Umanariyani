require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = path.join(__dirname, '..', 'data', 'products.json');
const HERBS_FILE = path.join(__dirname, '..', 'data', 'herbs.json');
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const REVIEWS_FILE = path.join(__dirname, '..', 'data', 'reviews.json');

async function migrate() {
  console.log('🚀 Starting Umanarayani JSON to MySQL Migration...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'umanarayani',
    multipleStatements: true,
  });

  console.log(' Connected to MySQL.');

  // 1. Create Tables
  console.log('📦 Creating database tables if not exist...');

  await connection.query(`
    -- USERS TABLE
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      dosha VARCHAR(100) DEFAULT 'Balanced Tridosha',
      hairType VARCHAR(100) DEFAULT 'Normal',
      avatar VARCHAR(50) DEFAULT '🌿',
      role VARCHAR(32) DEFAULT 'customer',
      joinedDate DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_email (email)
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
      INDEX idx_product_category (categorySlug)
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

    -- ORDERS TABLE (Ready for Production E-commerce)
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
  `);

  console.log('✅ Tables created successfully.');

  // 2. Migrate Users
  if (fs.existsSync(USERS_FILE)) {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
    console.log(`👤 Migrating ${users.length} user(s)...`);
    for (const u of users) {
      await connection.query(`
        INSERT INTO users (id, name, email, password, dosha, hairType, avatar, joinedDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name=VALUES(name),
          dosha=VALUES(dosha),
          hairType=VALUES(hairType),
          avatar=VALUES(avatar)
      `, [
        u.id,
        u.name,
        u.email,
        u.password,
        u.dosha || 'Balanced Tridosha',
        u.hairType || 'Normal',
        u.avatar || '🌿',
        u.joinedDate ? new Date(u.joinedDate) : new Date()
      ]);
    }
    console.log('✅ Users migrated.');
  }

  // 3. Migrate Herbs
  if (fs.existsSync(HERBS_FILE)) {
    const herbs = JSON.parse(fs.readFileSync(HERBS_FILE, 'utf8'));
    console.log(`🌿 Migrating ${herbs.length} herb(s)...`);
    for (const h of herbs) {
      await connection.query(`
        INSERT INTO herbs (id, name, hindi, botanical, image, tagline, shortBenefit, role, benefits, presentIn)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name=VALUES(name),
          hindi=VALUES(hindi),
          botanical=VALUES(botanical),
          image=VALUES(image),
          tagline=VALUES(tagline),
          shortBenefit=VALUES(shortBenefit),
          role=VALUES(role),
          benefits=VALUES(benefits),
          presentIn=VALUES(presentIn)
      `, [
        h.id,
        h.name,
        h.hindi || '',
        h.botanical || '',
        h.image || '',
        h.tagline || '',
        h.shortBenefit || '',
        h.role || '',
        JSON.stringify(h.benefits || []),
        JSON.stringify(h.presentIn || [])
      ]);
    }
    console.log('✅ Herbs migrated.');
  }

  // 4. Migrate Products
  if (fs.existsSync(PRODUCTS_FILE)) {
    const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    console.log(`🧴 Migrating ${products.length} product(s)...`);
    for (const p of products) {
      await connection.query(`
        INSERT INTO products (
          id, name, subtitle, tagline, category, categorySlug, price, mrp, discountPercent,
          rating, ratingCount, badge, volume, image, gallery, inStock, stockCount, asin,
          shortDescription, description, keyBenefits, featuredIngredients, ingredientsDetails,
          howToUse, usageSteps, suitableFor, certifications, faqs
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          name=VALUES(name),
          subtitle=VALUES(subtitle),
          tagline=VALUES(tagline),
          category=VALUES(category),
          categorySlug=VALUES(categorySlug),
          price=VALUES(price),
          mrp=VALUES(mrp),
          discountPercent=VALUES(discountPercent),
          rating=VALUES(rating),
          ratingCount=VALUES(ratingCount),
          badge=VALUES(badge),
          volume=VALUES(volume),
          image=VALUES(image),
          gallery=VALUES(gallery),
          inStock=VALUES(inStock),
          stockCount=VALUES(stockCount),
          asin=VALUES(asin),
          shortDescription=VALUES(shortDescription),
          description=VALUES(description),
          keyBenefits=VALUES(keyBenefits),
          featuredIngredients=VALUES(featuredIngredients),
          ingredientsDetails=VALUES(ingredientsDetails),
          howToUse=VALUES(howToUse),
          usageSteps=VALUES(usageSteps),
          suitableFor=VALUES(suitableFor),
          certifications=VALUES(certifications),
          faqs=VALUES(faqs)
      `, [
        p.id,
        p.name,
        p.subtitle || '',
        p.tagline || '',
        p.category || '',
        p.categorySlug || '',
        p.price,
        p.mrp,
        p.discountPercent || 0,
        p.rating || 5.0,
        p.ratingCount || 0,
        p.badge || '',
        p.volume || '',
        p.image || '',
        JSON.stringify(p.gallery || []),
        p.inStock !== false,
        p.stockCount || 0,
        p.asin || '',
        p.shortDescription || '',
        p.description || '',
        JSON.stringify(p.keyBenefits || []),
        JSON.stringify(p.featuredIngredients || []),
        JSON.stringify(p.ingredientsDetails || []),
        p.howToUse || '',
        JSON.stringify(p.usageSteps || []),
        p.suitableFor || '',
        JSON.stringify(p.certifications || []),
        JSON.stringify(p.faqs || [])
      ]);
    }
    console.log('✅ Products migrated.');
  }

  // 5. Migrate Reviews
  if (fs.existsSync(REVIEWS_FILE)) {
    const reviewsMap = JSON.parse(fs.readFileSync(REVIEWS_FILE, 'utf8'));
    let reviewCount = 0;
    for (const [productId, reviews] of Object.entries(reviewsMap)) {
      for (const r of reviews) {
        await connection.query(`
          INSERT INTO reviews (id, productId, author, location, rating, date, title, body, verifiedPurchase, helpfulCount)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            author=VALUES(author),
            location=VALUES(location),
            rating=VALUES(rating),
            date=VALUES(date),
            title=VALUES(title),
            body=VALUES(body),
            helpfulCount=VALUES(helpfulCount)
        `, [
          r.id,
          productId,
          r.author,
          r.location || '',
          r.rating || 5,
          r.date || '',
          r.title || '',
          r.body,
          r.verifiedPurchase !== false,
          r.helpfulCount || 0
        ]);
        reviewCount++;
      }
    }
    console.log(`⭐ Migrated ${reviewCount} review(s).`);
  }

  console.log('\n🎉 ALL DATA SUCCESSFULLY MIGRATED TO MYSQL!');
  await connection.end();
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

