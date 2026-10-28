/**
 * UMANARAYANI AYURVEDA — CREATIVE HERBAL AUTHENTICATION SCRIPT
 * Manages floating botanical leaves animation, interactive Dosha selection,
 * Sign In / Register toggle, and post-login real-time active users showcase.
 */

document.addEventListener('DOMContentLoaded', () => {
  initFloatingLeaves();
  initDoshaPicker();
  initAuthTabs();
  initFormSubmissions();
  checkExistingSession();
});

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
let selectedDosha = "Pitta-Vata";

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

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const mode = btn.getAttribute('data-mode');
      if (mode === 'login') {
        loginForm.style.display = 'block';
        registerForm.style.display = 'none';
      } else {
        loginForm.style.display = 'none';
        registerForm.style.display = 'block';
      }
    });
  });
}

/* ==========================================================================
   4. FORM SUBMISSIONS & DEMO LOGIN
   ========================================================================== */
function initFormSubmissions() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const demoBtn = document.getElementById('btnDemoLogin');

  // Login
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (data.success) {
          localStorage.setItem('umanarayani_user', JSON.stringify(data.user));
          displayLoginSuccess(data.user, data.activeUsersCount, data.totalUsersCount);
        } else {
          showAuthError(data.message || 'Login failed');
        }
      } catch (err) {
        // Fallback demo login
        const fallbackUser = {
          name: email.split('@')[0] || "Pushpendra Singh",
          email,
          dosha: selectedDosha,
          avatar: "🌿"
        };
        localStorage.setItem('umanarayani_user', JSON.stringify(fallbackUser));
        displayLoginSuccess(fallbackUser);
      }
    });
  }

  // Demo Login (Quick 1-Click Sign In)
  if (demoBtn) {
    demoBtn.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: "pushpendra@example.com", password: "ayurveda_pass" })
        });
        const data = await res.json();
        if (data.success) {
          localStorage.setItem('umanarayani_user', JSON.stringify(data.user));
          displayLoginSuccess(data.user, data.activeUsersCount, data.totalUsersCount);
          return;
        }
      } catch (e) {}

      // Instant Local Fallback
      const demoUser = {
        name: "Pushpendra Singh",
        email: "pushpendra@example.com",
        dosha: "Pitta-Vata",
        avatar: "🌿"
      };
      localStorage.setItem('umanarayani_user', JSON.stringify(demoUser));
      displayLoginSuccess(demoUser);
    });
  }

  // Register
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('regName').value.trim();
      const email = document.getElementById('regEmail').value.trim();
      const password = document.getElementById('regPassword').value;
      const hairType = document.getElementById('regHairType').value;

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            password,
            dosha: selectedDosha,
            hairType
          })
        });
        const data = await res.json();

        if (data.success) {
          localStorage.setItem('umanarayani_user', JSON.stringify(data.user));
          displayLoginSuccess(data.user, data.activeUsersCount, data.totalUsersCount);
        } else {
          showAuthError(data.message || 'Registration failed');
        }
      } catch (err) {
        const regUser = {
          name,
          email,
          dosha: selectedDosha,
          hairType,
          avatar: "🌸"
        };
        localStorage.setItem('umanarayani_user', JSON.stringify(regUser));
        displayLoginSuccess(regUser);
      }
    });
  }
}

/* ==========================================================================
   5. POST-LOGIN SCREEN & ACTUAL ACTIVE USERS SHOWCASE
   Requirement: "use actual count of the users using the website"
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
  const card = document.getElementById('herbalAuthCard');
  const formsWrap = document.getElementById('authFormsContainer');
  const tabsWrap = document.getElementById('authTabsWrap');
  const successSection = document.getElementById('loginSuccessSection');

  if (formsWrap) formsWrap.style.display = 'none';
  if (tabsWrap) tabsWrap.style.display = 'none';
  if (successSection) successSection.style.display = 'block';

  // Populate user info
  document.getElementById('successUserName').textContent = user.name;
  document.getElementById('successUserDosha').textContent = `Ayurvedic Constitution: ${user.dosha || 'Pitta-Vata'}`;
  document.getElementById('successAvatar').textContent = user.avatar || '🌿';

  if (typeof initialCount === 'number') {
    updateAuthBannerCount(initialCount, initialTotal);
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

function pollAuthCount(sessionId) {
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
  setInterval(fetchCount, 5000);
}
  fetchCount();
  setInterval(fetchCount, 5000);
}

function checkExistingSession() {
  const user = JSON.parse(localStorage.getItem('umanarayani_user') || 'null');
  if (user) {
    displayLoginSuccess(user);
  }
}

window.handleUserLogout = function() {
  localStorage.removeItem('umanarayani_user');
  window.location.reload();
};

function showAuthError(msg) {
  let errBox = document.getElementById('authErrorBox');
  if (!errBox) {
    errBox = document.createElement('div');
    errBox.id = 'authErrorBox';
    errBox.style.cssText = `
      background: #FDEDEC;
      color: #C0392B;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.85rem;
      margin-bottom: 16px;
      border: 1px solid #F5B7B1;
      text-align: center;
    `;
    const form = document.querySelector('.auth-form-wrap');
    if (form) form.prepend(errBox);
  }
  errBox.textContent = msg;
  errBox.style.display = 'block';
}
