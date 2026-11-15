/**
 * UMANARAYNI AYURVEDA — CREATIVE HERBAL AUTHENTICATION SCRIPT
 * Two-Step OTP Verification Flow (Email & SMS OTP via Nodemailer & Twilio),
 * Floating botanical leaves animation, interactive Dosha selection,
 * and post-login real-time active users showcase.
 */

let currentTurnstileTokens = {
  login: '',
  register: '',
  otp: '',
  forgot: ''
};
let turnstileWidgetIds = {};
let pendingAuthIdentifier = '';
let resendTimer = null;
let resendSecondsRemaining = 60;
let lastDevOtp = '';

function getActiveTurnstileToken(mode = 'login') {
  let token = '';
  if (window.turnstile && turnstileWidgetIds[mode] !== undefined) {
    try {
      token = window.turnstile.getResponse(turnstileWidgetIds[mode]);
    } catch (_) {}
  }
  if (!token && window.turnstile) {
    try {
      token = window.turnstile.getResponse(`#${mode}Turnstile`) || window.turnstile.getResponse();
    } catch (_) {}
  }
  if (!token && currentTurnstileTokens[mode]) {
    token = currentTurnstileTokens[mode];
  }
  if (!token) {
    const el = document.getElementById(`${mode}Turnstile`);
    const hidden = el ? el.querySelector('[name="cf-turnstile-response"]') : document.querySelector('[name="cf-turnstile-response"]');
    if (hidden && hidden.value) token = hidden.value;
  }
  return token || '';
}

function resetTurnstileWidget(mode = 'login') {
  if (window.turnstile) {
    try {
      if (turnstileWidgetIds[mode] !== undefined) {
        window.turnstile.reset(turnstileWidgetIds[mode]);
      } else {
        window.turnstile.reset(`#${mode}Turnstile`);
      }
    } catch (_) {
      try { window.turnstile.reset(); } catch (_) {}
    }
  }
  currentTurnstileTokens[mode] = '';
  if (mode === 'forgot') {
    const btn = document.getElementById('btnForgotRequestSubmit');
    if (btn) {
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      btn.disabled = !isLocal;
      btn.style.opacity = isLocal ? '1' : '0.6';
      btn.style.cursor = isLocal ? 'pointer' : 'not-allowed';
    }
  }
}

let siteKeyPromise = null;

/**
 * Robust, async, CSP-compliant Turnstile site key resolver.
 * Priority:
 * 1. data-sitekey attribute on DOM (<body data-sitekey="...">)
 * 2. window.TURNSTILE_SITE_KEY global (if defined)
 * 3. GET /api/config endpoint
 * 4. Safe fallback key
 * Caches the promise to ensure network is only hit once.
 */
async function getTurnstileSiteKey() {
  if (siteKeyPromise) {
    return siteKeyPromise;
  }

  siteKeyPromise = (async () => {
    // 1. Check data-sitekey attribute on DOM
    const datasetElement = document.querySelector('[data-sitekey]');
    if (datasetElement) {
      const attrKey = datasetElement.getAttribute('data-sitekey');
      if (attrKey && attrKey.trim()) {
        return attrKey.trim();
      }
    }

    // 2. Check window global
    if (window.TURNSTILE_SITE_KEY && typeof window.TURNSTILE_SITE_KEY === 'string') {
      const globalKey = window.TURNSTILE_SITE_KEY.trim();
      if (globalKey) return globalKey;
    }

    // 3. Fetch from /api/config
    try {
      const res = await fetch('/api/config');
      if (res.ok) {
        const cfg = await res.json();
        if (cfg && cfg.turnstileSiteKey && typeof cfg.turnstileSiteKey === 'string') {
          return cfg.turnstileSiteKey.trim();
        }
      }
    } catch (err) {
      console.warn('[Turnstile] Could not retrieve site key from /api/config:', err.message);
    }

    // 4. Default fallback key
    return '0x4AAAAAAF5yxm-iBychLJBe';
  })();

  return siteKeyPromise;
}

/**
 * Checks whether an element is currently visible in the DOM (not hidden via display:none).
 * Cloudflare Turnstile requires visible non-zero dimensions to render properly.
 */
function isContainerVisible(el) {
  if (!el) return false;
  return !!(el.offsetWidth || el.offsetHeight || (el.getClientRects && el.getClientRects().length > 0));
}

/**
 * Helper to execute a callback when Cloudflare Turnstile API script has finished loading.
 */
function whenTurnstileReady(callback) {
  if (typeof window !== 'undefined' && window.turnstile) {
    if (typeof window.turnstile.ready === 'function') {
      try {
        window.turnstile.ready(callback);
        return;
      } catch (_) {}
    }
    callback();
    return;
  }

  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (window.turnstile) {
      clearInterval(interval);
      if (typeof window.turnstile.ready === 'function') {
        try {
          window.turnstile.ready(callback);
          return;
        } catch (_) {}
      }
      callback();
    } else if (attempts >= 50) {
      clearInterval(interval);
      console.warn('[Turnstile] Script load timed out after 5 seconds');
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      if (isLocal) {
        const btn = document.getElementById('btnForgotRequestSubmit');
        if (btn) {
          btn.disabled = false;
          btn.style.opacity = '1';
          btn.style.cursor = 'pointer';
        }
      }
    }
  }, 100);
}

async function renderLoginTurnstile() {
  const container = document.getElementById('loginTurnstile');
  if (!container || !isContainerVisible(container)) return;
  if (!window.turnstile || !window.turnstile.render) {
    whenTurnstileReady(() => renderLoginTurnstile());
    return;
  }
  if (turnstileWidgetIds['login'] !== undefined) return;

  try {
    const siteKey = await getTurnstileSiteKey();
    if (!siteKey || !container || !isContainerVisible(container)) return;
    if (turnstileWidgetIds['login'] !== undefined) return;

    turnstileWidgetIds['login'] = window.turnstile.render('#loginTurnstile', {
      sitekey: siteKey,
      theme: 'light',
      callback: (token) => {
        currentTurnstileTokens['login'] = token;
        clearAuthMessages();
      },
      'expired-callback': () => {
        currentTurnstileTokens['login'] = '';
        if (window.turnstile && turnstileWidgetIds['login'] !== undefined) {
          try { window.turnstile.reset(turnstileWidgetIds['login']); } catch (_) {}
        }
      },
      'error-callback': (code) => {
        console.warn('[Turnstile Login Widget Error]', code);
      }
    });
  } catch (err) {
    console.warn('[Turnstile Login Render Error]', err.message);
  }
}

async function renderRegisterTurnstile() {
  const container = document.getElementById('registerTurnstile');
  if (!container || !isContainerVisible(container)) return;
  if (!window.turnstile || !window.turnstile.render) {
    whenTurnstileReady(() => renderRegisterTurnstile());
    return;
  }
  if (turnstileWidgetIds['register'] !== undefined) return;

  try {
    const siteKey = await getTurnstileSiteKey();
    if (!siteKey || !container || !isContainerVisible(container)) return;
    if (turnstileWidgetIds['register'] !== undefined) return;

    turnstileWidgetIds['register'] = window.turnstile.render('#registerTurnstile', {
      sitekey: siteKey,
      theme: 'light',
      callback: (token) => {
        currentTurnstileTokens['register'] = token;
        clearAuthMessages();
      },
      'expired-callback': () => {
        currentTurnstileTokens['register'] = '';
        if (window.turnstile && turnstileWidgetIds['register'] !== undefined) {
          try { window.turnstile.reset(turnstileWidgetIds['register']); } catch (_) {}
        }
      },
      'error-callback': (code) => {
        console.warn('[Turnstile Register Widget Error]', code);
      }
    });
  } catch (err) {
    console.warn('[Turnstile Register Render Error]', err.message);
  }
}

async function renderOtpTurnstile() {
  const container = document.getElementById('otpTurnstile');
  if (!container || !isContainerVisible(container)) return;
  if (!window.turnstile || !window.turnstile.render) {
    whenTurnstileReady(() => renderOtpTurnstile());
    return;
  }
  if (turnstileWidgetIds['otp'] !== undefined) return;

  try {
    const siteKey = await getTurnstileSiteKey();
    if (!siteKey || !container || !isContainerVisible(container)) return;
    if (turnstileWidgetIds['otp'] !== undefined) return;

    turnstileWidgetIds['otp'] = window.turnstile.render('#otpTurnstile', {
      sitekey: siteKey,
      theme: 'light',
      callback: (token) => {
        currentTurnstileTokens['otp'] = token;
        clearAuthMessages();
      },
      'expired-callback': () => {
        currentTurnstileTokens['otp'] = '';
        if (window.turnstile && turnstileWidgetIds['otp'] !== undefined) {
          try { window.turnstile.reset(turnstileWidgetIds['otp']); } catch (_) {}
        }
      },
      'error-callback': (code) => {
        console.warn('[Turnstile OTP Widget Error]', code);
      }
    });
  } catch (err) {
    console.warn('[Turnstile OTP Render Error]', err.message);
  }
}

async function renderForgotTurnstile() {
  const container = document.getElementById('forgotTurnstile');
  const submitBtn = document.getElementById('btnForgotRequestSubmit');
  const statusEl = document.getElementById('forgotTurnstileStatus');
  if (!container || !isContainerVisible(container)) return;

  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!window.turnstile || !window.turnstile.render) {
    whenTurnstileReady(() => renderForgotTurnstile());
    if (isLocal && submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
    return;
  }

  try {
    const siteKey = await getTurnstileSiteKey();
    if (!siteKey) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.opacity = '1';
        submitBtn.style.cursor = 'pointer';
      }
      return;
    }

    // If already rendered, reset cleanly on newly opened visible container
    if (turnstileWidgetIds['forgot'] !== undefined) {
      try {
        window.turnstile.reset(turnstileWidgetIds['forgot']);
        currentTurnstileTokens['forgot'] = '';
        if (submitBtn) {
          submitBtn.disabled = !isLocal;
          submitBtn.style.opacity = isLocal ? '1' : '0.6';
          submitBtn.style.cursor = isLocal ? 'pointer' : 'not-allowed';
        }
      } catch (_) {}
      return;
    }

    turnstileWidgetIds['forgot'] = window.turnstile.render('#forgotTurnstile', {
      sitekey: siteKey,
      theme: 'light',
      callback: (token) => {
        currentTurnstileTokens['forgot'] = token;
        if (statusEl) statusEl.style.display = 'none';
        clearAuthMessages();
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
          submitBtn.style.cursor = 'pointer';
        }
      },
      'expired-callback': () => {
        currentTurnstileTokens['forgot'] = '';
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.style.opacity = '0.6';
          submitBtn.style.cursor = 'not-allowed';
        }
        if (statusEl) {
          statusEl.textContent = 'Security verification expired. Please solve the challenge again.';
          statusEl.style.display = 'block';
        }
        if (window.turnstile && turnstileWidgetIds['forgot'] !== undefined) {
          try { window.turnstile.reset(turnstileWidgetIds['forgot']); } catch (_) {}
        }
      },
      'error-callback': (code) => {
        currentTurnstileTokens['forgot'] = '';
        if (submitBtn) {
          submitBtn.disabled = !isLocal;
          submitBtn.style.opacity = isLocal ? '1' : '0.6';
          submitBtn.style.cursor = isLocal ? 'pointer' : 'not-allowed';
        }
        if (statusEl) {
          statusEl.textContent = 'Verification error. Please refresh challenge.';
          statusEl.style.display = 'block';
        }
        console.warn('[Turnstile Forgot Password Widget Error]', code);
      }
    });

    if (isLocal && submitBtn) {
      submitBtn.disabled = false;
      submitBtn.style.opacity = '1';
      submitBtn.style.cursor = 'pointer';
    }
  } catch (err) {
    console.warn('[Turnstile Forgot Render Error]', err.message);
  }
}

async function initTurnstileWidgets() {
  try {
    await renderLoginTurnstile();
  } catch (err) {
    console.warn('[Turnstile Widgets Init Error]', err.message);
  }
}

function initAll() {
  try { initFloatingLeaves(); } catch (e) { console.warn('[Init] Floating Leaves Error:', e); }
  try { initDoshaPicker(); } catch (e) { console.warn('[Init] Dosha Picker Error:', e); }
  try { initAuthTabs(); } catch (e) { console.warn('[Init] Auth Tabs Error:', e); }
  try { initFormSubmissions(); } catch (e) { console.warn('[Init] Form Submissions Error:', e); }
  try { initForgotPasswordFlow(); } catch (e) { console.warn('[Init] Forgot Password Flow Error:', e); }
  try { initTurnstileWidgets(); } catch (e) { console.warn('[Init] Turnstile Widgets Error:', e); }
  try { checkExistingSession(); } catch (e) { console.warn('[Init] Existing Session Error:', e); }

  const logoutBtn = document.getElementById('btnLogoutSession');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.handleUserLogout();
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAll);
} else {
  initAll();
}

/* ==========================================================================
   1. FLOATING BOTANICAL LEAVES ANIMATION
   ========================================================================== */
function initFloatingLeaves() {
  const container = document.getElementById('leavesContainer');
  if (!container) return;

  const leafIcons = ['🌿', '🍃', '🌸', '✨', '🌺', '🌱', '🌾'];

  for (let i = 0; i < 22; i++) {
    const leaf = document.createElement('div');
    leaf.className = 'floating-leaf';
    leaf.textContent = leafIcons[Math.floor(Math.random() * leafIcons.length)];

    leaf.style.left = `${Math.random() * 100}vw`;
    leaf.style.animationDuration = `${9 + Math.random() * 12}s`;
    leaf.style.animationDelay = `${Math.random() * 8}s`;
    leaf.style.fontSize = `${1.2 + Math.random() * 1.6}rem`;

    container.appendChild(leaf);
  }
}

/* ==========================================================================
   2. INTERACTIVE DOSHA PROFILE SELECTOR
   ========================================================================== */
let selectedDosha = "Pitta (Sensitive/Warm)";

function initDoshaPicker() {
  const pills = document.querySelectorAll('.dosha-choice-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedDosha = pill.getAttribute('data-dosha');
    });
  });
}

/* ==========================================================================
   3. TABS SWITCHER (SIGN IN VS CREATE ACCOUNT)
   ========================================================================== */
function initAuthTabs() {
  const tabBtns = document.querySelectorAll('.auth-tab-btn');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const otpForm = document.getElementById('otpForm');
  const forgotContainer = document.getElementById('forgotPasswordContainer');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      clearAuthMessages();

      if (otpForm) otpForm.style.display = 'none';
      if (forgotContainer) forgotContainer.style.display = 'none';

      const mode = btn.getAttribute('data-mode');
      if (mode === 'login') {
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        setTimeout(() => renderLoginTurnstile(), 50);
      } else {
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
        setTimeout(() => renderRegisterTurnstile(), 50);
      }
    });
  });
}

/* ==========================================================================
   4. TWO-STEP OTP FLOW & FORM SUBMISSIONS
   ========================================================================== */
function showOtpVerificationStep(identifier, maskedText, devOtp) {
  clearAuthMessages();
  pendingAuthIdentifier = identifier;
  lastDevOtp = devOtp || '';

  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabsWrap = document.getElementById('authTabsWrap');
  const otpForm = document.getElementById('otpForm');
  const otpTargetMasked = document.getElementById('otpTargetMasked');
  const otpInput = document.getElementById('otpInput');
  const otpDevHint = document.getElementById('otpDevHint');
  const otpDevCode = document.getElementById('otpDevCode');

  if (loginForm) loginForm.style.display = 'none';
  if (registerForm) registerForm.style.display = 'none';
  if (tabsWrap) tabsWrap.style.display = 'none';
  if (otpForm) otpForm.style.display = 'block';
  setTimeout(() => renderOtpTurnstile(), 50);

  if (otpTargetMasked) {
    otpTargetMasked.textContent = maskedText || identifier;
  }

  if (otpDevHint && otpDevCode) {
    if (devOtp) {
      otpDevHint.style.display = 'block';
      otpDevCode.textContent = devOtp;
    } else {
      otpDevHint.style.display = 'none';
    }
  }

  if (otpInput) {
    otpInput.value = '';
    otpInput.focus();
  }

  startResendCountdownTimer();
}

function startResendCountdownTimer() {
  const btnResend = document.getElementById('btnResendOtp');
  const countdownSpan = document.getElementById('otpCountdown');

  if (resendTimer) clearInterval(resendTimer);
  resendSecondsRemaining = 60;

  if (btnResend) {
    btnResend.disabled = true;
    btnResend.style.opacity = '0.6';
    btnResend.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Resend OTP in <span id="otpCountdown">60</span>s`;
  }

  resendTimer = setInterval(() => {
    resendSecondsRemaining--;
    const span = document.getElementById('otpCountdown');
    if (span) span.textContent = resendSecondsRemaining;

    if (resendSecondsRemaining <= 0) {
      clearInterval(resendTimer);
      if (btnResend) {
        btnResend.disabled = false;
        btnResend.style.opacity = '1';
        btnResend.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Resend OTP Now`;
      }
    }
  }, 1000);
}

function initFormSubmissions() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const otpForm = document.getElementById('otpForm');
  const demoBtn = document.getElementById('btnDemoLogin');
  const btnBack = document.getElementById('btnBackToCredentials');
  const btnResend = document.getElementById('btnResendOtp');
  const btnAutoFill = document.getElementById('btnAutoFillOtp');

  // Back button from OTP step to credentials
  if (btnBack) {
    btnBack.addEventListener('click', () => {
      clearAuthMessages();
      if (resendTimer) clearInterval(resendTimer);

      const tabsWrap = document.getElementById('authTabsWrap');
      if (tabsWrap) tabsWrap.style.display = 'flex';
      if (otpForm) otpForm.style.display = 'none';

      // Re-open active tab
      const activeTab = document.querySelector('.auth-tab-btn.active');
      const mode = activeTab ? activeTab.getAttribute('data-mode') : 'login';
      if (mode === 'login' && loginForm) {
        loginForm.style.display = 'block';
      } else if (registerForm) {
        registerForm.style.display = 'block';
      }
    });
  }

  // Auto-fill dev OTP helper button
  if (btnAutoFill) {
    btnAutoFill.addEventListener('click', () => {
      const otpInput = document.getElementById('otpInput');
      if (otpInput && lastDevOtp) {
        otpInput.value = lastDevOtp;
        otpInput.focus();
      }
    });
  }

  // Resend OTP action
  if (btnResend) {
    btnResend.addEventListener('click', async () => {
      if (btnResend.disabled || !pendingAuthIdentifier) return;
      clearAuthMessages();

      try {
        btnResend.disabled = true;
        btnResend.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending code...`;

        const res = await fetch('/api/resend-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ identifier: pendingAuthIdentifier })
        });
        const data = await res.json();

        if (data.success) {
          lastDevOtp = data.devOtp || '';
          if (data.devOtp && document.getElementById('otpDevCode')) {
            document.getElementById('otpDevHint').style.display = 'block';
            document.getElementById('otpDevCode').textContent = data.devOtp;
          }
          startResendCountdownTimer();
        } else {
          showAuthError(data.message || 'Could not resend OTP. Please try again.');
          btnResend.disabled = false;
        }
      } catch (err) {
        showAuthError('Network error resending OTP. Please try again.');
        btnResend.disabled = false;
      }
    });
  }

  // 1. Step 1: Login Form
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthMessages();

      const identifier = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      const submitBtn = document.getElementById('btnLoginSubmit') || loginForm.querySelector('button[type="submit"]');

      if (!identifier || !password) {
        showAuthError('Please enter your email/mobile number and password.');
        return;
      }

      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const token = getActiveTurnstileToken('login');
      if (!token && window.turnstile && !isLocalHost) {
        showAuthError('Please complete the security bot verification before continuing.');
        return;
      }

      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking credentials...`;
      }

      try {
        const token = getActiveTurnstileToken('login');
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ identifier, password, turnstileToken: token })
        });
        const data = await res.json();

        if (data.requireOtp) {
          showOtpVerificationStep(data.identifier || identifier, data.masked, data.devOtp);
        } else if (data.success && data.user) {
          localStorage.setItem('umanarayani_user', JSON.stringify(data.user));
          displayLoginSuccess(data.user, data.activeUsersCount, data.totalUsersCount);
        } else {
          resetTurnstileWidget('login');
          showAuthError(data.message || 'Login failed. Please verify credentials.');
        }
      } catch (err) {
        resetTurnstileWidget('login');
        showAuthError('Unable to connect to Ayurvedic Sanctuary server. Please try again.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHtml;
        }
      }
    });
  }

  // 2. Step 1: Register Form
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthMessages();

      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const phone = document.getElementById('regPhone') ? document.getElementById('regPhone').value.trim() : '';
      const password = document.getElementById('regPassword').value;
      const hairType = document.getElementById('regHairType').value;
      const submitBtn = document.getElementById('btnRegisterSubmit') || registerForm.querySelector('button[type="submit"]');

      if (!name || (!email && !phone) || !password) {
        showAuthError('Please provide your name, email/mobile number, and a secure password.');
        return;
      }

      if (password.length < 6) {
        showAuthError('Password must contain at least 6 characters.');
        return;
      }

      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const token = getActiveTurnstileToken('register');
      if (!token && window.turnstile && !isLocalHost) {
        showAuthError('Please complete the security bot verification before continuing.');
        return;
      }

      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Registering sanctuary account...`;
      }

      try {
        const token = getActiveTurnstileToken('register');
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name,
            email,
            phone,
            password,
            dosha: selectedDosha,
            hairType,
            turnstileToken: token
          })
        });
        const data = await res.json();

        if (data.requireOtp) {
          const primaryId = data.identifier || email || phone;
          showOtpVerificationStep(primaryId, data.masked, data.devOtp);
        } else if (data.success && data.user) {
          localStorage.setItem('umanarayani_user', JSON.stringify(data.user));
          displayLoginSuccess(data.user, data.activeUsersCount, data.totalUsersCount);
        } else {
          resetTurnstileWidget('register');
          showAuthError(data.message || 'Registration failed.');
        }
      } catch (err) {
        resetTurnstileWidget('register');
        showAuthError('Unable to connect to server for registration. Please try again.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHtml;
        }
      }
    });
  }

  // 3. Step 2: OTP Verification Form Submission
  if (otpForm) {
    otpForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthMessages();

      const otp = document.getElementById('otpInput').value.trim();
      const submitBtn = document.getElementById('btnSubmitOtp');

      if (!/^\d{6}$/.test(otp)) {
        showAuthError('Please enter a valid 6-digit numeric OTP code.');
        return;
      }

      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying Sacred OTP...`;
      }

      try {
        const token = getActiveTurnstileToken('otp');
        const res = await fetch('/api/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            identifier: pendingAuthIdentifier,
            otp,
            turnstileToken: token
          })
        });
        const data = await res.json();

        if (data.success && data.user) {
          if (resendTimer) clearInterval(resendTimer);
          localStorage.setItem('umanarayani_user', JSON.stringify(data.user));

          // Stealth Admin RBAC: Redirect admin to /admin.html, customers to home '/'
          const isAdmin = Boolean(data.role === 'admin' || data.redirectUrl === '/admin.html' || (data.user && data.user.role === 'admin'));
          if (isAdmin) {
            window.location.href = '/admin.html';
            return;
          }

          window.location.href = '/';
          return;
        } else {
          resetTurnstileWidget('otp');
          showAuthError(data.message || 'OTP verification failed. Please try again.');
        }
      } catch (err) {
        resetTurnstileWidget('otp');
        showAuthError('Error verifying OTP with server. Please try again.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHtml;
        }
      }
    });
  }

  // 4. Quick 1-Click Demo Login
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      clearAuthMessages();
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            identifier: "pushpendra@example.com",
            password: "ayurveda_pass",
            turnstileToken: getActiveTurnstileToken('login')
          })
        });
        const data = await res.json();

        if (data.requireOtp) {
          showOtpVerificationStep(data.identifier || "pushpendra@example.com", data.masked, data.devOtp);
          // For demo speed: if devOtp is returned, pre-fill it into the input
          if (data.devOtp) {
            const input = document.getElementById('otpInput');
            if (input) input.value = data.devOtp;
          }
          return;
        } else if (data.success && data.user) {
          localStorage.setItem('umanarayani_user', JSON.stringify(data.user));
          displayLoginSuccess(data.user, data.activeUsersCount, data.totalUsersCount);
          return;
        }
      } catch (e) {}

      // Instant Local Fallback if server is offline
      const demoUser = {
        name: "Pushpendra Singh",
        email: "pushpendra@example.com",
        dosha: "Pitta-Vata",
        avatar: "🌿",
        is_verified: true
      };
      localStorage.setItem('umanarayani_user', JSON.stringify(demoUser));
      displayLoginSuccess(demoUser);
    });
  }
}

/* ==========================================================================
   5. POST-LOGIN SCREEN & ACTUAL ACTIVE USERS SHOWCASE
   ========================================================================== */
function getClientSessionId() {
  let sid = sessionStorage.getItem('umanarayani_session_id');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    sessionStorage.setItem('umanarayani_session_id', sid);
  }
  return sid;
}

function updateAuthBannerCount(activeCount, totalCount) {
  const liveEl = document.getElementById('liveUsersNumber');
  if (liveEl && typeof activeCount === 'number') {
    liveEl.textContent = activeCount;
  }

  const totalEl = document.getElementById('totalUsersNumber');
  if (totalEl && totalCount) {
    totalEl.textContent = typeof totalCount === 'number' ? totalCount.toLocaleString('en-IN') + '+' : totalCount;
  }

  const liveSub = document.getElementById('liveUsersSubCount');
  if (liveSub && typeof activeCount === 'number') {
    liveSub.textContent = activeCount;
  }

  const totalSub = document.getElementById('totalUsersSubText');
  if (totalSub && totalCount) {
    totalSub.textContent = typeof totalCount === 'number' ? totalCount.toLocaleString('en-IN') + '+' : totalCount;
  }
}

let authEvtSource = null;

async function displayLoginSuccess(user, initialCount, initialTotal) {
  const formsWrap = document.getElementById('authFormsContainer');
  const tabsWrap = document.getElementById('authTabsWrap');
  const successSection = document.getElementById('loginSuccessSection');
  const otpForm = document.getElementById('otpForm');

  if (formsWrap) formsWrap.style.display = 'none';
  if (tabsWrap) tabsWrap.style.display = 'none';
  if (otpForm) otpForm.style.display = 'none';
  if (successSection) successSection.style.display = 'block';

  // Populate user info with null guards
  const nameEl = document.getElementById('successUserName');
  if (nameEl) nameEl.textContent = user.name || 'Seeker';
  const doshaEl = document.getElementById('successUserDosha');
  if (doshaEl) doshaEl.textContent = `Ayurvedic Constitution: ${user.dosha || 'Pitta-Vata'}`;
  const avatarEl = document.getElementById('successAvatar');
  if (avatarEl) {
    const rawAvatar = (user.avatar || '').trim();
    if (rawAvatar && rawAvatar !== '?' && !rawAvatar.includes('?')) {
      avatarEl.textContent = rawAvatar;
    } else {
      avatarEl.innerHTML = '<i class="fa-solid fa-leaf" style="color:var(--emerald-primary, #154734);"></i>';
    }
  }

  if (typeof initialCount === 'number') {
    updateAuthBannerCount(initialCount, initialTotal);
  } else {
    // Quick async fetch for current counts if not already passed
    fetch(`/api/users/active?sessionId=${encodeURIComponent(getClientSessionId())}`)
      .then(r => r.json())
      .then(d => {
        if (d && d.success) {
          updateAuthBannerCount(d.activeUsers, d.totalUsers);
        }
      })
      .catch(() => {});
  }

  // Connect to live SSE for exact synchronized count across all users
  startLiveUserTicker();
}

function startLiveUserTicker() {
  const countEl = document.getElementById('liveUsersNumber');
  if (!countEl) return;

  const sessionId = getClientSessionId();

  if (window.EventSource) {
    if (authEvtSource) authEvtSource.close();
    try {
      authEvtSource = new EventSource(`/api/users/stream?sessionId=${encodeURIComponent(sessionId)}`);
      authEvtSource.onmessage = function(e) {
        try {
          const data = JSON.parse(e.data);
          if (data && typeof data.activeUsers === 'number') {
            updateAuthBannerCount(data.activeUsers, data.totalUsers);
          }
        } catch (err) {}
      };
      authEvtSource.onerror = function() {
        authEvtSource.close();
        pollAuthCount(sessionId);
      };
      return;
    } catch (e) {
      pollAuthCount(sessionId);
    }
  } else {
    pollAuthCount(sessionId);
  }
}

let pollInterval = null;
function pollAuthCount(sessionId) {
  if (pollInterval) clearInterval(pollInterval);
  const fetchCount = async () => {
    try {
      const res = await fetch(`/api/users/active?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (data && data.success && typeof data.activeUsers === 'number') {
        updateAuthBannerCount(data.activeUsers, data.totalUsers);
      }
    } catch (e) {}
  };
  fetchCount();
  pollInterval = setInterval(fetchCount, 5000);
}

async function checkExistingSession() {
  // 1. Verify HttpOnly server cookie session first (XSS-safe)
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();
    if (data && data.authenticated && data.user) {
      localStorage.setItem('umanarayani_user', JSON.stringify(data.user));
      displayLoginSuccess(data.user);
      return;
    }
  } catch (e) {}

  // 2. Fallback to cached local profile
  const user = JSON.parse(localStorage.getItem('umanarayani_user') || 'null');
  if (user) {
    if (user.avatar === '?') user.avatar = '🌿';
    displayLoginSuccess(user);
  }
}

window.handleUserLogout = async function() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch (e) {}
  localStorage.removeItem('umanarayani_user');
  window.location.reload();
};

/* ==========================================================================
   5. FORGOT PASSWORD FLOW (3-STEP RECOVERY)
   ========================================================================== */
let pendingForgotIdentifier = '';
let currentResetToken = '';
let forgotResendTimer = null;
let forgotResendSecondsRemaining = 60;
let lastForgotDevOtp = '';

function initForgotPasswordFlow() {
  const linkForgot = document.getElementById('linkForgotPassword');
  const forgotContainer = document.getElementById('forgotPasswordContainer');
  const forgotRequestForm = document.getElementById('forgotRequestForm');
  const forgotVerifyForm = document.getElementById('forgotVerifyForm');
  const forgotResetForm = document.getElementById('forgotResetForm');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const otpForm = document.getElementById('otpForm');
  const tabsWrap = document.getElementById('authTabsWrap');

  const btnBackToLogin = document.getElementById('btnForgotBackToLogin');
  const btnCancel = document.getElementById('btnForgotCancel');
  const btnBackToRequest = document.getElementById('btnForgotBackToRequest');
  const btnResendForgotOtp = document.getElementById('btnForgotResendOtp');
  const btnAutoFillForgotOtp = document.getElementById('btnForgotAutoFillOtp');

  // Show Forgot Password View
  function showForgotRequestView() {
    clearAuthMessages();
    if (loginForm) loginForm.style.display = 'none';
    if (registerForm) registerForm.style.display = 'none';
    if (otpForm) otpForm.style.display = 'none';
    if (tabsWrap) tabsWrap.style.display = 'none';

    if (forgotContainer) forgotContainer.style.display = 'block';
    if (forgotRequestForm) forgotRequestForm.style.display = 'block';
    if (forgotVerifyForm) forgotVerifyForm.style.display = 'none';
    if (forgotResetForm) forgotResetForm.style.display = 'none';

    // Render or refresh Turnstile widget on visible container
    setTimeout(() => renderForgotTurnstile(), 50);

    const input = document.getElementById('forgotIdentifier');
    if (input) {
      // Pre-fill from login field if already provided
      const loginEmailInput = document.getElementById('loginEmail');
      if (loginEmailInput && loginEmailInput.value.trim() && !input.value.trim()) {
        input.value = loginEmailInput.value.trim();
      }
      input.focus();
    }
  }

  // Return to Login View
  function returnToLoginView() {
    clearAuthMessages();
    if (forgotResendTimer) clearInterval(forgotResendTimer);

    if (forgotContainer) forgotContainer.style.display = 'none';
    if (forgotRequestForm) forgotRequestForm.style.display = 'none';
    if (forgotVerifyForm) forgotVerifyForm.style.display = 'none';
    if (forgotResetForm) forgotResetForm.style.display = 'none';

    if (tabsWrap) tabsWrap.style.display = 'flex';
    if (loginForm) loginForm.style.display = 'block';
    if (registerForm) registerForm.style.display = 'none';
    if (otpForm) otpForm.style.display = 'none';

    const tabBtns = document.querySelectorAll('.auth-tab-btn');
    tabBtns.forEach(btn => {
      if (btn.getAttribute('data-mode') === 'login') btn.classList.add('active');
      else btn.classList.remove('active');
    });

    resetTurnstileWidget('forgot');
    setTimeout(() => renderLoginTurnstile(), 50);
  }

  if (linkForgot) {
    linkForgot.addEventListener('click', (e) => {
      e.preventDefault();
      showForgotRequestView();
    });
    linkForgot.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        showForgotRequestView();
      }
    });
  }

  if (btnBackToLogin) {
    btnBackToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      returnToLoginView();
    });
    btnBackToLogin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        returnToLoginView();
      }
    });
  }

  if (btnCancel) {
    btnCancel.addEventListener('click', (e) => {
      e.preventDefault();
      returnToLoginView();
    });
    btnCancel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        returnToLoginView();
      }
    });
  }

  if (btnBackToRequest) {
    btnBackToRequest.addEventListener('click', (e) => {
      e.preventDefault();
      clearAuthMessages();
      if (forgotResendTimer) clearInterval(forgotResendTimer);
      if (forgotVerifyForm) forgotVerifyForm.style.display = 'none';
      if (forgotRequestForm) forgotRequestForm.style.display = 'block';
      const input = document.getElementById('forgotIdentifier');
      if (input) input.focus();
    });
    btnBackToRequest.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        clearAuthMessages();
        if (forgotResendTimer) clearInterval(forgotResendTimer);
        if (forgotVerifyForm) forgotVerifyForm.style.display = 'none';
        if (forgotRequestForm) forgotRequestForm.style.display = 'block';
        const input = document.getElementById('forgotIdentifier');
        if (input) input.focus();
      }
    });
  }

  // Password Visibility Toggles
  const toggleButtons = document.querySelectorAll('.btn-toggle-pwd');
  toggleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const targetInput = document.getElementById(targetId);
      const icon = btn.querySelector('i');
      if (!targetInput) return;

      if (targetInput.type === 'password') {
        targetInput.type = 'text';
        if (icon) {
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        }
      } else {
        targetInput.type = 'password';
        if (icon) {
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      }
    });
  });

  // Step A: Request OTP Submission
  if (forgotRequestForm) {
    forgotRequestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthMessages();

      const identifierInput = document.getElementById('forgotIdentifier');
      const identifier = identifierInput ? identifierInput.value.trim() : '';
      const submitBtn = document.getElementById('btnForgotRequestSubmit');

      if (!identifier) {
        showAuthError('Please enter your registered email address or mobile number.');
        return;
      }

      const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const token = getActiveTurnstileToken('forgot');
      if (!token && window.turnstile && !isLocalHost) {
        showAuthError('Please complete the security bot verification before requesting OTP.');
        return;
      }

      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending Recovery Code...`;
      }

      try {
        const res = await fetch('/api/auth/forgot-password/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ identifier, turnstileToken: token })
        });
        const data = await res.json();

        if (data.success) {
          pendingForgotIdentifier = identifier;
          lastForgotDevOtp = data.devOtp || '';

          const maskedTarget = document.getElementById('forgotTargetMasked');
          if (maskedTarget) {
            maskedTarget.textContent = data.masked || identifier;
          }

          const devHint = document.getElementById('forgotOtpDevHint');
          const devCode = document.getElementById('forgotOtpDevCode');
          if (devHint && devCode) {
            if (data.devOtp) {
              devHint.style.display = 'block';
              devCode.textContent = data.devOtp;
            } else {
              devHint.style.display = 'none';
            }
          }

          forgotRequestForm.style.display = 'none';
          if (forgotVerifyForm) {
            forgotVerifyForm.style.display = 'block';
            const otpInput = document.getElementById('forgotOtpInput');
            if (otpInput) {
              otpInput.value = '';
              otpInput.focus();
            }
          }
          startForgotResendTimer();
        } else {
          resetTurnstileWidget('forgot');
          showAuthError(data.message || 'Unable to request password recovery. Please try again.');
        }
      } catch (err) {
        resetTurnstileWidget('forgot');
        showAuthError('Network error connecting to Ayurvedic Sanctuary. Please try again.');
      } finally {
        if (submitBtn) {
          submitBtn.innerHTML = origBtnHtml;
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          const hasToken = Boolean(currentTurnstileTokens['forgot']);
          submitBtn.disabled = !(hasToken || isLocal);
          submitBtn.style.opacity = (hasToken || isLocal) ? '1' : '0.6';
          submitBtn.style.cursor = (hasToken || isLocal) ? 'pointer' : 'not-allowed';
        }
      }
    });
  }

  function startForgotResendTimer() {
    if (forgotResendTimer) clearInterval(forgotResendTimer);
    forgotResendSecondsRemaining = 60;

    const btnResend = document.getElementById('btnForgotResendOtp');
    if (btnResend) {
      btnResend.disabled = true;
      btnResend.style.opacity = '0.6';
      btnResend.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Resend OTP in <span id="forgotOtpCountdown">60</span>s`;
    }

    forgotResendTimer = setInterval(() => {
      forgotResendSecondsRemaining--;
      const span = document.getElementById('forgotOtpCountdown');
      if (span) span.textContent = forgotResendSecondsRemaining;

      if (forgotResendSecondsRemaining <= 0) {
        clearInterval(forgotResendTimer);
        if (btnResend) {
          btnResend.disabled = false;
          btnResend.style.opacity = '1';
          btnResend.innerHTML = `<i class="fa-solid fa-rotate-right"></i> Resend OTP Now`;
        }
      }
    }, 1000);
  }

  // Resend OTP Action in Step B
  if (btnResendForgotOtp) {
    btnResendForgotOtp.addEventListener('click', async () => {
      if (btnResendForgotOtp.disabled || !pendingForgotIdentifier) return;
      clearAuthMessages();

      try {
        btnResendForgotOtp.disabled = true;
        btnResendForgotOtp.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending code...`;

        const res = await fetch('/api/auth/forgot-password/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ identifier: pendingForgotIdentifier })
        });
        const data = await res.json();

        if (data.success) {
          lastForgotDevOtp = data.devOtp || '';
          if (data.devOtp && document.getElementById('forgotOtpDevCode')) {
            document.getElementById('forgotOtpDevHint').style.display = 'block';
            document.getElementById('forgotOtpDevCode').textContent = data.devOtp;
          }
          startForgotResendTimer();
        } else {
          showAuthError(data.message || 'Could not resend recovery code. Please try again.');
          btnResendForgotOtp.disabled = false;
        }
      } catch (err) {
        showAuthError('Network error resending recovery code. Please try again.');
        btnResendForgotOtp.disabled = false;
      }
    });
  }

  // Auto-fill dev OTP in Step B
  if (btnAutoFillForgotOtp) {
    btnAutoFillForgotOtp.addEventListener('click', () => {
      const otpInput = document.getElementById('forgotOtpInput');
      if (otpInput && lastForgotDevOtp) {
        otpInput.value = lastForgotDevOtp;
        otpInput.focus();
      }
    });
  }

  // Step B: Verify OTP Submission
  if (forgotVerifyForm) {
    forgotVerifyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthMessages();

      const otpInput = document.getElementById('forgotOtpInput');
      const otp = otpInput ? otpInput.value.trim() : '';
      const submitBtn = document.getElementById('btnForgotVerifySubmit');

      if (!/^\d{6}$/.test(otp)) {
        showAuthError('Please enter the 6-digit numeric recovery code.');
        return;
      }

      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying Code...`;
      }

      try {
        const res = await fetch('/api/auth/forgot-password/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ identifier: pendingForgotIdentifier, otp })
        });
        const data = await res.json();

        if (data.success && data.resetToken) {
          currentResetToken = data.resetToken;
          if (forgotResendTimer) clearInterval(forgotResendTimer);

          forgotVerifyForm.style.display = 'none';
          if (forgotResetForm) {
            forgotResetForm.style.display = 'block';
            const newPwdInput = document.getElementById('forgotNewPassword');
            if (newPwdInput) {
              newPwdInput.value = '';
              newPwdInput.focus();
            }
            const confirmPwdInput = document.getElementById('forgotConfirmPassword');
            if (confirmPwdInput) confirmPwdInput.value = '';
          }
        } else {
          showAuthError(data.message || 'Verification failed. The code may be incorrect or expired.');
        }
      } catch (err) {
        showAuthError('Error verifying recovery code with server. Please try again.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHtml;
        }
      }
    });
  }

  // Step C: Reset Password Submission
  if (forgotResetForm) {
    forgotResetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthMessages();

      const newPassword = document.getElementById('forgotNewPassword').value;
      const confirmPassword = document.getElementById('forgotConfirmPassword').value;
      const submitBtn = document.getElementById('btnForgotResetSubmit');

      if (!newPassword || !confirmPassword) {
        showAuthError('Please enter and confirm your new password.');
        return;
      }

      if (newPassword !== confirmPassword) {
        showAuthError('Passwords do not match. Please re-enter them carefully.');
        return;
      }

      if (newPassword.length < 8) {
        showAuthError('Password must be at least 8 characters long.');
        return;
      }

      const hasLetter = /[a-zA-Z]/.test(newPassword);
      const hasDigitOrSymbol = /[\d!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
      if (!hasLetter || !hasDigitOrSymbol) {
        showAuthError('Password must contain letters and at least one number or symbol.');
        return;
      }

      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating Password...`;
      }

      try {
        const res = await fetch('/api/auth/forgot-password/reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            resetToken: currentResetToken,
            newPassword,
            confirmPassword
          })
        });
        const data = await res.json();

        if (data.success) {
          const finishedIdentifier = pendingForgotIdentifier;
          returnToLoginView();
          const loginEmailInput = document.getElementById('loginEmail');
          if (loginEmailInput && finishedIdentifier) {
            loginEmailInput.value = finishedIdentifier;
          }
          const loginPwdInput = document.getElementById('loginPassword');
          if (loginPwdInput) {
            loginPwdInput.value = '';
            loginPwdInput.focus();
          }

          currentResetToken = '';
          pendingForgotIdentifier = '';
          lastForgotDevOtp = '';

          showAuthSuccess('Your password has been updated securely! Please sign in with your new password.');
        } else {
          showAuthError(data.message || 'Unable to update password. Please try again.');
        }
      } catch (err) {
        showAuthError('Network error updating password. Please try again.');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origBtnHtml;
        }
      }
    });
  }
}

function showAuthSuccess(msg) {
  let box = document.getElementById('authAlertBox') || document.getElementById('authErrorBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'authAlertBox';
    const formWrap = document.querySelector('.auth-form-wrap');
    if (formWrap) formWrap.prepend(box);
  }
  box.className = 'auth-status-alert success';
  box.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right:6px;"></i> ${msg}`;
  box.style.display = 'block';
}

function showAuthError(msg) {
  let box = document.getElementById('authAlertBox') || document.getElementById('authErrorBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'authAlertBox';
    const formWrap = document.querySelector('.auth-form-wrap');
    if (formWrap) formWrap.prepend(box);
  }
  box.className = 'auth-status-alert error';
  box.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i> ${msg}`;
  box.style.display = 'block';
}

function clearAuthMessages() {
  const box1 = document.getElementById('authAlertBox');
  if (box1) box1.style.display = 'none';
  const box2 = document.getElementById('authErrorBox');
  if (box2) box2.style.display = 'none';
}
