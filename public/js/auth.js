/**
 * UMANARAYANI AYURVEDA — CREATIVE HERBAL AUTHENTICATION SCRIPT
 * Two-Step OTP Verification Flow (Email & SMS OTP via Nodemailer & Twilio),
 * Floating botanical leaves animation, interactive Dosha selection,
 * and post-login real-time active users showcase.
 */

let currentTurnstileToken = 'cf_test_pass';
let pendingAuthIdentifier = '';
let resendTimer = null;
let resendSecondsRemaining = 60;
let lastDevOtp = '';

document.addEventListener('DOMContentLoaded', () => {
  initFloatingLeaves();
  initDoshaPicker();
  initAuthTabs();
  initFormSubmissions();
  initTurnstileWidgets();
  checkExistingSession();

  const logoutBtn = document.getElementById('btnLogoutSession');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.handleUserLogout();
    });
  }
});

function initTurnstileWidgets() {
  const siteKey = window.TURNSTILE_SITE_KEY || '1x00000000000000000000AA';
  const renderWidget = () => {
    if (window.turnstile) {
      try {
        if (document.getElementById('loginTurnstile')) {
          window.turnstile.render('#loginTurnstile', {
            sitekey: siteKey,
            theme: 'light',
            callback: (token) => { currentTurnstileToken = token; }
          });
        }
        if (document.getElementById('registerTurnstile')) {
          window.turnstile.render('#registerTurnstile', {
            sitekey: siteKey,
            theme: 'light',
            callback: (token) => { currentTurnstileToken = token; }
          });
        }
        if (document.getElementById('otpTurnstile')) {
          window.turnstile.render('#otpTurnstile', {
            sitekey: siteKey,
            theme: 'light',
            callback: (token) => { currentTurnstileToken = token; }
          });
        }
      } catch (e) {}
    }
  };

  if (window.turnstile) {
    renderWidget();
  } else {
    window.addEventListener('load', () => setTimeout(renderWidget, 500));
  }
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

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      clearAuthMessages();

      if (otpForm) otpForm.style.display = 'none';

      const mode = btn.getAttribute('data-mode');
      if (mode === 'login') {
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
      } else {
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
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

      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking credentials...`;
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ identifier, password, turnstileToken: currentTurnstileToken })
        });
        const data = await res.json();

        if (data.requireOtp) {
          showOtpVerificationStep(data.identifier || identifier, data.masked, data.devOtp);
        } else if (data.success && data.user) {
          localStorage.setItem('umanarayani_user', JSON.stringify(data.user));
          displayLoginSuccess(data.user, data.activeUsersCount, data.totalUsersCount);
        } else {
          showAuthError(data.message || 'Login failed. Please verify credentials.');
        }
      } catch (err) {
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

      const origBtnHtml = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Registering sanctuary account...`;
      }

      try {
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
            turnstileToken: currentTurnstileToken
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
          showAuthError(data.message || 'Registration failed.');
        }
      } catch (err) {
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
        const res = await fetch('/api/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            identifier: pendingAuthIdentifier,
            otp,
            turnstileToken: currentTurnstileToken
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
          showAuthError(data.message || 'OTP verification failed. Please try again.');
        }
      } catch (err) {
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
            turnstileToken: currentTurnstileToken
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
  if (avatarEl) avatarEl.textContent = user.avatar || '🌿';

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

function showAuthError(msg) {
  let errBox = document.getElementById('authErrorBox');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.id = 'authErrorBox';
    const formWrap = document.querySelector('.auth-form-wrap');
    if (formWrap) formWrap.prepend(errBox);
  }
  errBox.style.cssText = `
    background: #FDEDEC;
    color: #C0392B;
    padding: 10px 14px;
    border-radius: 8px;
    font-size: 0.85rem;
    margin-bottom: 16px;
    border: 1px solid #F5B7B1;
    text-align: center;
    font-weight: 600;
  `;
  errBox.textContent = msg;
  errBox.style.display = 'block';
}

function clearAuthMessages() {
  const errBox = document.getElementById('authErrorBox');
  if (errBox) errBox.style.display = 'none';
}
