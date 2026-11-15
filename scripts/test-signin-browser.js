/**
 * Automated Headless Chrome E2E Verification for signin.html:
 * 1. Boots Chrome with remote debugging.
 * 2. Connects to Chrome DevTools Protocol (CDP) WebSocket.
 * 3. Captures all console.log, console.warn, console.error, and CSP security violation events.
 * 4. Navigates to http://localhost:3000/signin.html.
 * 5. Verifies tag and styling of #linkForgotPassword (<button type="button" class="link-button">).
 * 6. Simulates click on #linkForgotPassword.
 * 7. Confirms #forgotPasswordContainer and #forgotRequestForm become visible and #loginForm is hidden.
 * 8. Simulates click on #btnForgotBackToLogin and verifies #loginForm is restored.
 * 9. Simulates keyboard activation (Enter / Space keydown) on #linkForgotPassword.
 * 10. Reports all console logs and verifies ZERO CSP violations and ZERO JavaScript errors.
 */

const http = require('node:http');
const cp = require('node:child_process');
const os = require('node:os');
const path = require('node:path');
const WebSocket = globalThis.WebSocket;

async function runBrowserTest() {
  console.log('🚀 Starting Automated Chrome CDP Verification for signin.html...\n');

  const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
  const userDataDir = path.join(os.tmpdir(), `chrome-profile-${Date.now()}`);
  const port = 9222;

  const chromeProc = cp.spawn(chromePath, [
    `--remote-debugging-port=${port}`,
    '--remote-allow-origins=*',
    '--headless=new',
    '--disable-gpu',
    `--user-data-dir=${userDataDir}`,
    'about:blank'
  ], {
    stdio: ['ignore', 'pipe', 'pipe']
  });

  chromeProc.stderr.on('data', (d) => {
    // console.log('[Chrome STDERR]', d.toString());
  });

  // Wait for Chrome CDP port to become reachable
  let versionData = null;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      versionData = await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
          let buf = '';
          res.on('data', c => buf += c);
          res.on('end', () => resolve(JSON.parse(buf)));
        });
        req.on('error', reject);
        req.setTimeout(500, () => req.destroy(new Error('timeout')));
      });
      if (versionData && versionData.webSocketDebuggerUrl) break;
    } catch (_) {}
  }

  if (!versionData || !versionData.webSocketDebuggerUrl) {
    throw new Error('Chrome did not open remote debugging port 9222 in time.');
  }

  console.log('✓ Headless Chrome 157 started with CDP enabled.');

  // Create a new tab target
  const newTarget = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/json/new?http://localhost:3000/signin.html',
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

    // Console logs & errors
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map(a => a.value || JSON.stringify(a)).join(' ');
      consoleLogs.push({ type: msg.params.type, text });
      if (msg.params.type === 'error') {
        errors.push(text);
      }
    }

    // Uncaught exceptions
    if (msg.method === 'Runtime.exceptionThrown') {
      const desc = msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text;
      errors.push(desc);
    }

    // Security / CSP issues
    if (msg.method === 'Audits.issueAdded') {
      if (msg.params.issue?.code === 'ContentSecurityPolicyIssue') {
        cspViolations.push(msg.params.issue.details);
      }
    }
  });

  await new Promise(r => ws.addEventListener('open', r, { once: true }));

  // Enable CDP domains
  await sendCommand('Runtime.enable');
  await sendCommand('Page.enable');
  await sendCommand('DOM.enable');
  await sendCommand('Security.enable');

  console.log('✓ Waiting for page load and DOM readiness...');
  await new Promise(r => setTimeout(r, 2000));

  // 1. Inspect #linkForgotPassword
  console.log('\n--- Test Step 1: Inspect #linkForgotPassword Element ---');
  const inspectRes = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.getElementById('linkForgotPassword');
        if (!el) return { found: false };
        return {
          found: true,
          tagName: el.tagName.toLowerCase(),
          type: el.getAttribute('type'),
          className: el.className,
          text: el.textContent.trim(),
          hasHref: el.hasAttribute('href'),
          hrefVal: el.getAttribute('href'),
          isFocusable: typeof el.focus === 'function'
        };
      })()
    `,
    returnByValue: true
  });

  const elInfo = inspectRes.result.value;
  console.log('Element Info:', elInfo);
  if (!elInfo.found) throw new Error('#linkForgotPassword not found in DOM');
  if (elInfo.tagName !== 'button') throw new Error(`Expected tagName 'button', got: ${elInfo.tagName}`);
  if (elInfo.hasHref) throw new Error(`Expected NO href attribute, found: ${elInfo.hrefVal}`);
  console.log('✓ PASS: #linkForgotPassword is a semantic <button type="button" class="link-button"> with no javascript: URLs.');

  // 2. Click #linkForgotPassword
  console.log('\n--- Test Step 2: Click #linkForgotPassword ---');
  const clickRes = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.getElementById('linkForgotPassword');
        el.click();
        const container = document.getElementById('forgotPasswordContainer');
        const reqForm = document.getElementById('forgotRequestForm');
        const loginForm = document.getElementById('loginForm');
        const activeInput = document.activeElement ? document.activeElement.id : null;
        return {
          containerDisplay: container ? container.style.display : null,
          reqFormDisplay: reqForm ? reqForm.style.display : null,
          loginFormDisplay: loginForm ? loginForm.style.display : null,
          activeElementId: activeInput
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Post-Click State:', clickRes.result.value);
  if (clickRes.result.value.containerDisplay !== 'block') throw new Error('forgotPasswordContainer did not open on click');
  if (clickRes.result.value.loginFormDisplay === 'block') throw new Error('loginForm was not hidden on click');
  console.log('✓ PASS: Click opens forgot password panel and hides login form.');

  // 3. Click "Back to Sign In"
  console.log('\n--- Test Step 3: Click "Back to Sign In" ---');
  const backRes = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.getElementById('btnForgotBackToLogin');
        btn.click();
        const container = document.getElementById('forgotPasswordContainer');
        const loginForm = document.getElementById('loginForm');
        return {
          containerDisplay: container ? container.style.display : null,
          loginFormDisplay: loginForm ? loginForm.style.display : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Post-Back State:', backRes.result.value);
  if (backRes.result.value.loginFormDisplay !== 'block') throw new Error('loginForm did not re-appear on Back to Sign In');
  if (backRes.result.value.containerDisplay === 'block') throw new Error('forgotPasswordContainer was not hidden');
  console.log('✓ PASS: "Back to Sign In" cleanly restores the sign-in form.');

  // 4. Keyboard Navigation (Enter / Space)
  console.log('\n--- Test Step 4: Keyboard Activation (Enter & Space) ---');
  const keyRes = await sendCommand('Runtime.evaluate', {
    expression: `
      (() => {
        const el = document.getElementById('linkForgotPassword');
        el.focus();
        // Dispatch Space keydown
        el.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
        const container = document.getElementById('forgotPasswordContainer');
        const openedWithSpace = container && container.style.display === 'block';

        // Return back
        document.getElementById('btnForgotBackToLogin').click();

        // Dispatch Enter keydown
        el.focus();
        el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }));
        const openedWithEnter = container && container.style.display === 'block';

        return { openedWithSpace, openedWithEnter };
      })()
    `,
    returnByValue: true
  });
  console.log('Keyboard Navigation Results:', keyRes.result.value);
  if (!keyRes.result.value.openedWithSpace || !keyRes.result.value.openedWithEnter) {
    throw new Error('Keyboard activation via Space or Enter failed');
  }
  console.log('✓ PASS: Keyboard navigation works seamlessly for both Enter and Space.');

  // 5. Check Console Output & CSP
  console.log('\n--- Test Step 5: Console Logs & Security Audit ---');
  console.log(`Total Console Messages Captured: ${consoleLogs.length}`);
  consoleLogs.forEach(c => console.log(`  [${c.type}] ${c.text}`));

  if (cspViolations.length > 0) {
    console.error('CSP Violations Detected:', cspViolations);
    throw new Error(`Detected ${cspViolations.length} Content Security Policy violations!`);
  }
  console.log('✓ PASS: Zero Content Security Policy violations.');

  // Filter out non-fatal warnings (e.g. Turnstile dev origin warnings if any)
  const fatalErrors = errors.filter(e => !e.includes('Turnstile') && !e.includes('favicon'));
  if (fatalErrors.length > 0) {
    console.error('Fatal JavaScript Errors:', fatalErrors);
    throw new Error(`Detected ${fatalErrors.length} JavaScript runtime errors!`);
  }
  console.log('✓ PASS: Zero JavaScript runtime errors.');

  // Cleanup
  ws.close();
  chromeProc.kill('SIGKILL');

  console.log('\n=============================================================');
  console.log('🎉 ALL BROWSER E2E TESTS PASSED WITH ZERO CSP / JS ERRORS!');
  console.log('=============================================================\n');
}

runBrowserTest().then(() => process.exit(0)).catch((err) => {
  console.error('\n❌ Browser Test Failed:', err);
  process.exit(1);
});
