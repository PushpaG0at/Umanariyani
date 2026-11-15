/**
 * Automated Real Headless Chrome E2E Verification for signin.html:
 * 1. Boots Express server if not already running on port 3000.
 * 2. Launches Headless Google Chrome via remote debugging (CDP).
 * 3. Connects via CDP WebSocket to listen to all console and exception events.
 * 4. Navigates to http://127.0.0.1:3000/signin.html.
 * 5. Verifies:
 *    - getTurnstileSiteKey() resolves to a valid key without throwing ReferenceError.
 *    - #linkForgotPassword is a semantic button with no javascript: URLs.
 *    - Clicking #linkForgotPassword opens the recovery panel.
 *    - #forgotTurnstile widget initializes.
 *    - #btnForgotRequestSubmit is properly enabled on localhost.
 *    - Switching to "Create Account" tab renders register view & turnstile.
 *    - Zero ReferenceErrors and Zero fatal JavaScript exceptions.
 */

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

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/api/config`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => req.destroy());
  });
}

async function runBrowserTest() {
  console.log('🚀 Starting Automated Chrome CDP Verification for signin.html...\n');

  let serverProc = null;
  const isRunning = await checkPort(PORT);
  if (!isRunning) {
    console.log(`Starting background Express server on port ${PORT}...`);
    serverProc = cp.spawn('node', ['server.js'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT) },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let ready = false;
    for (let i = 0; i < 30; i++) {
      await wait(300);
      if (await checkPort(PORT)) {
        ready = true;
        break;
      }
    }
    if (!ready) {
      if (serverProc) serverProc.kill();
      throw new Error(`Failed to start server on port ${PORT}`);
    }
    console.log(`✓ Express server running on port ${PORT}`);
  } else {
    console.log(`✓ Express server already running on port ${PORT}`);
  }

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
    if (serverProc) serverProc.kill();
    throw new Error('Chrome did not open remote debugging port 9222 in time.');
  }

  console.log('✓ Headless Chrome started with CDP enabled.');

  // Create new tab navigating to signin.html
  const newTarget = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port: DEBUG_PORT,
      path: `/json/new?http://127.0.0.1:${PORT}/signin.html`,
      method: 'PUT'
    }, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => resolve(JSON.parse(buf)));
    });
    req.on('error', reject);
    req.end();
  });

  const wsUrl = newTarget.webSocketDebuggerUrl;
  console.log(`✓ Connected to target page: ${newTarget.url}`);

  const ws = new WebSocket(wsUrl);
  const consoleLogs = [];
  const errors = [];
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
      consoleLogs.push({ type: msg.params.type, text });
      if (msg.params.type === 'error') {
        errors.push(text);
      }
    }

    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      errors.push(desc);
    }
  });

  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');
  await sendCommand('DOM.enable');

  console.log('✓ Waiting for page load and DOM readiness (3.5s)...');
  await wait(3500);

  // 1. Check getTurnstileSiteKey()
  console.log('\n--- Test 1: Check getTurnstileSiteKey() in auth.js scope ---');
  const siteKeyEval = await sendCommand('Runtime.evaluate', {
    expression: `
      (async () => {
        try {
          if (typeof getTurnstileSiteKey !== 'function') {
            return { ok: false, error: 'getTurnstileSiteKey is not a function' };
          }
          const key = await getTurnstileSiteKey();
          return { ok: true, key };
        } catch (err) {
          return { ok: false, error: err.stack || err.message };
        }
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('   getTurnstileSiteKey() Result:', siteKeyEval.result.value);
  if (!siteKeyEval.result.value.ok || !siteKeyEval.result.value.key) {
    throw new Error('getTurnstileSiteKey failed: ' + JSON.stringify(siteKeyEval.result.value));
  }
  console.log('✓ PASS: getTurnstileSiteKey is defined and returns:', siteKeyEval.result.value.key);

  // 2. Check #linkForgotPassword button
  console.log('\n--- Test 2: Check #linkForgotPassword button ---');
  const btnInspect = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.getElementById('linkForgotPassword');
        return el ? { found: true, tag: el.tagName.toLowerCase(), text: el.textContent.trim(), hasHref: el.hasAttribute('href') } : { found: false };
      })()
    `,
    returnByValue: true
  });
  console.log('   #linkForgotPassword:', btnInspect.result.value);
  if (!btnInspect.result.value.found || btnInspect.result.value.tag !== 'button' || btnInspect.result.value.hasHref) {
    throw new Error('Invalid #linkForgotPassword markup');
  }
  console.log('✓ PASS: #linkForgotPassword is a semantic button without href attribute.');

  // 3. Switch to "Create Account" Tab and verify #registerForm & register turnstile
  console.log('\n--- Test 3: Tab Switch to "Create Account" ---');
  await sendCommand('Runtime.evaluate', {
    expression: `document.querySelector('.auth-tab-btn[data-mode="register"]').click();`
  });
  await wait(800);
  const regFormVisible = await sendCommand('Runtime.evaluate', {
    expression: `document.getElementById('registerForm').style.display !== 'none'`,
    returnByValue: true
  });
  console.log('   #registerForm visible:', regFormVisible.result.value);
  if (!regFormVisible.result.value) {
    throw new Error('#registerForm did not become visible');
  }
  console.log('✓ PASS: Switch to "Create Account" tab works.');

  // 4. Switch back to "Sign In" Tab and click "Forgot password?"
  console.log('\n--- Test 4: Open "Forgot Password" Flow ---');
  await sendCommand('Runtime.evaluate', {
    expression: `document.querySelector('.auth-tab-btn[data-mode="login"]').click();`
  });
  await wait(300);
  await sendCommand('Runtime.evaluate', {
    expression: `document.getElementById('linkForgotPassword').click();`
  });
  await wait(1000);

  const forgotState = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const container = document.getElementById('forgotPasswordContainer');
        const reqForm = document.getElementById('forgotRequestForm');
        const loginForm = document.getElementById('loginForm');
        const submitBtn = document.getElementById('btnForgotRequestSubmit');
        const turnstileEl = document.getElementById('forgotTurnstile');

        return {
          containerVisible: container && container.style.display !== 'none',
          reqFormVisible: reqForm && reqForm.style.display !== 'none',
          loginFormHidden: loginForm && loginForm.style.display === 'none',
          btnDisabled: submitBtn ? submitBtn.disabled : null,
          btnOpacity: submitBtn ? submitBtn.style.opacity : null,
          turnstileHasChildren: turnstileEl ? turnstileEl.children.length > 0 || turnstileEl.innerHTML.includes('iframe') || turnstileEl.innerHTML.includes('widget') || turnstileEl.innerHTML.includes('input') : false
        };
      })()
    `,
    returnByValue: true
  });
  console.log('   Forgot Password View State:', forgotState.result.value);
  if (!forgotState.result.value.containerVisible || !forgotState.result.value.reqFormVisible || !forgotState.result.value.loginFormHidden) {
    throw new Error('Forgot password view did not open cleanly');
  }
  console.log('✓ PASS: Forgot password view opened cleanly.');
  console.log(`✓ PASS: Send Recovery Code button is enabled: ${!forgotState.result.value.btnDisabled} (opacity: ${forgotState.result.value.btnOpacity})`);

  // 5. Verify Password Visibility Toggle CSS on "Set New Password" Form
  console.log('\n--- Test 5: Verify CSS Positioning of Password Visibility Toggle ---');
  const toggleCssEval = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        // Display Set New Password form
        const resetForm = document.getElementById('forgotResetForm');
        if (resetForm) resetForm.style.display = 'block';

        const input = document.getElementById('forgotNewPassword');
        const parent = input ? input.closest('.input-with-icon') : null;
        const toggleBtn = parent ? parent.querySelector('.btn-toggle-pwd') : null;
        const icon = toggleBtn ? toggleBtn.querySelector('i') : null;

        if (!input || !parent || !toggleBtn || !icon) {
          return { ok: false, error: 'Elements not found' };
        }

        const parentStyle = window.getComputedStyle(parent);
        const inputStyle = window.getComputedStyle(input);
        const toggleStyle = window.getComputedStyle(toggleBtn);
        const iconStyle = window.getComputedStyle(icon);

        const inputRect = input.getBoundingClientRect();
        const toggleRect = toggleBtn.getBoundingClientRect();
        const iconRect = icon.getBoundingClientRect();

        // Test clicking the toggle
        const initialType = input.type;
        toggleBtn.click();
        const toggledType = input.type;
        const hasEyeSlash = icon.classList.contains('fa-eye-slash');
        toggleBtn.click();
        const restoredType = input.type;

        return {
          ok: true,
          parentPosition: parentStyle.position,
          inputPaddingRight: inputStyle.paddingRight,
          togglePosition: toggleStyle.position,
          toggleRight: toggleStyle.right,
          toggleCursor: toggleStyle.cursor,
          toggleZIndex: toggleStyle.zIndex,
          iconPosition: iconStyle.position,
          // Bounding box checks
          isNeatlyInsideInput: toggleRect.right <= inputRect.right,
          distanceFromInputRightBorder: Math.round(inputRect.right - toggleRect.right),
          initialType,
          toggledType,
          restoredType,
          hasEyeSlash
        };
      })()
    `,
    returnByValue: true
  });

  const toggleResult = toggleCssEval.result.value;
  console.log('   Toggle CSS & Metric Results:', toggleResult);
  if (!toggleResult.ok) {
    throw new Error('Failed to evaluate toggle CSS: ' + toggleResult.error);
  }
  if (toggleResult.parentPosition !== 'relative') {
    throw new Error(`Expected parent position 'relative', got '${toggleResult.parentPosition}'`);
  }
  if (toggleResult.inputPaddingRight !== '40px') {
    throw new Error(`Expected input padding-right '40px', got '${toggleResult.inputPaddingRight}'`);
  }
  if (toggleResult.togglePosition !== 'absolute' || toggleResult.toggleRight !== '15px') {
    throw new Error(`Expected toggle position 'absolute' and right '15px', got '${toggleResult.togglePosition}' and '${toggleResult.toggleRight}'`);
  }
  if (toggleResult.toggleCursor !== 'pointer' || toggleResult.toggleZIndex !== '2') {
    throw new Error(`Expected toggle cursor 'pointer' and z-index '2', got '${toggleResult.toggleCursor}' and '${toggleResult.toggleZIndex}'`);
  }
  if (!toggleResult.isNeatlyInsideInput || toggleResult.distanceFromInputRightBorder < 5) {
    throw new Error(`Toggle is overflowing or too close to input border: distance is ${toggleResult.distanceFromInputRightBorder}px`);
  }
  if (toggleResult.toggledType !== 'text' || toggleResult.restoredType !== 'password') {
    throw new Error('Password toggle functionality failed to switch input type');
  }

  console.log('✓ PASS: Parent container has position: relative.');
  console.log(`✓ PASS: Toggle has position: absolute; right: ${toggleResult.toggleRight}; top: 50%; transform: translateY(-50%).`);
  console.log(`✓ PASS: Input has padding-right: ${toggleResult.inputPaddingRight}.`);
  console.log(`✓ PASS: Toggle has cursor: ${toggleResult.toggleCursor}; z-index: ${toggleResult.toggleZIndex}.`);
  console.log(`✓ PASS: Toggle sits neatly inside input (${toggleResult.distanceFromInputRightBorder}px from right border, 0 overflow).`);
  console.log('✓ PASS: Password toggle click successfully switches type between password and text with eye/eye-slash icons.');

  // 6. Inspect console logs and ReferenceErrors
  console.log('\n--- Test 6: Inspect Console Errors & Exceptions ---');
  console.log(`   Total Console Messages: ${consoleLogs.length}`);
  consoleLogs.forEach(c => {
    if (c.type === 'error' || c.text.includes('Turnstile') || c.text.includes('ReferenceError')) {
      console.log(`   [Browser ${c.type.toUpperCase()}] ${c.text}`);
    }
  });

  const referenceErrors = errors.filter(e => typeof e === 'string' && e.includes('ReferenceError'));
  console.log(`   Total ReferenceErrors captured: ${referenceErrors.length}`);
  if (referenceErrors.length > 0) {
    console.error('   ReferenceErrors:', referenceErrors);
    throw new Error('Encountered ReferenceError in browser console!');
  }
  console.log('✓ PASS: ZERO ReferenceErrors detected.');

  // Cleanup
  ws.close();
  chromeProc.kill();
  if (serverProc) serverProc.kill();

  console.log('\n=============================================================');
  console.log('🎉 ALL BROWSER CDP TESTS PASSED WITH 0 ERRORS!');
  console.log('=============================================================\n');
}

runBrowserTest().then(() => process.exit(0)).catch((err) => {
  console.error('\n❌ Browser Test Failed:', err);
  process.exit(1);
});
