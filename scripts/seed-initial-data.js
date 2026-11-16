/**
 * ==============================================================================
 * UMANARAYNI AYURVEDA — ONE-TIME INITIAL DATA SEEDER (LOCAL / BOOTSTRAP ONLY)
 * ==============================================================================
 * WARNING:
 * This script is intended for initial project bootstrapping ONLY.
 * DO NOT run this script on an active production database as it will reset
 * product attributes and user records to repository defaults.
 * ==============================================================================
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const PRODUCTS_FILE = path.join(__dirname, '..', 'data', 'products.json');
const HERBS_FILE = path.join(__dirname, '..', 'data', 'herbs.json');
const USERS_FILE = path.join(__dirname, '..', 'data', 'users.json');
const REVIEWS_FILE = path.join(__dirname, '..', 'data', 'reviews.json');

async function seedData() {
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force-prod-seed')) {
    console.error('🚫 [Data Seeder] ABORTED: Cannot run initial data seeding in production without explicit --force-prod-seed flag.');
    process.exit(1);
  }

  console.log('🌱 [Data Seeder] Connecting to MySQL...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'umanarayani',
    multipleStatements: true,
  });

  try {
    // Check if products already exist
    const [existing] = await connection.query('SELECT COUNT(*) AS count FROM products');
    if (existing[0].count > 0 && !process.argv.includes('--overwrite')) {
      console.warn(`⚠️ [Data Seeder] Notice: Products table already has ${existing[0].count} items.`);
      console.warn('   To update existing data, pass --overwrite flag.');
      if (!process.argv.includes('--force')) {
        console.log('   Exiting safely without modifying existing records.');
        return;
      }
    }

    // 1. Seed Users
    if (fs.existsSync(USERS_FILE)) {
      const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      console.log(`👤 Seeding ${users.length} initial user(s)...`);
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
      console.log('✅ Users seeded.');
    }

    // 2. Seed Herbs
    if (fs.existsSync(HERBS_FILE)) {
      const herbs = JSON.parse(fs.readFileSync(HERBS_FILE, 'utf8'));
      console.log(`🌿 Seeding ${herbs.length} herb(s)...`);
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
      console.log('✅ Herbs seeded.');
    }

    // 3. Seed Products
    if (fs.existsSync(PRODUCTS_FILE)) {
      const products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
      console.log(`🧴 Seeding ${products.length} product(s)...`);
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
      console.log('✅ Products seeded.');
    }

    // 4. Seed Reviews
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
      console.log(`⭐ Seeded ${reviewCount} review(s).`);
    }

    console.log('\n🎉 [Data Seeder] Initial catalog seeding completed.');
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  seedData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('❌ [Data Seeder Failed]:', err);
      process.exit(1);
    });
}

module.exports = { seedData };
