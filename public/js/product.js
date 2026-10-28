/**
 * UMANARAYANI AYURVEDA — AMAZON-STYLE PRODUCT DETAIL PAGE SCRIPT
 * Features interactive image loupe zoom lens, delivery pincode calculator,
 * quantity selector, buy box, tabs navigation, reviews, and direct WhatsApp query.
 */

const WHATSAPP_NUMBER = "918641033514";

document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const productId = urlParams.get('id') || 'ayurvedic-hair-oil';

  loadProductDetails(productId);
  setupPincodeChecker();
  setupTabs();
  setupReviewForm(productId);
  updateCartBadge();
  setupActiveUsersTracker();
  checkUserState();
  setupSearch();
});

let currentProduct = null;

async function loadProductDetails(productId) {
  try {
    const res = await fetch(`/api/products/${productId}`);
    const data = await res.json();

    if (!data.success || !data.product) {
      document.getElementById('productDetailContainer').innerHTML = `
        <div style="text-align: center; padding: 60px;">
          <h2>Product not found</h2>
          <p><a href="index.html" style="color: #2D6A4F; text-decoration: underline;">Return to Umanarayani Homepage</a></p>
        </div>
      `;
      return;
    }

    currentProduct = data.product;
    renderProductPage(currentProduct);
    loadReviews(productId);
  } catch (err) {
    console.error("Error loading product:", err);
  }
}

function renderProductPage(p) {
  // Page Title
  document.title = `${p.name} — Umanarayani Ayurveda`;

  // Breadcrumbs
  document.getElementById('breadcrumbCategory').textContent = p.category;
  document.getElementById('breadcrumbProduct').textContent = p.name;

  // Title & Subtitle
  document.getElementById('productTitle').textContent = p.name;
  document.getElementById('productSubtitle').textContent = p.subtitle || '';

  // Rating Stars
  const starsHtml = '★'.repeat(Math.floor(p.rating)) + (p.rating % 1 !== 0 ? '½' : '');
  document.getElementById('starRatingText').textContent = p.rating;
  document.getElementById('starsContainer').textContent = starsHtml;
  document.getElementById('ratingsCountLink').textContent = `${p.ratingCount || 100} ratings`;

  // Price & MRP
  document.getElementById('dealDiscount').textContent = `-${p.discountPercent}%`;
  document.getElementById('dealPrice').textContent = p.price;
  document.getElementById('mrpPrice').textContent = `₹${p.mrp}`;
  document.getElementById('savingsAmount').textContent = `₹${p.mrp - p.price} (${p.discountPercent}%)`;
  document.getElementById('buyBoxPrice').textContent = `₹${p.price}.00`;

  // Gallery
  const mainImg = document.getElementById('mainStageImg');
  mainImg.src = p.image;
  mainImg.alt = p.name;

  const thumbsCol = document.getElementById('galleryThumbsCol');
  const galleryImgs = p.gallery && p.gallery.length ? p.gallery : [p.image];
  thumbsCol.innerHTML = galleryImgs.map((img, idx) => `
    <div class="thumb-item ${idx === 0 ? 'active' : ''}" onclick="switchGalleryImage('${img}', this)">
      <img src="${img}" alt="${p.name} view ${idx + 1}">
    </div>
  `).join('');

  // Setup Loupe Magnifier
  setupImageZoom(p.image);

  // Bullet Points (About this item)
  const bulletsList = document.getElementById('aboutItemBullets');
  const benefits = p.keyBenefits || [];
  bulletsList.innerHTML = benefits.map(b => `<li>${b}</li>`).join('') + `
    <li><strong>Volume:</strong> ${p.volume || '200 ml'}</li>
    <li><strong>Authentic Guarantee:</strong> Crafted with pure natural Ayurvedic botanicals, free from parabens, mineral oils, and harsh chemicals.</li>
  `;

  // Specs Table
  document.getElementById('specVolume').textContent = p.volume || '200 ml';
  document.getElementById('specCategory').textContent = p.category;
  document.getElementById('specAsin').textContent = p.asin || 'B09AYURV01';

  // Tabs Content
  document.getElementById('tabOverviewText').textContent = p.description || p.shortDescription;

  // Key Benefits Tab
  const benefitsGrid = document.getElementById('tabBenefitsList');
  benefitsGrid.innerHTML = benefits.map(b => `
    <li style="display:flex; align-items:flex-start; gap:10px; margin-bottom:12px; font-size:0.95rem;">
      <i class="fa-solid fa-circle-check" style="color:#2D6A4F; font-size:1.1rem; margin-top:2px;"></i>
      <span>${b}</span>
    </li>
  `).join('');

  // Ingredients Tab
  const ingredientsGrid = document.getElementById('tabIngredientsGrid');
  const ingDetails = p.ingredientsDetails || (p.featuredIngredients || []).map(name => ({
    name,
    role: "Herbal Botanical Active",
    description: "Traditional botanical active revered in classical Ayurveda."
  }));

  ingredientsGrid.innerHTML = ingDetails.map(ing => `
    <div class="ingredient-detail-card">
      <h4 class="ing-name">🌿 ${ing.name}</h4>
      <div class="ing-role">${ing.role}</div>
      <p class="ing-desc">${ing.description}</p>
    </div>
  `).join('');

  // How to Use Tab (Numbered Steps)
  const stepsContainer = document.getElementById('tabUsageSteps');
  const usageSteps = p.usageSteps || [
    { step: 1, title: "Apply", text: p.howToUse || "Apply evenly on scalp/skin." }
  ];

  stepsContainer.innerHTML = usageSteps.map(s => `
    <div class="usage-step-card">
      <div class="step-num-pill">${s.step}</div>
      <h4 class="step-title">${s.title}</h4>
      <p class="step-desc">${s.text}</p>
    </div>
  `).join('');

  // Suitable For
  document.getElementById('tabSuitableFor').textContent = p.suitableFor || "Suitable for all regular personal care routines.";

  // Certifications list
  const certsList = document.getElementById('tabCertifications');
  certsList.innerHTML = (p.certifications || [
    "100% Ayurvedic Formula",
    "Cruelty Free",
    "Paraben Free",
    "Dermatologically Tested"
  ]).map(c => `<span class="trust-chip"><i class="fa-solid fa-shield-halved" style="color:var(--green-sage);"></i> ${c}</span>`).join('');

  // Buy Box Buttons
  const cartBtn = document.getElementById('btnAddToCart');
  const buyNowBtn = document.getElementById('btnBuyNow');
  const waBtn = document.getElementById('btnWhatsAppInquiry');

  cartBtn.onclick = () => handleAddToCart(p);
  buyNowBtn.onclick = () => handleBuyNow(p);

  // Dedicated WhatsApp Inquiry with context-aware message
  const waMessage = `Hello Umanarayani! I have a question regarding *${p.name}* (Price: ₹${p.price}). Could you please guide me on this product?`;
  waBtn.onclick = () => {
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;
    window.open(url, '_blank');
  };

  const tabAiWa = document.getElementById('tabAiSupportWaBtn');
  if (tabAiWa) {
    tabAiWa.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`;
  }

  // Sticky Mobile Bar
  const mobPrice = document.getElementById('mobStickyPrice');
  if (mobPrice) mobPrice.textContent = `₹${p.price}`;
  const mobCart = document.getElementById('mobStickyCart');
  if (mobCart) mobCart.onclick = () => handleAddToCart(p);
  const mobWa = document.getElementById('mobStickyWa');
  if (mobWa) mobWa.onclick = () => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waMessage)}`, '_blank');
  };
}

/* ==========================================================================
   IMAGE GALLERY & INTERACTIVE MAGNIFIER ZOOM LENS (AMAZON LOUPE)
   ========================================================================== */
function switchGalleryImage(imgSrc, thumbEl) {
  document.querySelectorAll('.thumb-item').forEach(t => t.classList.remove('active'));
  thumbEl.classList.add('active');

  const mainImg = document.getElementById('mainStageImg');
  mainImg.src = imgSrc;
  setupImageZoom(imgSrc);
}

function setupImageZoom(imgSrc) {
  const stage = document.getElementById('mainImageStage');
  const img = document.getElementById('mainStageImg');
  const lens = document.getElementById('zoomLens');
  const result = document.getElementById('zoomResultWindow');

  if (!stage || !img || !lens || !result) return;

  // Set background of zoom window to image
  result.style.backgroundImage = `url('${imgSrc}')`;

  stage.onmouseenter = () => {
    if (window.innerWidth > 1080) {
      lens.style.display = 'block';
      result.style.display = 'block';
    }
  };

  stage.onmouseleave = () => {
    lens.style.display = 'none';
    result.style.display = 'none';
  };

  stage.onmousemove = (e) => {
    if (window.innerWidth <= 1080) return;

    const rect = stage.getBoundingClientRect();
    const x = e.clientX - rect.left - (lens.offsetWidth / 2);
    const y = e.clientY - rect.top - (lens.offsetHeight / 2);

    const maxX = stage.offsetWidth - lens.offsetWidth;
    const maxY = stage.offsetHeight - lens.offsetHeight;

    const boundedX = Math.max(0, Math.min(x, maxX));
    const boundedY = Math.max(0, Math.min(y, maxY));

    lens.style.left = `${boundedX}px`;
    lens.style.top = `${boundedY}px`;

    // Zoom factor: 2.5x
    const cx = result.offsetWidth / lens.offsetWidth;
    const cy = result.offsetHeight / lens.offsetHeight;

    result.style.backgroundSize = `${stage.offsetWidth * cx}px ${stage.offsetHeight * cy}px`;
    result.style.backgroundPosition = `-${boundedX * cx}px -${boundedY * cy}px`;
  };
}

/* ==========================================================================
   DELIVERY PINCODE CHECKER
   ========================================================================== */
function setupPincodeChecker() {
  const btn = document.getElementById('btnCheckPincode');
  const input = document.getElementById('pincodeInput');
  const resultMsg = document.getElementById('pincodeResultMsg');

  if (!btn || !input) return;

  btn.addEventListener('click', () => {
    const code = input.value.trim();
    if (!/^\d{6}$/.test(code)) {
      resultMsg.innerHTML = `<span style="color:#C7511F;">Please enter a valid 6-digit Indian PIN code.</span>`;
      return;
    }

    // Delivery calculation
    const daysToAdd = code.startsWith('11') || code.startsWith('20') ? 2 : 3;
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + daysToAdd);
    const dateStr = deliveryDate.toLocaleDateString('en-IN', { weekday: 'long', month: 'short', day: 'numeric' });

    resultMsg.innerHTML = `
      <span style="color: #007600; font-weight: 700;">✓ In Stock for PIN ${code}</span><br>
      <span>FREE Delivery by <strong>${dateStr}</strong>. Order within 3 hrs.</span>
    `;
  });
}

/* ==========================================================================
   TABS SWITCHER
   ========================================================================== */
function setupTabs() {
  const tabs = document.querySelectorAll('.product-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content-panel').forEach(p => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPanel = document.getElementById(tab.getAttribute('data-target'));
      if (targetPanel) targetPanel.classList.add('active');
    });
  });
}

/* ==========================================================================
   CART & BUY NOW HANDLERS
   ========================================================================== */
function handleAddToCart(product) {
  const qtySelect = document.getElementById('buyBoxQty');
  const qty = qtySelect ? parseInt(qtySelect.value, 10) : 1;

  let cart = JSON.parse(localStorage.getItem('umanarayani_cart') || '[]');
  const existingIdx = cart.findIndex(item => item.id === product.id);

  if (existingIdx > -1) {
    cart[existingIdx].quantity += qty;
  } else {
    cart.push({
      id: product.id,
      name: product.name,
      price: product.price,
      mrp: product.mrp,
      image: product.image,
      volume: product.volume,
      quantity: qty
    });
  }

  localStorage.setItem('umanarayani_cart', JSON.stringify(cart));
  updateCartBadge();
  showToast(`Added ${qty} item(s) of ${product.name} to cart! 🌿`);
}

function handleBuyNow(product) {
  handleAddToCart(product);
  window.location.href = 'cart.html';
}

/* ==========================================================================
   CUSTOMER REVIEWS & RATING SUBMISSION
   ========================================================================== */
async function loadReviews(productId) {
  const container = document.getElementById('customerReviewsContainer');
  if (!container) return;

  try {
    const res = await fetch(`/api/reviews/${productId}`);
    const data = await res.json();

    if (data.success && data.reviews && data.reviews.length) {
      container.innerHTML = data.reviews.map(r => `
        <div class="customer-review-item">
          <div class="review-author-line">
            <div class="review-avatar-circ">${r.author.charAt(0)}</div>
            <span class="review-author-name">${r.author}</span>
            ${r.verifiedPurchase ? '<span class="review-badge-verified">✓ Verified Purchase</span>' : ''}
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="color:#FFA41C; font-size:0.9rem;">${'★'.repeat(r.rating)}</span>
            <span class="review-title-bold">${r.title}</span>
          </div>
          <div style="font-size:0.75rem; color:#565959; margin-bottom:6px;">Reviewed in ${r.location || 'India'} on ${r.date}</div>
          <p class="review-text-content">${r.body}</p>
        </div>
      `).join('');
    } else {
      container.innerHTML = `<p style="color:#565959; font-size:0.9rem;">No reviews yet. Be the first to review this Ayurvedic preparation!</p>`;
    }
  } catch (err) {
    console.error("Error loading reviews:", err);
  }
}

function setupReviewForm(productId) {
  const form = document.getElementById('newReviewForm');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const author = document.getElementById('reviewAuthor').value.trim();
    const rating = document.getElementById('reviewRating').value;
    const title = document.getElementById('reviewTitle').value.trim();
    const body = document.getElementById('reviewBody').value.trim();

    if (!author || !body) {
      alert("Please enter your name and review thoughts.");
      return;
    }

    try {
      const res = await fetch(`/api/reviews/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author, rating, title, body })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Review submitted successfully! Dhanyavaad 🌿");
        form.reset();
        loadReviews(productId);
      }
    } catch (err) {
      console.error("Error submitting review:", err);
    }
  });
}

function getClientSessionId() {
  let sid = sessionStorage.getItem('umanarayani_session_id');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now();
    sessionStorage.setItem('umanarayani_session_id', sid);
  }
  return sid;
}

function setupActiveUsersTracker() {
  const el = document.getElementById('liveUsersCount');
  if (!el) return;

  const sessionId = getClientSessionId();

  if (window.EventSource) {
    try {
      const evtSource = new EventSource(`/api/users/stream?sessionId=${encodeURIComponent(sessionId)}`);
      evtSource.onmessage = function(e) {
        try {
          const data = JSON.parse(e.data);
          if (data && typeof data.activeUsers === 'number') {
            el.textContent = data.activeUsers;
          }
        } catch (err) {}
      };
      evtSource.onerror = function() {
        evtSource.close();
        pollActiveUsers(el, sessionId);
      };
      return;
    } catch (e) {
      pollActiveUsers(el, sessionId);
    }
  } else {
    pollActiveUsers(el, sessionId);
  }
}

function pollActiveUsers(el, sessionId) {
  const fetchCount = async () => {
    try {
      const res = await fetch(`/api/users/active?sessionId=${encodeURIComponent(sessionId)}`);
      const data = await res.json();
      if (data && data.success && typeof data.activeUsers === 'number') {
        el.textContent = data.activeUsers;
      }
    } catch (e) {}
  };
  fetchCount();
  setInterval(fetchCount, 5000);
}

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
      border: 1px solid #C5A059;
      z-index: 2000;
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    document.body.appendChild(toast);
  }

  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #2ECC71;"></i> ${message}`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateX(-50%) translateY(0)';

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(50px)';
  }, 2800);
}

// Smart Back Navigation Helper
window.handleSmartBack = function(event) {
  if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
    if (event) event.preventDefault();
    window.history.back();
    return;
  }
};

/* ==========================================================================
   USER AUTH STATE & HEADER SYNCHRONIZATION
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
    signinBtn.title = `${user.name} (${user.dosha || 'Ayurvedic Profile'}) — View sanctuary profile / logout`;
    signinBtn.classList.add('logged-in');
  } else {
    signinBtn.innerHTML = `<i class="fa-regular fa-user"></i> <span>Sign In</span>`;
    signinBtn.href = "signin.html";
    signinBtn.title = "Sign In / Register";
    signinBtn.classList.remove('logged-in');
  }

  // Auto-fill review author if present
  const reviewAuthor = document.getElementById('reviewAuthor');
  if (reviewAuthor && user && user.name && !reviewAuthor.value) {
    reviewAuthor.value = user.name;
  }
}

/* ==========================================================================
   PRODUCT SEARCH & INSTANT AUTOCOMPLETE DROPDOWN
   ========================================================================== */
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
      return;
    }

    debounceTimer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products?search=${encodeURIComponent(q)}`);
        const data = await res.json();
        const products = (data && data.success && data.products) ? data.products : [];
        renderSearchDropdown(products, q);
      } catch (err) {
        console.error("Product search error:", err);
      }
    }, 220);
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
        window.location.href = `index.html?search=${encodeURIComponent(q)}`;
      }
    } else if (e.key === 'Escape') {
      if (dropdown) dropdown.style.display = 'none';
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      if (dropdown) dropdown.style.display = 'none';
      input.focus();
    });
  }

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
      <img src="${p.image}" class="search-item-thumb" alt="${escapeHtml(p.name)}">
      <div class="search-item-info">
        <span class="search-item-name">${highlightMatch(p.name, query)}</span>
        <div class="search-item-cat">
          <span>🌿 ${p.category}</span>
          <span>&bull;</span>
          <span>★ ${p.rating}</span>
        </div>
      </div>
      <div class="search-item-price">₹${p.price}</div>
    </a>
  `).join('');

  dropdown.innerHTML = `
    <div class="search-dropdown-header">
      <span>Matching Ayurvedic Formulations</span>
      <span style="color:var(--gold-deep);">${products.length} found</span>
    </div>
    ${itemsHtml}
    <div class="search-dropdown-footer" onclick="window.location.href='index.html?search=${encodeURIComponent(query)}#productsSection'">
      View all in product catalog &rarr;
    </div>
  `;
  dropdown.style.display = 'block';
}

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
