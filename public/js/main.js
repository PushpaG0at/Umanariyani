/**
 * UMANARAYANI AYURVEDA — MAIN HOMEPAGE SCRIPT
 * Orchestrates product catalog, smooth card pops, live user counter SSE,
 * WhatsApp consultation drawer, search, and session state.
 */

const WHATSAPP_NUMBER = "918641033514";

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Revolving Herbs Mandala Showcase
  if (window.initRevolvingMandala && document.getElementById('revolvingMandalaContainer')) {
    window.initRevolvingMandala('revolvingMandalaContainer');
  }

  // 2. Fetch and render products (with URL search param support)
  const urlParams = new URLSearchParams(window.location.search);
  const initialSearch = urlParams.get('search');
  if (initialSearch) {
    const input = document.getElementById('globalSearchInput');
    if (input) input.value = initialSearch;
    loadProducts('all', initialSearch);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    loadProducts();
  }

  // 3. Setup real-time active users listener
  setupActiveUsersTracker();

  // 4. Setup WhatsApp Consultation drawer
  setupWhatsAppWidget();

  // 5. Check logged-in user state
  checkUserState();

  // 6. Setup Category Filters
  setupCategoryTabs();

  // 7. Setup Live Search
  setupSearch();

  // 8. Update Cart Count
  updateCartBadge();
});

let allProducts = [];

/* ==========================================================================
   PRODUCT CATALOG LOADER & SMOOTH POP INTERACTION
   ========================================================================== */
async function loadProducts(category = 'all', query = '') {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  const mandalaSection = document.getElementById('mandalaShowcase');
  const searchBanner = document.getElementById('activeSearchBanner');
  const searchQueryText = document.getElementById('activeSearchQueryText');
  const searchCountEl = document.getElementById('activeSearchCount');
  const clearBtn = document.getElementById('searchClearBtn');

  if (query && query.trim()) {
    // Top Priority: When searching products, hide the hero herbs cycle so products appear at the TOP as first priority!
    if (mandalaSection) mandalaSection.style.display = 'none';
    if (searchBanner) searchBanner.style.display = 'flex';
    if (searchQueryText) searchQueryText.textContent = query.trim();
    if (clearBtn) clearBtn.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    // Normal View: restore the revolving herbs cycle
    if (mandalaSection) mandalaSection.style.display = '';
    if (searchBanner) searchBanner.style.display = 'none';
    if (clearBtn) {
      const input = document.getElementById('globalSearchInput');
      if (!input || !input.value) clearBtn.style.display = 'none';
    }
  }

  grid.innerHTML = `
    <div style="grid-column: 1/-1; text-align: center; padding: 48px; color: var(--text-muted);">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--green-sage);"></i>
      <p style="margin-top: 12px; font-weight: 600;">Brewing botanical product formulas...</p>
    </div>
  `;

  try {
    let url = '/api/products';
    const params = new URLSearchParams();
    if (category && category !== 'all') params.append('category', category);
    if (query) params.append('search', query);
    if (params.toString()) url += `?${params.toString()}`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.success && data.products) {
      allProducts = data.products;
      if (searchCountEl) searchCountEl.textContent = data.products.length;
      renderProductsGrid(data.products, query);
    } else {
      if (searchCountEl) searchCountEl.textContent = 0;
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px;">No products found in this category.</div>`;
    }
  } catch (err) {
    console.error("Failed to load products from API, falling back:", err);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: red;">Failed to load products from server.</div>`;
  }
}

function renderProductsGrid(products) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; background: #FFF; border-radius: 16px; border: 1px dashed var(--border-light);">
        <i class="fa-solid fa-leaf" style="font-size: 2.5rem; color: var(--green-light); margin-bottom: 12px;"></i>
        <h3 style="font-size: 1.3rem; color: var(--green-primary);">No products match your search</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 6px;">Try adjusting your search terms or view our complete Ayurvedic collection.</p>
        <button class="btn-card-details" onclick="loadProducts('all')" style="margin: 16px auto 0; display: inline-flex;">Reset Filters</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(product => {
    const starsHtml = '★'.repeat(Math.floor(product.rating)) + (product.rating % 1 !== 0 ? '½' : '');
    const productDetailUrl = `product.html?id=${encodeURIComponent(product.id)}`;
    const whatsappQuery = `Hello Umanarayani! I have a question regarding *${product.name}* (₹${product.price}). Could you please guide me?`;
    const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(whatsappQuery)}`;

    return `
      <div class="product-card" data-product-id="${product.id}" onclick="handleCardClick(event, '${productDetailUrl}')">
        <!-- Badge -->
        ${product.badge ? `<span class="product-badge-flag">${product.badge}</span>` : ''}

        <!-- Wishlist Button -->
        <button class="product-wishlist-btn" title="Add to Wishlist" onclick="toggleWishlist(event, '${product.id}')">
          <i class="fa-regular fa-heart"></i>
        </button>

        <!-- Product Image Showcase with Smooth Hover Zoom -->
        <div class="product-card-img-wrap">
          <img src="${product.image}" alt="${product.name}" class="product-card-img" loading="lazy">
          <div class="quick-view-overlay">
            <i class="fa-solid fa-eye"></i> View Full Details & Specs
          </div>
        </div>

        <!-- Product Content -->
        <div class="product-card-body">
          <span class="product-category-sub">${product.category} &bull; ${product.volume || 'Ayurvedic'}</span>
          <h3 class="product-card-title">${product.name}</h3>
          <p class="product-card-subtitle">${product.subtitle || ''}</p>

          <!-- Amazon-Style Rating -->
          <div class="product-rating-row">
            <span class="stars-group">${starsHtml}</span>
            <span class="rating-score">${product.rating}</span>
            <span class="rating-count">(${product.ratingCount || 100}+)</span>
          </div>

          <!-- Featured Ingredients Chips -->
          <div class="featured-herbs-chips">
            ${(product.featuredIngredients || []).slice(0, 4).map(herb => `
              <span class="herb-chip">🌿 ${herb}</span>
            `).join('')}
            ${(product.featuredIngredients || []).length > 4 ? `
              <span class="herb-chip">+${product.featuredIngredients.length - 4} more</span>
            ` : ''}
          </div>

          <!-- Price Row -->
          <div class="product-price-row">
            <span class="discount-badge">-${product.discountPercent}%</span>
            <span class="price-current">
              <span class="currency">₹</span>${product.price}
            </span>
            <span class="price-mrp">₹${product.mrp}</span>
          </div>

          <!-- Card Actions -->
          <div class="product-card-actions">
            <a href="${productDetailUrl}" class="btn-card-details" onclick="event.stopPropagation()">
              <i class="fa-solid fa-bag-shopping"></i> View Details
            </a>
            <a href="${whatsappUrl}" target="_blank" class="btn-card-whatsapp" onclick="event.stopPropagation()" title="WhatsApp Herbal Support (+91 8641033514)">
              <i class="fa-brands fa-whatsapp"></i> WhatsApp
            </a>
          </div>
          <button class="btn-card-ai" onclick="openAiForProduct(event, '${product.name.replace(/'/g, "\\'")}', '${product.id}')" style="width:100%; margin-top:8px; padding:7px 12px; background:#F0F7F2; border:1px solid rgba(45,106,79,0.2); border-radius:8px; color:var(--green-primary); font-size:0.78rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.2s ease;">
            <i class="fa-solid fa-wand-magic-sparkles" style="color:var(--gold-deep);"></i> Ask AI Vaidya about this
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// Quick AI trigger for a specific product
window.openAiForProduct = function(event, prodName, prodId) {
  event.stopPropagation();
  const sanctuary = document.getElementById('aiSanctuarySection');
  if (sanctuary) {
    sanctuary.scrollIntoView({ behavior: 'smooth' });
    const input = document.getElementById('aiInputField');
    if (input) {
      input.value = `Tell me about the key benefits and herbs in ${prodName}`;
      setTimeout(() => {
        const sendBtn = document.getElementById('aiSendBtn');
        if (sendBtn) sendBtn.click();
      }, 700);
    }
  }
};

// Clicking the card body opens the Amazon-style detail page
window.handleCardClick = function(event, url) {
  if (event.target.closest('a') || event.target.closest('button')) {
    return;
  }
  window.location.href = url;
};

window.toggleWishlist = function(event, productId) {
  event.stopPropagation();
  const btn = event.currentTarget;
  const icon = btn.querySelector('i');
  if (icon.classList.contains('fa-regular')) {
    icon.classList.remove('fa-regular');
    icon.classList.add('fa-solid');
    icon.style.color = '#E74C3C';
    showToast("Added to your Herbal Wishlist 🌿");
  } else {
    icon.classList.remove('fa-solid');
    icon.classList.add('fa-regular');
    icon.style.color = '';
    showToast("Removed from Wishlist");
  }
};

/* ==========================================================================
   REAL-TIME ACTUAL ACTIVE USERS TRACKER (SSE & Polling)
   ========================================================================== */
function getClientSessionId() {
  let sid = sessionStorage.getItem('umanarayani_session_id');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    sessionStorage.setItem('umanarayani_session_id', sid);
  }
  return sid;
}

function setupActiveUsersTracker() {
  const activeCountEl = document.getElementById('liveUsersCount');
  if (!activeCountEl) return;

  const sessionId = getClientSessionId();

  // Connect to live Server-Sent Events stream
  if (window.EventSource) {
    try {
      const evtSource = new EventSource(`/api/users/stream?sessionId=${encodeURIComponent(sessionId)}`);
      evtSource.onmessage = function(e) {
        try {
          const data = JSON.parse(e.data);
          if (data && typeof data.activeUsers === 'number') {
            updateUserDisplay(data.activeUsers, data.totalUsers);
          }
        } catch (err) {}
      };
      evtSource.onerror = function() {
        evtSource.close();
        startPollingActiveUsers(sessionId);
      };
      return;
    } catch (e) {
      startPollingActiveUsers(sessionId);
    }
  } else {
    startPollingActiveUsers(sessionId);
  }
}

function startPollingActiveUsers(sessionId) {
  const fetchCount = async () => {
    try {
      const res = await fetch(`/api/users/active?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (data && data.success && typeof data.activeUsers === 'number') {
        updateUserDisplay(data.activeUsers, data.totalUsers);
      }
    } catch (err) {}
  };

  fetchCount();
  setInterval(fetchCount, 5000);
}

function updateUserDisplay(activeCount, totalCount) {
  const countEl = document.getElementById('liveUsersCount');
  if (countEl && typeof activeCount === 'number') {
    countEl.textContent = activeCount;
  }
  const totalEl = document.getElementById('totalUsersCount');
  if (totalEl && totalCount) {
    totalEl.textContent = typeof totalCount === 'number' ? totalCount.toLocaleString('en-IN') + '+' : totalCount;
  }
  const bannerEl = document.getElementById('liveUsersBannerCount');
  if (bannerEl && typeof activeCount === 'number') {
    bannerEl.textContent = activeCount;
  }
}

/* ==========================================================================
   WHATSAPP CONSULTATION DRAWER (+918641033514)
   ========================================================================== */
function setupWhatsAppWidget() {
  const toggleBtn = document.getElementById('whatsappFloatingBtn');
  const teaser = document.getElementById('whatsappTeaser');
  const modal = document.getElementById('whatsappModal');
  const closeBtn = document.getElementById('btnCloseWaModal');
  const sendBtn = document.getElementById('btnWaSend');
  const input = document.getElementById('waInput');

  if (!modal) return;

  const openDrawer = () => {
    modal.classList.add('active');
    if (teaser) teaser.style.display = 'none';
  };

  const closeDrawer = () => {
    modal.classList.remove('active');
  };

  if (toggleBtn) toggleBtn.addEventListener('click', () => {
    modal.classList.contains('active') ? closeDrawer() : openDrawer();
  });

  if (teaser) teaser.addEventListener('click', openDrawer);
  if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

  // Quick Questions
  document.querySelectorAll('.quick-q-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const text = btn.getAttribute('data-query');
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
      window.open(url, '_blank');
      closeDrawer();
    });
  });

  // Custom Input
  const sendCustomMessage = () => {
    const val = input.value.trim();
    if (!val) return;
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(val)}`;
    window.open(url, '_blank');
    input.value = '';
    closeDrawer();
  };

  if (sendBtn) sendBtn.addEventListener('click', sendCustomMessage);
  if (input) {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendCustomMessage();
    });
  }
}

/* ==========================================================================
   USER STATE & HEADER MANAGEMENT
   ========================================================================== */
function checkUserState() {
  const user = JSON.parse(localStorage.getItem('umanarayani_user') || 'null');
  const signinBtn = document.getElementById('headerSignInBtn');
  if (!signinBtn) return;

  if (user && user.name) {
    const firstName = user.name.split(' ')[0];
    signinBtn.innerHTML = `
      <span style="font-size: 1rem;">${user.avatar || '🌿'}</span>
      <span class="user-btn-name">${firstName}</span>
    `;
    signinBtn.href = "signin.html";
    signinBtn.title = `${user.name} (${user.dosha || 'Ayurvedic Profile'}) — Click to view profile / logout`;
    signinBtn.classList.add('logged-in');
  } else {
    signinBtn.innerHTML = `<i class="fa-regular fa-user"></i> <span>Sign In</span>`;
    signinBtn.href = "signin.html";
    signinBtn.title = "Sign In / Register";
    signinBtn.classList.remove('logged-in');
  }
}

/* ==========================================================================
   CATEGORY TABS & SEARCH
   ========================================================================== */
function setupCategoryTabs() {
  const tabs = document.querySelectorAll('.cat-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.getAttribute('data-cat');
      loadProducts(cat);
    });
  });
}

function setupSearch() {
  const input = document.getElementById('globalSearchInput');
  const clearBtn = document.getElementById('searchClearBtn');
  const dropdown = document.getElementById('searchResultsDropdown');
  if (!input) return;

  let debounceTimer;

  input.addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';

    clearTimeout(debounceTimer);
    if (!q) {
      if (dropdown) dropdown.style.display = 'none';
      const mandalaSection = document.getElementById('mandalaShowcase');
      if (mandalaSection) mandalaSection.style.display = '';
      loadProducts('all', '');
      return;
    }

    // Immediately minimize/hide the revolving cycle so searched products are at the TOP as first priority!
    const mandalaSection = document.getElementById('mandalaShowcase');
    if (mandalaSection) mandalaSection.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });

    debounceTimer = setTimeout(async () => {
      // 1. Update matching products in catalog grid
      loadProducts('all', q);

      // 2. Fetch and render instant preview dropdown
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}`);
        const data = await res.json();
        const products = (data && data.success && data.products) ? data.products : [];
        renderSearchDropdown(products, q);
      } catch (err) {
        console.error("Search dropdown error:", err);
      }
    }, 180);
  });

  input.addEventListener('focus', () => {
    const q = input.value.trim();
    if (q && dropdown && dropdown.innerHTML.trim()) {
      dropdown.style.display = 'block';
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (dropdown) dropdown.style.display = 'none';
      if (q) {
        const mandalaSection = document.getElementById('mandalaShowcase');
        if (mandalaSection) mandalaSection.style.display = 'none';
        loadProducts('all', q);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (e.key === 'Escape') {
      if (dropdown) dropdown.style.display = 'none';
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      clearGlobalSearch();
      input.focus();
    });
  }

  // Restore cycle when clicking top nav "Home" or "Herbal Core"
  document.querySelectorAll('a[href="index.html"], a[href="#mandalaShowcase"]').forEach(link => {
    link.addEventListener('click', () => {
      if (input && input.value) {
        clearGlobalSearch();
      }
    });
  });

  // Close dropdown on click outside
  document.addEventListener('click', (e) => {
    if (dropdown && !e.target.closest('.search-bar-wrap')) {
      dropdown.style.display = 'none';
    }
  });
}

function renderSearchDropdown(products, query) {
  const dropdown = document.getElementById('searchResultsDropdown');
  if (!dropdown) return;

  if (products.length === 0) {
    dropdown.innerHTML = `
      <div class="search-dropdown-empty">
        <i class="fa-solid fa-leaf" style="font-size: 1.6rem; color: var(--green-light); margin-bottom: 8px; display:block;"></i>
        <span>No products found matching "<strong>${escapeHtml(query)}</strong>"</span>
        <div style="margin-top: 6px; font-size: 0.75rem; color: #888;">Try searching: Hair Oil, Shampoo, or Face Wash</div>
      </div>
    `;
    dropdown.style.display = 'block';
    return;
  }

  const itemsHtml = products.map(p => `
    <a href="product.html?id=${encodeURIComponent(p.id)}" class="search-dropdown-item">
      <img src="${escapeHtml(p.image)}" class="search-item-thumb" alt="${escapeHtml(p.name)}">
      <div class="search-item-info">
        <span class="search-item-name">${highlightMatch(p.name, query)}</span>
        <div class="search-item-cat">
          <span>🌿 ${escapeHtml(p.category)}</span>
          <span>&bull;</span>
          <span>★ ${escapeHtml(p.rating)}</span>
        </div>
      </div>
      <div class="search-item-price">₹${escapeHtml(p.price)}</div>
    </a>
  `).join('');

  dropdown.innerHTML = `
    <div class="search-dropdown-header">
      <span>Suggested Ayurvedic Products</span>
      <span style="color:var(--gold-deep);">${products.length} found</span>
    </div>
    ${itemsHtml}
    <div class="search-dropdown-footer" id="searchDropdownViewAll">
      View all in product catalog &darr;
    </div>
  `;
  dropdown.style.display = 'block';

  const viewAllBtn = document.getElementById('searchDropdownViewAll');
  if (viewAllBtn) {
    viewAllBtn.addEventListener('click', () => {
      scrollToProductsAndFilter(query);
    });
  }
}

function scrollToProductsAndFilter(query) {
  const dropdown = document.getElementById('searchResultsDropdown');
  if (dropdown) dropdown.style.display = 'none';
  loadProducts('all', query);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.clearGlobalSearch = function() {
  const input = document.getElementById('globalSearchInput');
  if (input) input.value = '';
  const clearBtn = document.getElementById('searchClearBtn');
  if (clearBtn) clearBtn.style.display = 'none';
  const dropdown = document.getElementById('searchResultsDropdown');
  if (dropdown) dropdown.style.display = 'none';
  const searchBanner = document.getElementById('activeSearchBanner');
  if (searchBanner) searchBanner.style.display = 'none';

  // Restore the revolving herbs cycle!
  const mandalaSection = document.getElementById('mandalaShowcase');
  if (mandalaSection) mandalaSection.style.display = '';

  // Reset category tabs to 'All'
  const tabs = document.querySelectorAll('.cat-tab-btn');
  tabs.forEach(t => {
    if (t.getAttribute('data-cat') === 'all') t.classList.add('active');
    else t.classList.remove('active');
  });

  loadProducts('all', '');
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

function highlightMatch(text, query) {
  if (!query) return escapeHtml(text);
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return escapeHtml(text).replace(regex, '<strong style="color:var(--green-sage); background:rgba(197,160,89,0.18); padding:0 2px; border-radius:2px;">$1</strong>');
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   CART SYSTEM & TOAST
   ========================================================================== */
function updateCartBadge() {
  const badge = document.getElementById('cartBadgeCount');
  if (!badge) return;
  const cart = JSON.parse(localStorage.getItem('umanarayani_cart') || '[]');
  const count = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
  badge.textContent = count;
  badge.style.display = count > 0 ? 'flex' : 'none';
}

function showToast(message) {
  let toast = document.getElementById('ayurToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ayurToast';
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(50px);
      background: #1B4332;
      color: #FFF;
      padding: 12px 24px;
      border-radius: 9999px;
      font-size: 0.9rem;
      font-weight: 600;
      box-shadow: 0 10px 30px rgba(0,0,0,0.25);
      border: 1px solid var(--gold-primary);
      z-index: 2000;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #2ECC71;"></i> <span>${escapeHtml(message)}</span>`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(50px)';
  }, 2800);
}

window.showToast = showToast;
window.updateCartBadge = updateCartBadge;
