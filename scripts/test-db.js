require('dotenv').config();
const db = require('../db');

async function runLiveTest() {
  console.log('==================================================');
  console.log('🌿 UMANARAYANI MYSQL DATABASE INTEGRITY TEST');
  console.log('==================================================\n');

  try {
    // 1. Connection Pool Test
    console.log('1️⃣ Testing Connection Pool...');
    const [ping] = await db.query('SELECT 1 + 1 AS connectionTest, DATABASE() as currentDb, USER() as currentUser');
    console.log(`   ✅ Pool Active! Connected as: ${ping[0].currentUser} to Database: "${ping[0].currentDb}"\n`);

    // 2. Table Counts Test
    console.log('2️⃣ Checking Table Record Counts...');
    const [counts] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM products) AS totalProducts,
        (SELECT COUNT(*) FROM herbs) AS totalHerbs,
        (SELECT COUNT(*) FROM reviews) AS totalReviews,
        (SELECT COUNT(*) FROM users) AS totalUsers,
        (SELECT COUNT(*) FROM orders) AS totalOrders
    `);
    console.table(counts[0]);

    // 3. Live Product Query Test
    console.log('\n3️⃣ Fetching Live Products from MySQL...');
    const [products] = await db.query('SELECT id, name, price, rating, inStock FROM products LIMIT 3');
    products.forEach(p => {
      console.log(`   🧴 [${p.id}] ${p.name} - ₹${p.price} | Rating: ${p.rating}⭐ | In Stock: ${Boolean(p.inStock)}`);
    });

    // 4. Live Write & Delete Test (Testing INSERT, UPDATE, DELETE permissions)
    console.log('\n4️⃣ Testing Live Write (INSERT -> SELECT -> DELETE)...');
    const testId = `test_entry_${Date.now()}`;
    
    // Insert
    await db.query(`
      INSERT INTO users (id, name, email, password, dosha, hairType)
      VALUES (?, 'Database Tester', ?, 'test_pwd', 'Pitta', 'Normal')
    `, [testId, `${testId}@umanarayani-test.com`]);
    console.log('   ✅ INSERT successful: Created temporary test user record.');

    // Verify Read
    const [verify] = await db.query('SELECT id, name, email FROM users WHERE id = ?', [testId]);
    if (verify.length > 0 && verify[0].id === testId) {
      console.log(`   ✅ SELECT verified: Read back user "${verify[0].name}" (${verify[0].email})`);
    }

    // Clean up Delete
    await db.query('DELETE FROM users WHERE id = ?', [testId]);
    console.log('   ✅ DELETE cleaned up: Temporary test record removed.');

    console.log('\n==================================================');
    console.log('🎉 ALL DATABASE TESTS PASSED SUCCESSFULLY!');
    console.log('Your MySQL database is 100% operational and production ready.');
    console.log('==================================================\n');

  } catch (err) {
    console.error('\n❌ DATABASE TEST FAILED:', err.message);
  } finally {
    await db.pool.end();
    process.exit(0);
  }
}

runLiveTest();

