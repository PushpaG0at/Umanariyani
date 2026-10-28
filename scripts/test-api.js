require('dotenv').config();
const http = require('http');

const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}`;

function request(method, path, body = null) {
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
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch {
          resolve({ status: res.statusCode, raw: data });
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
    if (res.status !== 200 || res.data.status !== 'healthy') {
      throw new Error(`Expected 200 healthy, got ${res.status}`);
    }
  });

  await test('GET /api/health/db returns connected pool', async () => {
    const res = await request('GET', '/api/health/db');
    if (res.status !== 200 || res.data.status !== 'connected') {
      throw new Error(`Expected 200 connected, got ${res.status}`);
    }
  });

  // 2. Products
  await test('GET /api/products returns products list', async () => {
    const res = await request('GET', '/api/products');
    if (res.status !== 200 || !Array.isArray(res.data.products) || res.data.products.length === 0) {
      throw new Error(`Invalid products list response`);
    }
  });

  await test('GET /api/products/ayurvedic-hair-oil returns product details', async () => {
    const res = await request('GET', '/api/products/ayurvedic-hair-oil');
    if (res.status !== 200 || !res.data.product || res.data.product.id !== 'ayurvedic-hair-oil') {
      throw new Error(`Could not fetch ayurvedic-hair-oil`);
    }
  });

  const testProdId = `test-oil-${Date.now()}`;
  await test('POST /api/products creates a product and DELETE removes it', async () => {
    const createRes = await request('POST', '/api/products', {
      name: `Test Product ${testProdId}`,
      subtitle: "Test Subtitle",
      category: "Hair Care",
      price: 199,
      mrp: 299
    });
    if (createRes.status !== 201) {
      throw new Error(`Create failed with status ${createRes.status}`);
    }
    const createdId = createRes.data.product.id;

    // Delete
    const delRes = await request('DELETE', `/api/products/${createdId}`);
    if (delRes.status !== 200) {
      throw new Error(`Delete failed with status ${delRes.status}`);
    }
  });

  // 2b. Product Search
  await test('GET /api/products?search=oil returns matching oil products', async () => {
    const res = await request('GET', '/api/products?search=oil');
    if (res.status !== 200 || !res.data.products || res.data.products.length === 0) {
      throw new Error(`Search for 'oil' returned no products`);
    }
    const hasOil = res.data.products.some(p => p.name.toLowerCase().includes('oil') || p.category.toLowerCase().includes('hair'));
    if (!hasOil) throw new Error(`Search for 'oil' did not match any oil product`);
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

  // 5. Auth Login
  await test('POST /api/auth/login authenticates test user', async () => {
    const res = await request('POST', '/api/auth/login', {
      email: 'pushpendra@example.com',
      password: 'ayurveda_pass'
    });
    if (res.status !== 200 || !res.data.success || !res.data.user) {
      throw new Error(`Authentication failed: ${res.data ? res.data.message : 'Unknown'}`);
    }
  });

  // 6. Orders
  await test('POST /api/orders creates order and GET /api/orders retrieves it', async () => {
    const orderRes = await request('POST', '/api/orders', {
      customerName: "Integration Test User",
      customerEmail: "integration@umanarayani.com",
      customerPhone: "+91 9999999999",
      shippingAddress: "Bengaluru, Karnataka",
      items: [{ id: "ayurvedic-hair-oil", name: "Hair Oil", price: 349, quantity: 1 }],
      total: 349
    });
    if (orderRes.status !== 201 || !orderRes.data.orderId) {
      throw new Error(`Order creation failed`);
    }

    const getRes = await request('GET', `/api/orders/${orderRes.data.orderId}`);
    if (getRes.status !== 200 || getRes.data.order.id !== orderRes.data.orderId) {
      throw new Error(`Order fetch failed`);
    }
  });

  // 7. Active Users
  await test('GET /api/users/active returns synchronized user count', async () => {
    const res = await request('GET', '/api/users/active');
    if (res.status !== 200 || typeof res.data.activeUsers !== 'number') {
      throw new Error(`Invalid active users count`);
    }
  });

  // 8. HTML Pages
  await test('HTML Pages (/product, /signin, /cart, /admin) serve correctly', async () => {
    const pRes = await request('GET', '/product');
    const sRes = await request('GET', '/signin');
    const cRes = await request('GET', '/cart');
    const aRes = await request('GET', '/admin');
    if (pRes.status !== 200 || sRes.status !== 200 || cRes.status !== 200 || aRes.status !== 200) {
      throw new Error(`Failed to serve static HTML page routes`);
    }
  });

  console.log(`\n==================================================`);
  console.log(`RESULTS: ${passed} Passed, ${failed} Failed`);
  console.log(`==================================================\n`);

  if (failed > 0) {
    process.exit(1);
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

