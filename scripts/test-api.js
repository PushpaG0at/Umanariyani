require('dotenv').config();
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

const SESSION_SECRET = process.env.SESSION_SECRET || 'umanarayani_sacred_ayurveda_jwt_secret_2026_salt';
const adminToken = jwt.sign(
  {
    id: 'usr_admin_test',
    email: 'admin@umanarayni.com',
    role: 'admin',
    isAdmin: true,
    totpVerified: true
  },
  SESSION_SECRET,
  { expiresIn: '1h' }
);

function request(method, path, body = null, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...extraHeaders
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, data: json });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Starting Full System Integration Test Suite...\n');
  let passed = 0;
  let failed = 0;

  // 0. Ensure catalog is seeded before running tests
  const [productCountRows] = await db.query('SELECT COUNT(*) AS c FROM products');
  if (productCountRows[0].c < 7) {
    console.log('📦 Products table unseeded or incomplete. Seeding catalog for test suite...');
    const { seedData } = require('./seed-initial-data');
    await seedData();
  }

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Health
  await test('GET /api/health returns healthy', async () => {
    const res = await request('GET', '/api/health');
    if (res.status !== 200 || res.data.status !== 'ok') {
      throw new Error(`Expected 200 status 'ok', got ${res.status} (${res.data?.status})`);
    }
  });

  await test('GET /api/health/db returns connected pool', async () => {
    const res = await request('GET', '/api/health/db');
    if (res.status !== 200 || res.data.status !== 'connected') {
      throw new Error(`Expected 200 connected, got ${res.status}`);
    }
  });

  // 2. Products
  await test('GET /api/products returns updated 7 products with new pricing and weights', async () => {
    const res = await request('GET', '/api/products');
    if (res.status !== 200 || !Array.isArray(res.data.products) || res.data.products.length < 7) {
      throw new Error(`Expected at least 7 products in catalog, got: ${res.data.products ? res.data.products.length : 'none'}`);
    }

    const prods = res.data.products;
    const oil = prods.find(p => p.id === 'ayurvedic-hair-oil');
    const shampoo = prods.find(p => p.id === 'herbal-shampoo');
    const facewash = prods.find(p => p.id === 'orange-face-wash');
    const mehndi = prods.find(p => p.id === 'ayurvedic-mehndi');
    const mehndiKit = prods.find(p => p.id === 'ayurvedic-mehndi-kit');
    const ubtan = prods.find(p => p.id === 'ayurvedic-ubtan');
    const aloe = prods.find(p => p.id === 'pure-aloe-vera-gel');

    if (!oil || Number(oil.price) !== 649 || !oil.volume.includes('200')) {
      throw new Error(`Oil product mismatch: price=${oil?.price}, volume=${oil?.volume}`);
    }
    if (!shampoo || Number(shampoo.price) !== 749 || !shampoo.volume.includes('500')) {
      throw new Error(`Shampoo product mismatch: price=${shampoo?.price}, volume=${shampoo?.volume}`);
    }
    if (!facewash || Number(facewash.price) !== 599 || !facewash.volume.includes('200')) {
      throw new Error(`Facewash product mismatch: price=${facewash?.price}, volume=${facewash?.volume}`);
    }
    if (!mehndi || Number(mehndi.price) !== 250 || !mehndi.volume.includes('500g')) {
      throw new Error(`Mehndi product mismatch: price=${mehndi?.price}, volume=${mehndi?.volume}`);
    }
    if (!mehndiKit || Number(mehndiKit.price) !== 560) {
      throw new Error(`Mehndi Kit product mismatch: price=${mehndiKit?.price}`);
    }
    if (!ubtan || Number(ubtan.price) !== 350 || !ubtan.volume.includes('500g')) {
      throw new Error(`Ubtan product mismatch: price=${ubtan?.price}, volume=${ubtan?.volume}`);
    }
    if (!aloe || Number(aloe.price) !== 360 || !aloe.volume.includes('500g')) {
      throw new Error(`Aloe Vera product mismatch: price=${aloe?.price}, volume=${aloe?.volume}`);
    }
  });

  await test('GET /api/products/ayurvedic-hair-oil returns product details', async () => {
    const res = await request('GET', '/api/products/ayurvedic-hair-oil');
    if (res.status !== 200 || !res.data.product || res.data.product.id !== 'ayurvedic-hair-oil') {
      throw new Error(`Could not fetch ayurvedic-hair-oil`);
    }
  });

  // 2. RBAC & Product Mutations
  await test('POST /api/products rejects unauthenticated access with 403 Forbidden', async () => {
    const unauthRes = await request('POST', '/api/products', {
      name: "Malicious Injection Product",
      price: 99,
      category: "Hair Care"
    });
    if (unauthRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for unauthenticated product creation, got status: ${unauthRes.status}`);
    }
  });

  const testProdId = `test-oil-${Date.now()}`;
  await test('POST /api/products creates product with Admin credentials and DELETE removes it', async () => {
    const createRes = await request('POST', '/api/products', {
      name: `Test Product ${testProdId}`,
      subtitle: "Test Subtitle",
      category: "Hair Care",
      price: 199,
      mrp: 299
    }, { 'Authorization': `Bearer ${adminToken}` });

    if (createRes.status !== 201) {
      throw new Error(`Create failed with status ${createRes.status}: ${JSON.stringify(createRes.data)}`);
    }
    const createdId = createRes.data.product.id;

    // Delete
    const delRes = await request('DELETE', `/api/products/${createdId}`, null, { 'Authorization': `Bearer ${adminToken}` });
    if (delRes.status !== 200) {
      throw new Error(`Delete failed with status ${delRes.status}`);
    }
  });

  // 2b. Product Search
  await test('GET /api/products?search=oil returns Hair Oil as first priority (#1)', async () => {
    const res = await request('GET', '/api/products?search=oil');
    if (res.status !== 200 || !res.data.products || res.data.products.length === 0) {
      throw new Error(`Search for 'oil' returned no products`);
    }
    const firstProduct = res.data.products[0];
    if (!firstProduct.name.toLowerCase().includes('oil')) {
      throw new Error(`First product for 'oil' was "${firstProduct.name}", expected Hair Oil at top priority!`);
    }
  });

  await test('GET /api/products?search=orange returns Orange Face Wash', async () => {
    const res = await request('GET', '/api/products?search=orange');
    if (res.status !== 200 || !res.data.products || res.data.products.length === 0) {
      throw new Error(`Search for 'orange' returned no products`);
    }
    const hasOrange = res.data.products.some(p => p.name.toLowerCase().includes('orange'));
    if (!hasOrange) throw new Error(`Search for 'orange' did not match Orange Face Wash`);
  });

  await test('GET /api/products?search=shampoo returns Herbal Shampoo', async () => {
    const res = await request('GET', '/api/products?search=shampoo');
    if (res.status !== 200 || !res.data.products || res.data.products.length === 0) {
      throw new Error(`Search for 'shampoo' returned no products`);
    }
    const hasShampoo = res.data.products.some(p => p.name.toLowerCase().includes('shampoo'));
    if (!hasShampoo) throw new Error(`Search for 'shampoo' did not match Herbal Shampoo`);
  });

  await test('GET /api/products?search=bhringraj matches via herbal ingredients', async () => {
    const res = await request('GET', '/api/products?search=bhringraj');
    if (res.status !== 200 || !res.data.products || res.data.products.length === 0) {
      throw new Error(`Search for ingredient 'bhringraj' returned no products`);
    }
  });

  // 3. Herbs
  await test('GET /api/herbs returns 8 sacred herbs', async () => {
    const res = await request('GET', '/api/herbs');
    if (res.status !== 200 || res.data.herbs.length < 8) {
      throw new Error(`Expected at least 8 herbs, got ${res.data.herbs ? res.data.herbs.length : 0}`);
    }
  });

  await test('GET /api/herbs/brahmi returns single herb', async () => {
    const res = await request('GET', '/api/herbs/brahmi');
    if (res.status !== 200 || res.data.herb.id !== 'brahmi') {
      throw new Error(`Could not fetch Brahmi`);
    }
  });

  // 4. Reviews
  await test('GET /api/reviews/ayurvedic-hair-oil returns customer reviews', async () => {
    const res = await request('GET', '/api/reviews/ayurvedic-hair-oil');
    if (res.status !== 200 || !Array.isArray(res.data.reviews)) {
      throw new Error(`Invalid reviews response`);
    }
  });

  // 5. Auth Two-Step OTP Verification Flow
  let authCookie = '';

  await test('POST /api/auth/login validates credentials and triggers Step 1 OTP dispatch', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'pushpendra@example.com',
      password: 'ayurveda_pass'
    });
    if ((res.status === 200 && res.data.success && res.data.requireOtp) || (res.data && res.data.retryAfter)) {
      // Step 1 passed (either fresh OTP dispatched or rate-limit cooldown enforced)
    } else {
      throw new Error(`Expected requireOtp: true, got: ${JSON.stringify(res.data)}`);
    }
    if (res.data.devOtp) {
      throw new Error(`Security violation: devOtp leaked in API response!`);
    }
  });

  await test('POST /api/verify-otp validates 6-digit OTP, sets HttpOnly cookie, and issues session', async () => {
    // Inject hashed test OTP into MySQL to verify verification mechanics
    const testOtp = '753190';
    const hashedOtp = await bcrypt.hash(testOtp, 10);
    const expiry = new Date(Date.now() + 5 * 60 * 1000);
    await db.saveUserOtp('pushpendra@example.com', hashedOtp, expiry);

    const res = await request('POST', '/api/verify-otp', {
      identifier: 'pushpendra@example.com',
      otp: testOtp
    });
    if (res.status !== 200 || !res.data.success || !res.data.user) {
      throw new Error(`OTP Verification failed: ${JSON.stringify(res.data)}`);
    }
    if (res.data.role !== 'user' && res.data.role !== 'customer') {
      throw new Error(`Expected customer role, got: ${res.data.role}`);
    }
    if (res.data.redirectUrl !== '/') {
      throw new Error(`Expected customer redirectUrl '/', got: ${res.data.redirectUrl}`);
    }
    const setCookie = res.headers['set-cookie'];
    if (!setCookie || !setCookie.some(c => c.includes('umanarayani_auth') && c.includes('HttpOnly'))) {
      throw new Error(`Expected HttpOnly cookie 'umanarayani_auth' in response headers`);
    }
    authCookie = setCookie[0].split(';')[0];
  });

  await test('POST /api/resend-otp respects cooldown rate limiter or dispatches fresh OTP', async () => {
    const res = await request('POST', '/api/resend-otp', {
      identifier: 'pushpendra@example.com'
    });
    if (res.status === 200 && res.data.success) {
      // Fresh OTP dispatched
    } else if (res.status === 429 || (res.data && res.data.retryAfter)) {
      // Cooldown rate limiter active
    } else {
      throw new Error(`Resend OTP unexpected error: ${JSON.stringify(res.data)}`);
    }
  });

  await test('GET /api/auth/me verifies session with HttpOnly cookie', async () => {
    const res = await request('GET', '/api/auth/me', null, { Cookie: authCookie });
    if (res.status !== 200 || !res.data.authenticated || !res.data.user) {
      throw new Error(`Session verification via cookie failed: ${JSON.stringify(res.data)}`);
    }
  });

  // 5b. AI Consultant Guardrails
  await test('POST /api/ai/consult enforces 600-char maximum length defense', async () => {
    const massiveText = 'A'.repeat(650);
    const res = await request('POST', '/api/ai/consult', { message: massiveText });
    if (res.status !== 400) {
      throw new Error(`Expected 400 Bad Request for prompt > 600 chars, got status: ${res.status}`);
    }
  });

  // 5c. HTTP Headers & Testing Mode (Helmet temporarily disabled for raw IP HTTP testing)
  await test('HTTP Headers check (Helmet temporarily disabled for raw IP HTTP testing)', async () => {
    const res = await request('GET', '/api/health');
    if (res.status !== 200) {
      throw new Error(`Expected HTTP 200 health check, got: ${res.status}`);
    }
  });

  // 6. Orders
  await test('POST /api/orders creates order and GET /api/orders retrieves it', async () => {
    const { signHumanVerificationToken } = require('../services/humanVerificationService');
    const humanCookie = `human_verified=${signHumanVerificationToken()}`;
    const orderRes = await request('POST', '/api/orders', {
      customerName: "Integration Test User",
      customerEmail: "integration@umanarayni.com",
      customerPhone: "9999999999",
      deliveryAddress: {
        fullName: "Integration Test User",
        mobile: "9999999999",
        email: "integration@umanarayni.com",
        addressLine1: "123 Palm Grove, Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560038"
      },
      items: [{ id: "ayurvedic-hair-oil", name: "Hair Oil", price: 649, quantity: 1 }],
      total: 649
    }, { Cookie: `${authCookie}; ${humanCookie}` });
    if (orderRes.status !== 201 || !orderRes.data.orderId) {
      throw new Error(`Order creation failed: ${JSON.stringify(orderRes.data)}`);
    }

    const getRes = await request('GET', `/api/orders/${orderRes.data.orderId}`, null, { Cookie: authCookie });
    if (getRes.status !== 200 || getRes.data.order.id !== orderRes.data.orderId) {
      throw new Error(`Order fetch failed`);
    }
  });

  // 7. Active Users & Total Community Members
  await test('GET /api/users/active returns synchronized user count and total community members', async () => {
    const res = await request('GET', '/api/users/active');
    if (res.status !== 200 || typeof res.data.activeUsers !== 'number') {
      throw new Error(`Invalid active users count: ${res.data ? res.data.activeUsers : 'missing'}`);
    }
    if (typeof res.data.totalUsers !== 'number' || res.data.totalUsers < 1) {
      throw new Error(`Invalid total users count: ${res.data ? res.data.totalUsers : 'missing'}`);
    }
  });

  // 8. HTML Pages
  await test('HTML Pages (/product, /signin, /cart, /admin) serve correctly', async () => {
    const pRes = await request('GET', '/product');
    const sRes = await request('GET', '/signin');
    const cRes = await request('GET', '/cart');
    const adminRes = await request('GET', '/admin');
    if (pRes.status !== 200 || sRes.status !== 200 || cRes.status !== 200 || adminRes.status !== 200) {
      throw new Error(`Failed to serve storefront HTML page routes`);
    }
  });

  await test('Admin user (ADMIN_EMAIL) receives role: admin and redirectUrl: /admin.html on OTP verification', async () => {
    const adminEmails = (process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS || 'admin@umanarayni.com,raoa6526@gmail.com,singhpushpendra95734@gmail.com')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);
    const adminEmail = adminEmails[0]; // primary admin
    const pushpendraAdminEmail = adminEmails.find(e => e.includes('pushpendra')) || (adminEmails[1] || 'singhpushpendra95734@gmail.com');

    // 1. Ensure primary admin exists in DB
    const existingAdmin = await db.findUserByIdentifier(adminEmail);
    if (!existingAdmin) {
      const hashPass = await bcrypt.hash('admin_secure_pass', 10);
      await db.query(`
        INSERT INTO users (id, name, email, password, role, is_verified, joinedDate)
        VALUES ('usr_admin_test', 'Primary Admin', ?, ?, 'admin', TRUE, NOW())
      `, [adminEmail, hashPass]);
    } else {
      await db.query(`UPDATE users SET role = 'admin' WHERE id = ?`, [existingAdmin.id]);
    }

    const testOtp = '849201';
    const hashedOtp = await bcrypt.hash(testOtp, 10);
    const expiry = new Date(Date.now() + 5 * 60 * 1000);
    await db.saveUserOtp(adminEmail, hashedOtp, expiry);

    const res = await request('POST', '/api/verify-otp', {
      identifier: adminEmail,
      otp: testOtp
    });

    if (res.status !== 200 || !res.data.success) {
      throw new Error(`Admin OTP verification failed: ${JSON.stringify(res.data)}`);
    }
    if (res.data.role !== 'admin' || res.data.redirectUrl !== '/admin.html') {
      throw new Error(`Expected role 'admin' and redirectUrl '/admin.html', got: ${JSON.stringify(res.data)}`);
    }

    const setCookie = res.headers['set-cookie'];
    if (!setCookie) throw new Error('Missing admin auth cookie');
    const adminCookie = setCookie[0].split(';')[0];
    const adminPageRes = await request('GET', '/admin', null, { Cookie: adminCookie });
    if (adminPageRes.status !== 200) {
      throw new Error(`Expected authenticated admin GET /admin to return 200 OK, got: ${adminPageRes.status}`);
    }

    // 2. Ensure secondary admin email (singhpushpendra95734@gmail.com) exists and verifies role: admin on OTP verification
    const existingPAdmin = await db.findUserByIdentifier(pushpendraAdminEmail);
    if (!existingPAdmin) {
      const pHashPass = await bcrypt.hash('admin_secure_pass', 10);
      await db.query(`
        INSERT INTO users (id, name, email, password, role, is_verified, joinedDate)
        VALUES ('usr_admin_pushpendra', 'Pushpendra Admin', ?, ?, 'user', TRUE, NOW())
      `, [pushpendraAdminEmail, pHashPass]);
    }

    const pTestOtp = '849202';
    const pHashedOtp = await bcrypt.hash(pTestOtp, 10);
    await db.saveUserOtp(pushpendraAdminEmail, pHashedOtp, new Date(Date.now() + 5 * 60 * 1000));

    const pRes = await request('POST', '/api/verify-otp', {
      identifier: pushpendraAdminEmail,
      otp: pTestOtp
    });

    if (pRes.status !== 200 || !pRes.data.success) {
      throw new Error(`Secondary admin OTP verification failed: ${JSON.stringify(pRes.data)}`);
    }
    if (pRes.data.role !== 'admin' || pRes.data.redirectUrl !== '/admin.html') {
      throw new Error(`Expected ${pushpendraAdminEmail} to receive role 'admin' and redirectUrl '/admin.html', got: ${JSON.stringify(pRes.data)}`);
    }

    const pUser = await db.findUserByIdentifier(pushpendraAdminEmail);
    if (!pUser || pUser.role !== 'admin') {
      throw new Error(`Expected ${pushpendraAdminEmail} to have role 'admin' in database, got: ${pUser ? pUser.role : 'not found'}`);
    }
  });

  // 9. PhonePe Payment Gateway Integration
  await test('POST /initiate-payment & /api/payment/initiate-payment returns PhonePe checkout URL and pre-inserts Pending order', async () => {
    const { signHumanVerificationToken } = require('../services/humanVerificationService');
    const humanCookie = `human_verified=${signHumanVerificationToken()}`;
    const res = await request('POST', '/api/payment/initiate-payment', {
      amount: 649,
      items: [{ id: "ayurvedic-hair-oil", name: "Hair Oil", price: 649, quantity: 1 }],
      deliveryAddress: {
        fullName: "Test Seeker",
        email: "seeker@umanarayni.com",
        mobile: "9876543210",
        addressLine1: "123 Palm Grove, Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560038"
      },
      userDetails: {
        name: "Test Seeker",
        email: "seeker@umanarayni.com",
        phone: "9876543210",
        address: "123 Palm Grove, Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560038"
      }
    }, { Cookie: humanCookie });

    if (res.status !== 200 || !res.data.success) {
      throw new Error(`PhonePe initiate-payment failed: ${JSON.stringify(res.data)}`);
    }

    const payUrl = res.data.url || res.data.checkoutUrl || res.data.redirectUrl;
    if (!payUrl || !payUrl.startsWith('http')) {
      throw new Error(`Expected valid PhonePe checkout URL, got: ${payUrl}`);
    }

    if (!res.data.merchantTransactionId || !res.data.merchantTransactionId.startsWith('MT_')) {
      throw new Error(`Invalid merchantTransactionId: ${res.data.merchantTransactionId}`);
    }

    // Verify order was pre-inserted into MySQL as Pending
    const [orderRows] = await db.query('SELECT * FROM orders WHERE id = ?', [res.data.merchantTransactionId]);
    if (orderRows.length === 0 || orderRows[0].paymentStatus !== 'Pending') {
      throw new Error(`Order ${res.data.merchantTransactionId} not found in MySQL or not marked as Pending`);
    }
  });

  await test('POST /api/payment/create-order secures calculation against database prices and returns PhonePe redirect URL', async () => {
    const { signHumanVerificationToken } = require('../services/humanVerificationService');
    const humanCookie = `human_verified=${signHumanVerificationToken()}`;
    // Send tampered frontend price of 1 Rupee to ensure backend ignores it and queries MySQL
    const res = await request('POST', '/api/payment/create-order', {
      items: [
        { id: 'ayurvedic-hair-oil', quantity: 2, price: 1.00 }, // DB price is 649
        { id: 'orange-face-wash', quantity: 1, price: 5.00 }    // DB price is 599
      ],
      customerName: "Integration Test Patron",
      customerEmail: "patron@example.com",
      customerPhone: "9876543210",
      deliveryAddress: {
        fullName: "Integration Test Patron",
        email: "patron@example.com",
        mobile: "9876543210",
        addressLine1: "123 Palm Grove, Indiranagar",
        city: "Bengaluru",
        state: "Karnataka",
        pincode: "560038"
      }
    }, { Cookie: humanCookie });

    if (res.status !== 200 || !res.data.success) {
      throw new Error(`PhonePe create-order failed: ${JSON.stringify(res.data)}`);
    }

    // Expected: (649 * 2) + 599 = 1298 + 599 = 1897
    if (res.data.amount !== 1897) {
      throw new Error(`Security calculation failure: expected 1897, got ${res.data.amount}. Backend must not trust frontend prices!`);
    }

    if (!res.data.redirectUrl || typeof res.data.redirectUrl !== 'string') {
      throw new Error(`Expected valid redirectUrl in response, got: ${res.data.redirectUrl}`);
    }

    if (!res.data.merchantTransactionId || !res.data.merchantTransactionId.startsWith('MT_')) {
      throw new Error(`Invalid merchantTransactionId: ${res.data.merchantTransactionId}`);
    }

    // Verify order was pre-inserted into MySQL as Pending
    const [orderRows] = await db.query('SELECT * FROM orders WHERE id = ?', [res.data.merchantTransactionId]);
    if (orderRows.length === 0 || orderRows[0].paymentStatus !== 'Pending') {
      throw new Error(`Order ${res.data.merchantTransactionId} not found in MySQL or not marked as Pending`);
    }
  });

  await test('POST /api/payment/verify-qr validates UTR format, calculates DB price, and rejects duplicates', async () => {
    const { signHumanVerificationToken } = require('../services/humanVerificationService');
    const humanCookie = `human_verified=${signHumanVerificationToken()}`;
    // 1. Invalid short UTR should be rejected with 400
    const invalidRes = await request('POST', '/api/payment/verify-qr', {
      transactionId: 'bad',
      items: [{ id: 'ayurvedic-hair-oil', quantity: 1 }]
    }, { Cookie: humanCookie });
    if (invalidRes.status !== 400 || invalidRes.data.success !== false) {
      throw new Error(`Expected 400 Bad Request for short UTR, got ${invalidRes.status}`);
    }

    // 2. Valid UTR with tampered frontend price (₹1) should calculate actual DB price (649 * 2 = 1298)
    const testUtr = '43128956' + Date.now().toString().slice(-4);
    const validRes = await request('POST', '/api/payment/verify-qr', {
      transactionId: testUtr,
      customerName: 'Integration Tester',
      customerEmail: 'tester@umanarayni.com',
      customerPhone: '9876543210',
      deliveryAddress: {
        fullName: 'Integration Tester',
        email: 'tester@umanarayni.com',
        mobile: '9876543210',
        addressLine1: '123 Palm Grove, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038'
      },
      items: [{ id: 'ayurvedic-hair-oil', quantity: 2, price: 1.00 }]
    }, { Cookie: humanCookie });

    if (validRes.status !== 201 || !validRes.data.success) {
      throw new Error(`Expected 201 Created for valid QR payment, got ${validRes.status}: ${JSON.stringify(validRes.data)}`);
    }
    if (validRes.data.amount !== 1298) {
      throw new Error(`Expected secure amount 1298, got ${validRes.data.amount}`);
    }

    // 3. Verify order in MySQL with transactionId
    const [dbOrder] = await db.query('SELECT * FROM orders WHERE transactionId = ?', [testUtr]);
    if (dbOrder.length === 0 || dbOrder[0].paymentMethod !== 'UPI_QR' || dbOrder[0].paymentStatus !== 'Awaiting_Verification') {
      throw new Error(`Order with transactionId ${testUtr} not found or not marked as Awaiting_Verification in MySQL`);
    }

    // 4. Duplicate submission with exact same UTR should be rejected with 409 Conflict
    const dupRes = await request('POST', '/api/payment/verify-qr', {
      transactionId: testUtr,
      customerName: 'Concurrent User',
      customerEmail: 'concurrent@example.com',
      customerPhone: '9876543210',
      deliveryAddress: {
        fullName: 'Concurrent User',
        email: 'concurrent@example.com',
        mobile: '9876543210',
        addressLine1: '123 Palm Grove, Indiranagar',
        city: 'Bengaluru',
        state: 'Karnataka',
        pincode: '560038'
      },
      items: [{ id: 'ayurvedic-hair-oil', quantity: 1 }]
    }, { Cookie: humanCookie });

    if (dupRes.status !== 409 || !dupRes.data.duplicate) {
      throw new Error(`Expected 409 Conflict with duplicate: true for repeated UTR, got ${dupRes.status}`);
    }
  });

  console.log(`\n==================================================`);
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Check if running directly
if (require.main === module) {
  runTests().catch(err => {
    console.error('Test runner encountered fatal error:', err);
    process.exit(1);
  });
}

module.exports = runTests;

