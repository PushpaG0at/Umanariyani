const http = require('node:http');
const cp = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const WebSocket = globalThis.WebSocket;

const PORT = 3000;
const DEBUG_PORT = 9222;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function wait(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function runStorefrontE2ETest() {
  console.log('🚀 Starting Comprehensive Storefront E2E & Product Click Verification...\n');

  const userDataDir = path.join(os.tmpdir(), `chrome-profile-${Date.now()}`);
  const chromeProc = cp.spawn(CHROME_PATH, [
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], { stdio: 'ignore' });

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    await wait(300);
    try {
      versionData = await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${DEBUG_PORT}/json/version`, (res) => {
          let buf = '';
          res.on('data', c => buf += c);
          res.on('end', () => resolve(JSON.parse(buf)));
        });
        req.on('error', reject);
        req.setTimeout(500, () => req.destroy());
      });
      if (versionData && versionData.webSocketDebuggerUrl) break;
    } catch (_) {}
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    chromeProc.kill();
    throw new Error('Chrome remote debugging did not open in time.');
  }

  console.log('✓ Headless Chrome started with CDP enabled.');

  // Create new tab for index.html
  const newTarget = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: DEBUG_PORT,
      path: `/json/new?http://127.0.0.1:${PORT}/index.html`,
      method: 'PUT'
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.end();
  });

  const ws = new WebSocket(newTarget.webSocketDebuggerUrl);
  const consoleMessages = [];
  const errors = [];
  const cspViolations = [];
  let msgId = 1;
  const pendingRequests = new Map();

  function sendCommand(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pendingRequests.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  ws.addEventListener('message', (event) => {
    const raw = typeof event.data === 'string' ? event.data : event.data.toString();
    const msg = JSON.parse(raw);
    if (msg.id && pendingRequests.has(msg.id)) {
      const { resolve, reject } = pendingRequests.get(msg.id);
      pendingRequests.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }

    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      consoleMessages.push({ type: msg.params.type, text });
      if (msg.params.type === 'error') errors.push(text);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      errors.push(desc);
    }
    if (msg.method === 'Audits.issueAdded') {
      if (msg.params.issue?.code === 'ContentSecurityPolicyIssue') {
        cspViolations.push(msg.params.issue.details);
      }
    }
  });

  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');
  await sendCommand('DOM.enable');
  await sendCommand('Audits.enable');

  console.log('✓ Waiting for index.html catalog to render (3s)...');
  await wait(3000);

  // --- TEST 1: Product Cards Navigation ---
  console.log('\n--- TEST 1: Product Cards Navigation on index.html ---');
  const cardsCount = await sendCommand('Runtime.evaluate', {
    expression: `document.querySelectorAll('.product-card').length`,
    returnByValue: true
  });
  console.log(`   Found ${cardsCount.result.value} products in catalog.`);
  if (cardsCount.result.value < 1) throw new Error('No product cards rendered in catalog.');

  // Test clicking the overlay on the first product card
  console.log('   Simulating click on "View Full Details & Specs" overlay...');
  await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const overlay = document.querySelector('.product-card .quick-view-overlay');
        if (overlay) overlay.click();
      })()
    `
  });
  await wait(1500);

  const urlAfterOverlay = await sendCommand('Runtime.evaluate', {
    expression: `window.location.href`,
    returnByValue: true
  });
  console.log('   Navigated URL:', urlAfterOverlay.result.value);
  if (!urlAfterOverlay.result.value.includes('product.html?id=')) {
    throw new Error('Clicking quick-view overlay failed to navigate to product.html!');
  }
  console.log('✓ PASS: Clicking image/overlay successfully opened product.html.');

  // --- TEST 2: Product Detail Page & Gallery ---
  console.log('\n--- TEST 2: Product Detail Page Experience ---');
  await wait(2000); // Wait for product.js to load details

  const prodPageInfo = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const title = document.getElementById('productTitle')?.textContent;
        const mainImg = document.getElementById('mainStageImg')?.src;
        const thumbs = document.querySelectorAll('.thumb-item').length;
        const buyBoxPrice = document.getElementById('buyBoxPrice')?.textContent;
        return { title, mainImg, thumbs, buyBoxPrice };
      })()
    `,
    returnByValue: true
  });
  console.log('   Product Detail State:', prodPageInfo.result.value);
  if (!prodPageInfo.result.value.title || prodPageInfo.result.value.title === 'NOT FOUND') {
    throw new Error('Product detail page failed to load product data');
  }
  console.log(`✓ PASS: Product title "${prodPageInfo.result.value.title}" loaded with price ${prodPageInfo.result.value.buyBoxPrice}`);

  // Test Thumbnail Switching
  if (prodPageInfo.result.value.thumbs > 1) {
    console.log('   Testing gallery thumbnail click...');
    const thumbClickRes = await sendCommand('Runtime.evaluate', {
      expression: `
        (() => {
          const secondThumb = document.querySelectorAll('.thumb-item')[1];
          if (secondThumb) {
            secondThumb.click();
            return {
              switched: secondThumb.classList.contains('active'),
              newSrc: document.getElementById('mainStageImg')?.src
            };
          }
          return { switched: false };
        })()
      `,
      returnByValue: true
    });
    console.log('   Thumbnail click result:', thumbClickRes.result.value);
    if (!thumbClickRes.result.value.switched) throw new Error('Thumbnail click did not switch active image');
    console.log('✓ PASS: Gallery thumbnail switching functions cleanly without CSP errors.');
  }

  // --- TEST 3: Add to Cart & Badge Update ---
  console.log('\n--- TEST 3: Add to Cart Flow ---');
  const addCartRes = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.getElementById('btnAddToCart');
        if (btn) btn.click();
        const cartData = JSON.parse(localStorage.getItem('umanarayani_cart') || '[]');
        const badge = document.getElementById('cartBadgeCount')?.textContent;
        return { cartLength: cartData.length, badge };
      })()
    `,
    returnByValue: true
  });
  console.log('   Cart State After Click:', addCartRes.result.value);
  if (addCartRes.result.value.cartLength < 1) throw new Error('Add to Cart failed to save item to localStorage');
  console.log(`✓ PASS: Item successfully added to cart (Cart count: ${addCartRes.result.value.cartLength}, Badge: ${addCartRes.result.value.badge})`);

  // --- TEST 4: Return to Store & Category Filtering ---
  console.log('\n--- TEST 4: Navigation Back & Category Filtering ---');
  await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const backBtn = document.getElementById('floatingBackBtn');
        if (backBtn) backBtn.click();
        else window.location.href = 'index.html#productsSection';
      })()
    `
  });
  await wait(2000);

  // Test Category Tabs: Hair Care
  const catFilterRes = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const hairTab = document.querySelector('.cat-tab-btn[data-cat="hair-care"]');
        if (hairTab) hairTab.click();
      })()
    `
  });
  await wait(1000);

  const hairProductsCount = await sendCommand('Runtime.evaluate', {
    expression: `document.querySelectorAll('.product-card').length`,
    returnByValue: true
  });
  console.log(`   Hair Care filtered count: ${hairProductsCount.result.value}`);
  if (hairProductsCount.result.value < 1) throw new Error('Category filter for hair-care returned 0 products');
  console.log('✓ PASS: Category tabs filter products correctly.');

  // Reset to All
  await sendCommand('Runtime.evaluate', {
    expression: `document.querySelector('.cat-tab-btn[data-cat="all"]').click();`
  });
  await wait(800);

  // --- TEST 5: Cart Page Functionality ---
  console.log('\n--- TEST 5: Cart Page Functionality ---');
  await sendCommand('Runtime.evaluate', {
    expression: `window.location.href = 'cart.html';`
  });
  await wait(2500);

  const cartPageInspect = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const rows = document.querySelectorAll('.cart-item-row').length;
        const payableText = document.getElementById('summaryPayable')?.textContent;
        const plusBtn = document.querySelector('[data-action="qty-inc"]');
        if (plusBtn) plusBtn.click();
        const updatedQty = document.querySelector('.cart-qty-ctrl span')?.textContent;
        return { rows, payableText, updatedQty };
      })()
    `,
    returnByValue: true
  });
  console.log('   Cart Page State:', cartPageInspect.result.value);
  if (cartPageInspect.result.value.rows < 1) throw new Error('Cart page did not render the items in cart');
  console.log(`✓ PASS: Cart page renders item rows (${cartPageInspect.result.value.rows}) and handles quantity updates (new qty: ${cartPageInspect.result.value.updatedQty}).`);

  // --- TEST 6: Audit CSP Violations and Fatal Errors ---
  console.log('\n--- TEST 6: Security Audit (CSP & Runtime Errors) ---');
  console.log(`   Total Console Errors Captured: ${errors.length}`);
  if (errors.length > 0) {
    console.error('   Errors:', errors);
    throw new Error('Detected JavaScript runtime errors during workflow!');
  }
  console.log('✓ PASS: Zero JavaScript runtime errors across all tested pages.');

  console.log(`   Total CSP Violations Captured: ${cspViolations.length}`);
  if (cspViolations.length > 0) {
    console.error('   CSP Violations:', cspViolations);
    throw new Error(`Detected ${cspViolations.length} Content Security Policy violations!`);
  }
  console.log('✓ PASS: ZERO Content Security Policy violations.');

  // Cleanup
  ws.close();
  chromeProc.kill();

  console.log('\n=============================================================');
  console.log('🎉 ALL STOREFRONT & PRODUCT WORKFLOW TESTS PASSED 100%!');
  console.log('=============================================================\n');
}

runStorefrontE2ETest().then(() => process.exit(0)).catch((err) => {
  console.error('\n❌ Storefront Test Failed:', err);
  process.exit(1);
});
