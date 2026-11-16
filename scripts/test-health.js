require('dotenv').config();
const http = require('http');
const assert = require('assert');
const app = require('../server');

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
  console.log('🌿 UMANARAYANI HEALTH & MONITORING VERIFICATION SUITE');
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
    // Test 1: GET /health returns 200 and healthy status
    await test('GET /health returns 200 with status: ok', async () => {
      const res = await makeRequest(baseUrl, '/health');
      assert.strictEqual(res.statusCode, 200, `Expected 200, got ${res.statusCode}`);
      assert.strictEqual(res.data?.status, 'ok', `Expected status ok, got ${res.data?.status}`);
      assert.strictEqual(res.data?.database?.status, 'connected', 'Database should report connected');
      assert.ok(typeof res.data?.database?.latencyMs === 'number', 'Latency should be a number');
      assert.ok(typeof res.data?.uptime === 'number', 'Uptime should be a number');
    });

    // Test 2: GET /api/health also returns 200 (alias)
    await test('GET /api/health alias returns 200 with database health', async () => {
      const res = await makeRequest(baseUrl, '/api/health');
      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.data?.status, 'ok');
    });

    // Test 3: X-Request-Id header is generated and returned
    await test('X-Request-Id header is generated and returned by server', async () => {
      const res = await makeRequest(baseUrl, '/health');
      const reqId = res.headers['x-request-id'];
      assert.ok(reqId, 'Response header X-Request-Id must exist');
      assert.strictEqual(res.data?.requestId, reqId, 'Body requestId must match X-Request-Id header');
    });

    // Test 4: Upstream X-Request-Id header is preserved
    await test('Custom incoming X-Request-Id is propagated through response', async () => {
      const customId = `test-req-${Date.now()}`;
      const res = await makeRequest(baseUrl, '/health', 'GET', { 'x-request-id': customId });
      assert.strictEqual(res.headers['x-request-id'], customId, 'Should reflect incoming X-Request-Id');
      assert.strictEqual(res.data?.requestId, customId, 'Body should contain incoming X-Request-Id');
    });

    // Test 5: HEAD /health works for fast uptime probes
    await test('HEAD /health returns 200 for lightweight ALB/ELB probes', async () => {
      const res = await makeRequest(baseUrl, '/health', 'HEAD');
      assert.strictEqual(res.statusCode, 200);
      assert.ok(res.headers['x-request-id'], 'HEAD response should include X-Request-Id');
    });

    // Test 6: Memory metrics are reported in response
    await test('System memory metrics (rssMb, heapUsedMb) are reported', async () => {
      const res = await makeRequest(baseUrl, '/health');
      assert.ok(res.data?.system?.memory?.rssMb, 'rssMb should be present');
      assert.ok(res.data?.system?.memory?.heapUsedMb, 'heapUsedMb should be present');
      assert.ok(res.data?.system?.nodeVersion, 'nodeVersion should be present');
    });

    // Test 7: Sentry initialization status check
    await test('Monitoring service exports isSentryActive and captureException', () => {
      const monitoring = require('../services/monitoringService');
      assert.strictEqual(typeof monitoring.isSentryActive, 'function');
      assert.strictEqual(typeof monitoring.captureException, 'function');
      // When SENTRY_DSN is not set, isSentryActive should be false
      assert.strictEqual(monitoring.isSentryActive(), false);
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
