require('dotenv').config();
const http = require('http');
const assert = require('assert');
const jwt = require('jsonwebtoken');
const app = require('../server');

const SESSION_SECRET = process.env.SESSION_SECRET || 'umanarayani_sacred_ayurveda_jwt_secret_2026_salt';

function makeRequest(baseUrl, path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function runHealthTests() {
  console.log('=============================================================');
  console.log('🌿 UMANARAYNI HEALTH & MONITORING VERIFICATION SUITE');
  console.log('=============================================================\n');

  // Start ephemeral test server
  const testServer = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const port = testServer.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name} - ${err.message}`);
      failed++;
    }
  }

  try {
    // Test 1: GET /health returns 200 with minimal fields: only status and database
    await test('GET /health returns 200 with strictly status and database', async () => {
      const res = await makeRequest(baseUrl, '/health');
      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
      assert.strictEqual(res.data?.status, 'ok', `Expected status ok, got ${res.data?.status}`);
      assert.strictEqual(res.data?.database, 'connected', `Expected database connected, got ${res.data?.database}`);

      // Verify NO internal server metrics are leaked
      const forbiddenKeys = ['nodeVersion', 'memory', 'uptime', 'latencyMs', 'system', 'timestamp'];
      for (const key of forbiddenKeys) {
        assert.strictEqual(res.data[key], undefined, `Public /health MUST NOT expose '${key}'`);
      }

      // Assert exact keys in body
      const keys = Object.keys(res.data).sort();
      assert.deepStrictEqual(keys, ['database', 'status'], `Public /health body must contain ONLY ['database', 'status'], found: ${JSON.stringify(keys)}`);
    });

    // Test 2: GET /api/health alias also returns minimal status
    await test('GET /api/health alias returns identical minimal response', async () => {
      const res = await makeRequest(baseUrl, '/api/health');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data?.status, 'ok');
      assert.strictEqual(res.data?.database, 'connected');
      assert.deepStrictEqual(Object.keys(res.data).sort(), ['database', 'status']);
    });

    // Test 3: HEAD /health returns 200 for lightweight ALB/ELB probes
    await test('HEAD /health returns 200 for lightweight ALB/ELB probes', async () => {
      const res = await makeRequest(baseUrl, '/health', 'HEAD');
      assert.strictEqual(res.statusCode, 200);
    });

    // Test 4: Public cannot access internal diagnostics at /api/admin/system/metrics
    await test('Unauthenticated access to /api/admin/system/metrics is REJECTED with 403', async () => {
      const res = await makeRequest(baseUrl, '/api/admin/system/metrics');
      assert.strictEqual(res.statusCode, 403);
    });

    // Test 5: Authenticated admin CAN access internal metrics at /api/admin/system/metrics
    await test('Authenticated admin CAN access system metrics with memory and latency', async () => {
      const adminToken = jwt.sign(
        { id: 'usr_admin_test', email: 'raoa6526@gmail.com', role: 'admin', totpVerified: true },
        SESSION_SECRET,
        { expiresIn: '1h' }
      );
      const res = await makeRequest(baseUrl, '/api/admin/system/metrics', 'GET', {
        'Authorization': `Bearer ${adminToken}`
      });
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data?.success, true);
      assert.ok(typeof res.data?.uptimeSeconds === 'number', 'uptimeSeconds should be present');
      assert.ok(res.data?.system?.memory?.rssMb, 'rssMb should be present in admin metrics');
      assert.ok(res.data?.database?.latencyMs !== undefined, 'latencyMs should be present in admin metrics');
    });

    // Test 6: Rate limiter headers present on /health
    await test('/health includes RateLimit headers', async () => {
      const res = await makeRequest(baseUrl, '/health');
      assert.ok(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit'], 'RateLimit header must be present');
    });

  } finally {
    testServer.close();
  }

  console.log('\n=============================================================');
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('=============================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

if (require.main === module) {
  runHealthTests().catch(err => {
    console.error('Fatal Test Runner Error:', err.message);
    process.exit(1);
  });
}

module.exports = { runHealthTests };
