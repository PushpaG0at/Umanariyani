/**
 * UMANARAYNI AYURVEDA — ADMIN DASHBOARD CONTROLLER (CSP COMPLIANT)
 * 
 * Strict Content Security Policy compliant:
 * - Zero inline script executions (script-src 'self' without 'unsafe-inline')
 * - Zero inline event attributes (script-src-attr 'none')
 * - Clean event delegation on data-action attributes
 * - Dynamic admin user email resolution via /api/auth/me
 */

// Global State Caches
let catalogProductsCache = [];
let reconcileOrdersCache = {};
let currentEditingGallery = [];
let isSettingUpTotp = false;

// Strict HTML escaping utility for XSS defense
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showAlert(msg, isSuccess = true) {
  const el = document.getElementById('globalAdminAlert');
  if (!el) return;
  el.className = `admin-alert ${isSuccess ? 'success' : 'error'}`;
  el.innerHTML = isSuccess 
    ? `<i class="fa-solid fa-circle-check"></i> ${msg}`
    : `<i class="fa-solid fa-triangle-exclamation"></i> ${msg}`;
  el.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => {
    el.style.display = 'none';
  }, 6000);
}

function showAdminLoginModal() {
  const modal = document.getElementById('adminLoginModal');
  if (modal) modal.style.display = 'flex';
}

function hideAdminLoginModal() {
  const modal = document.getElementById('adminLoginModal');
  if (modal) modal.style.display = 'none';
}

function showAdminLoginAlert(msg, isSuccess = false) {
  const el = document.getElementById('adminLoginAlert');
  if (!el) return;
  el.style.display = 'block';
  el.style.background = isSuccess ? '#D1FAE5' : '#FEE2E2';
  el.style.color = isSuccess ? '#065F46' : '#991B1B';
  el.style.border = `1px solid ${isSuccess ? '#6EE7B7' : '#FCA5A5'}`;
  el.textContent = msg;
}

/**
 * 1. Admin Session Verification & Dynamic Email Display
 * Queries /api/auth/me and updates #currentAdminEmail in the top navbar.
 */
async function verifyAdminAuth() {
  const emailSpan = document.getElementById('currentAdminEmail');
  const legacyEmailSpan = document.getElementById('adminUserEmail');
  const nameEl = document.getElementById('adminUserName');

  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    const data = await res.json();

    if (!data || !data.authenticated || !data.user || data.user.role !== 'admin') {
      if (emailSpan) emailSpan.textContent = 'Session Error';
      if (legacyEmailSpan) legacyEmailSpan.textContent = 'Session Error';
      showAdminLoginModal();
      return false;
    }

    const adminEmail = data.user.email || 'Unknown';
    if (emailSpan) emailSpan.textContent = adminEmail;
    if (legacyEmailSpan) legacyEmailSpan.textContent = adminEmail;
    if (nameEl) nameEl.textContent = data.user.name || 'Admin';

    hideAdminLoginModal();
    return true;
  } catch (err) {
    if (emailSpan) emailSpan.textContent = 'Session Error';
    if (legacyEmailSpan) legacyEmailSpan.textContent = 'Session Error';
    showAdminLoginModal();
    return false;
  }
}

/**
 * 2. Render Media Preview Items
 */
function renderFilesPreview(files, containerEl) {
  if (!containerEl) return;
  containerEl.innerHTML = '';
  if (!files || files.length === 0) return;

  Array.from(files).forEach(file => {
    const item = document.createElement('div');
    item.className = 'media-preview-item';
    const url = URL.createObjectURL(file);

    if (file.type.startsWith('video/')) {
      item.innerHTML = `
        <video src="${url}" muted autoplay loop playsinline></video>
        <span class="badge-type"><i class="fa-solid fa-video"></i> Video</span>
      `;
    } else {
      item.innerHTML = `
        <img src="${url}" alt="${escapeHtml(file.name)}">
        <span class="badge-type"><i class="fa-solid fa-image"></i> Image</span>
      `;
    }
    containerEl.appendChild(item);
  });
}

function updateMediaUploadLabels() {
  const radioMediaReplace = document.getElementById('radioMediaReplace');
  const editUploadMainText = document.getElementById('editUploadMainText');
  const editUploadSubText = document.getElementById('editUploadSubText');
  const editUploadIcon = document.getElementById('editUploadIcon');

  if (!editUploadMainText) return;
  if (radioMediaReplace && radioMediaReplace.checked) {
    editUploadMainText.innerHTML = '<strong>Click to select new files</strong> to REPLACE all media';
    editUploadSubText.textContent = '(Existing photos and videos will be completely replaced by these new files)';
    if (editUploadIcon) editUploadIcon.className = 'fa-solid fa-arrows-rotate file-upload-icon';
  } else {
    editUploadMainText.innerHTML = '<strong>Click to select new images or videos</strong> to ADD to this product';
    editUploadSubText.textContent = '(New files will be appended to your current gallery)';
    if (editUploadIcon) editUploadIcon.className = 'fa-solid fa-cloud-arrow-up file-upload-icon';
  }
}

function renderCurrentEditingGallery() {
  const currentMediaEl = document.getElementById('editCurrentMediaPreview');
  const countEl = document.getElementById('editCurrentMediaCount');
  if (countEl) countEl.textContent = currentEditingGallery.length;
  if (!currentMediaEl) return;
  currentMediaEl.innerHTML = '';

  if (currentEditingGallery.length === 0) {
    currentMediaEl.innerHTML = `<span style="font-size:0.85rem; color:#888; font-style:italic;">No media currently saved. Choose files below to add media.</span>`;
    return;
  }

  currentEditingGallery.forEach((mUrl, index) => {
    if (!mUrl) return;
    const item = document.createElement('div');
    item.className = 'media-preview-item';
    const isVid = mUrl.endsWith('.mp4') || mUrl.endsWith('.webm') || mUrl.endsWith('.mov');
    
    // CSP-compliant: uses data-action instead of inline onclick
    item.innerHTML = `
      <button type="button" class="btn-remove-media" title="Delete this asset from product" data-action="remove-media" data-index="${index}">&times;</button>
      ${isVid 
        ? `<video src="${escapeHtml(mUrl)}" muted autoplay loop playsinline></video><span class="badge-type"><i class="fa-solid fa-video"></i> Video</span>`
        : `<img src="${escapeHtml(mUrl)}" alt="Product media ${index + 1}"><span class="badge-type"><i class="fa-solid fa-image"></i> Image</span>`
      }
    `;
    currentMediaEl.appendChild(item);
  });
}

function removeExistingMedia(idx) {
  if (idx >= 0 && idx < currentEditingGallery.length) {
    currentEditingGallery.splice(idx, 1);
    renderCurrentEditingGallery();
  }
}

/**
 * 3. Fetch and Render Catalog Table
 */
async function loadCatalogProducts() {
  const tbody = document.getElementById('productsTableBody');
  const badge = document.getElementById('productCountBadge');
  if (!tbody) return;

  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    const products = data.products || [];
    catalogProductsCache = products;

    if (badge) badge.textContent = `${products.length} Products in Database`;

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:#888;">No products found in database.</td></tr>`;
      return;
    }

    tbody.innerHTML = products.map(p => {
      const herbs = (p.featuredIngredients || []).slice(0, 3).join(', ');
      const extraHerbs = (p.featuredIngredients || []).length > 3 ? '...' : '';
      return `
        <tr id="prod-row-${p.id}">
          <td>
            <div class="prod-cell-main">
              <img src="${escapeHtml(p.image) || "/images/logo-center.png"}" alt="${escapeHtml(p.name)}" class="prod-thumb">
              <div>
                <div class="prod-info-title">${escapeHtml(p.name)}</div>
                <div class="prod-info-subtitle">${escapeHtml(p.subtitle || p.shortDescription || '')}</div>
              </div>
            </div>
          </td>
          <td>
            <span class="category-tag">${escapeHtml(p.category || 'General')}</span>
            <div style="font-size:0.75rem; color:#888; margin-top:2px;">${escapeHtml(p.volume || '')}</div>
          </td>
          <td>
            <span class="price-tag">₹${escapeHtml(p.price)}</span>
            ${p.mrp ? `<span class="mrp-cross">₹${escapeHtml(p.mrp)}</span>` : ''}
          </td>
          <td style="font-size:0.82rem; color:var(--text-muted);">
            ${escapeHtml(herbs + extraHerbs) || 'Classical herbs'}
          </td>
          <td style="text-align: right; white-space: nowrap;">
            <button type="button" class="btn-edit-prod" data-action="edit-product" data-id="${escapeHtml(p.id)}">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button type="button" class="btn-delete-prod" data-action="delete-product" data-id="${escapeHtml(p.id)}" data-name="${escapeHtml(p.name)}">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:24px; color:var(--danger-red);">Error loading catalog products.</td></tr>`;
  }
}

function openEditProductModal(id) {
  const p = catalogProductsCache.find(item => String(item.id) === String(id));
  if (!p) {
    showAlert('Could not locate product record in memory. Refreshing catalog...', false);
    loadCatalogProducts();
    return;
  }

  const editFileInput = document.getElementById('editMediaFiles');
  const editPreviewContainer = document.getElementById('editNewMediaPreview');
  const radioMediaAdd = document.getElementById('radioMediaAdd');

  document.getElementById('editPId').value = p.id;
  document.getElementById('editPName').value = p.name || '';
  document.getElementById('editPSubtitle').value = p.subtitle || '';
  document.getElementById('editPCategory').value = p.category || 'Hair Care';
  document.getElementById('editPVolume').value = p.volume || '';
  document.getElementById('editPPrice').value = p.price || '';
  document.getElementById('editPMrp').value = p.mrp || '';
  document.getElementById('editPInStock').value = p.inStock ? 'true' : 'false';
  document.getElementById('editPStockCount').value = p.stockCount !== undefined ? p.stockCount : 50;
  document.getElementById('editPShortDesc').value = p.shortDescription || '';
  document.getElementById('editPDescription').value = p.description || '';
  
  const benefitsArr = Array.isArray(p.keyBenefits) ? p.keyBenefits : [];
  document.getElementById('editPBenefits').value = benefitsArr.join('\n');

  const ingArr = Array.isArray(p.featuredIngredients) ? p.featuredIngredients : [];
  document.getElementById('editPIngredients').value = ingArr.join(', ');

  document.getElementById('editPHowToUse').value = p.howToUse || '';
  document.getElementById('editPSuitableFor').value = p.suitableFor || '';

  // Render current media previews with deletion capability
  currentEditingGallery = Array.isArray(p.gallery) && p.gallery.length > 0 ? [...p.gallery] : [p.image || '/images/logo-center.png'];
  renderCurrentEditingGallery();

  // Reset radio option to 'add' by default
  if (radioMediaAdd) radioMediaAdd.checked = true;
  updateMediaUploadLabels();

  // Clear newly chosen files in modal
  if (editFileInput) editFileInput.value = '';
  if (editPreviewContainer) editPreviewContainer.innerHTML = '';

  const modal = document.getElementById('editProductModal');
  if (modal) modal.style.display = 'flex';
}

function closeEditProductModal() {
  const modal = document.getElementById('editProductModal');
  if (modal) modal.style.display = 'none';
}

async function handleDeleteProduct(id, name) {
  if (!confirm(`Are you sure you want to remove "${name}" from the store catalog? This action will immediately remove it from the live store.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    const data = await res.json();

    if (data.success) {
      showAlert(`"${name}" has been removed from the catalog.`, true);
      loadCatalogProducts();
    } else {
      showAlert(data.message || 'Failed to delete product', false);
    }
  } catch (err) {
    showAlert('Network or server error while deleting product.', false);
  }
}

/**
 * 4. UPI / UTR Reconciliation Functions
 */
async function loadPendingUtrOrders() {
  const tbody = document.getElementById('reconcileTableBody');
  const badge = document.getElementById('reconcileCountBadge');
  if (!tbody || !badge) return;

  try {
    const res = await fetch('/api/admin/reconciliation/pending-utr', { credentials: 'include' });
    const data = await res.json();
    const orders = data.orders || [];

    badge.textContent = `${orders.length} Pending`;
    if (orders.length > 0) {
      badge.style.background = '#FEE2E2';
      badge.style.color = '#991B1B';
      badge.style.borderColor = '#FCA5A5';
    } else {
      badge.style.background = '#D8F3DC';
      badge.style.color = '#1B4332';
      badge.style.borderColor = '#74C69D';
    }

    if (orders.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#888;"><i class="fa-solid fa-circle-check" style="color:#2D6A4F;"></i> All manual UPI payments have been reconciled. No orders awaiting verification.</td></tr>`;
      return;
    }

    reconcileOrdersCache = {};
    tbody.innerHTML = orders.map(o => {
      reconcileOrdersCache[o.id] = o;
      const ageText = o.ageMinutes !== undefined
        ? (o.ageMinutes < 60 ? `${o.ageMinutes}m ago` : `${Math.floor(o.ageMinutes / 60)}h ${o.ageMinutes % 60}m ago`)
        : 'Pending';

      const addr = o.shipping_address_json || {};
      const addressLine1 = addr.addressLine1 || o.shippingAddress || 'Address details in notes';
      const cityStatePin = (addr.city && addr.state) ? `${addr.city}, ${addr.state} - ${addr.pincode}` : (o.city ? `${o.city}, ${o.state || ''} - ${o.pincode || ''}` : '');

      return `
        <tr id="reconcile-row-${o.id}">
          <td><strong>#${escapeHtml(String(o.id))}</strong></td>
          <td>
            <div style="font-weight:700; color:#1B4332; font-size:0.95rem;">${escapeHtml(o.customerName || 'Customer')}</div>
            <div style="font-size:0.8rem; color:#4B5563; margin-bottom:4px;">
              <i class="fa-solid fa-phone" style="font-size:0.75rem;"></i> +91 ${escapeHtml(o.customerPhone || '')} &bull; ${escapeHtml(o.customerEmail || '')}
            </div>
            <div style="font-size:0.82rem; color:#1F2937; background:#F8FAF8; border:1px solid #E2E8F0; padding:6px 10px; border-radius:6px; margin:4px 0; line-height:1.4;">
              <i class="fa-solid fa-location-dot" style="color:#2D6A4F; font-size:0.75rem;"></i>
              <span>${escapeHtml(addressLine1)}${addr.addressLine2 ? ', ' + escapeHtml(addr.addressLine2) : ''}${addr.landmark ? ' (Near ' + escapeHtml(addr.landmark) + ')' : ''}</span><br>
              <strong>${escapeHtml(cityStatePin || o.shippingAddress || '')}</strong>
            </div>
            <div style="display:flex; gap:8px; margin-top:6px;">
              <button type="button" class="btn-copy-addr" id="copy-btn-${o.id}" data-action="copy-address" data-id="${o.id}">
                <i class="fa-regular fa-copy"></i> Copy Address
              </button>
              <button type="button" class="btn-print-label" data-action="print-label" data-id="${o.id}">
                <i class="fa-solid fa-print"></i> Shipping Label
              </button>
            </div>
          </td>
          <td><span class="price-tag">₹${escapeHtml(String(o.total || 0))}</span></td>
          <td><code style="background:#F3F4F6; padding:3px 8px; border-radius:4px; font-weight:700; color:#1F2937;">${escapeHtml(o.transactionId || 'None')}</code></td>
          <td><span style="font-size:0.82rem; color:#6B7280;">${ageText}</span></td>
          <td style="text-align: right;">
            <button type="button" class="btn-approve-utr" data-action="reconcile-approve" data-id="${o.id}">
              <i class="fa-solid fa-check"></i> Approve
            </button>
            <button type="button" class="btn-reject-utr" data-action="reconcile-reject" data-id="${o.id}">
              <i class="fa-solid fa-xmark"></i> Reject
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:24px; color:#DC2626;">Error fetching pending reconciliation orders.</td></tr>`;
  }
}

function copyShippingAddress(orderId) {
  const o = reconcileOrdersCache[orderId];
  if (!o) return;
  const addr = o.shipping_address_json || {};
  const name = addr.fullName || o.customerName || 'Customer';
  const phone = addr.phone || o.customerPhone || '';
  const line1 = addr.addressLine1 || o.shippingAddress || '';
  const line2 = addr.addressLine2 ? `\nArea/Colony: ${addr.addressLine2}` : '';
  const landmark = addr.landmark ? `\nLandmark: Near ${addr.landmark}` : '';
  const city = addr.city || o.city || '';
  const state = addr.state || o.state || '';
  const pin = addr.pincode || o.pincode || '';

  const fullText = `Name: ${name}\nMobile: +91 ${phone}\nAddress: ${line1}${line2}${landmark}\nCity/State: ${city}, ${state} - ${pin}`;
  navigator.clipboard.writeText(fullText).then(() => {
    const btn = document.getElementById(`copy-btn-${orderId}`);
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = `<i class="fa-solid fa-check"></i> Copied!`;
      btn.style.background = '#DCFCE7';
      btn.style.color = '#15803D';
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.style.background = '';
        btn.style.color = '';
      }, 2000);
    }
  }).catch(() => {
    prompt('Copy address text below:', fullText);
  });
}

function openShippingLabelModal(orderId) {
  const o = reconcileOrdersCache[orderId];
  if (!o) return;
  const addr = o.shipping_address_json || {};
  const name = addr.fullName || o.customerName || 'Customer';
  const phone = addr.phone || o.customerPhone || '';
  const line1 = addr.addressLine1 || o.shippingAddress || '';
  const line2 = addr.addressLine2 ? `, ${addr.addressLine2}` : '';
  const landmark = addr.landmark ? ` (Near ${addr.landmark})` : '';
  const city = addr.city || o.city || '';
  const state = addr.state || o.state || '';
  const pin = addr.pincode || o.pincode || '000000';

  const orderIdEl = document.getElementById('labelOrderId');
  const dateEl = document.getElementById('labelOrderDate');
  const amountEl = document.getElementById('labelOrderAmount');
  const nameEl = document.getElementById('labelCustomerName');
  const phoneEl = document.getElementById('labelCustomerPhone');
  const addrEl = document.getElementById('labelFullAddress');
  const pinEl = document.getElementById('labelPincode');

  if (orderIdEl) orderIdEl.textContent = `#${o.id}`;
  if (dateEl) dateEl.textContent = new Date(o.createdAt || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  if (amountEl) amountEl.textContent = `₹${o.total || 0}`;
  if (nameEl) nameEl.textContent = name;
  if (phoneEl) phoneEl.textContent = `Phone: +91 ${phone}`;
  if (addrEl) addrEl.textContent = `${line1}${line2}${landmark}, ${city}, ${state}`;
  if (pinEl) pinEl.textContent = pin;

  const modal = document.getElementById('shippingLabelModal');
  if (modal) modal.style.display = 'flex';
}

function closeShippingLabelModal() {
  const modal = document.getElementById('shippingLabelModal');
  if (modal) modal.style.display = 'none';
}

async function reconcileUtrOrder(orderId, action) {
  let reason = '';
  if (action === 'reject') {
    reason = prompt('Please enter the reason for rejecting this UTR (e.g. UTR not found on bank statement, amount mismatch):');
    if (reason === null) return;
    if (!reason.trim()) {
      alert('A rejection reason is required.');
      return;
    }
  } else {
    if (!confirm(`Are you sure you want to approve Order #${orderId} and mark payment as verified?`)) {
      return;
    }
  }

  try {
    const res = await fetch(`/api/admin/reconciliation/${orderId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, reason: reason ? reason.trim() : undefined })
    });
    const data = await res.json();
    if (data.success) {
      showAlert(`Order #${orderId} successfully ${action === 'approve' ? 'approved & confirmed' : 'rejected & stock restored'}!`, true);
      loadPendingUtrOrders();
    } else {
      showAlert(data.message || 'Failed to update order status', false);
    }
  } catch (err) {
    showAlert('Network error updating reconciliation status.', false);
  }
}

/**
 * Main Initialization and Event Listener Binding (DOMContentLoaded)
 */
function initAdmin() {
  // 1. Static Button Action Listeners
  const btnCloseShipping = document.getElementById('btnCloseShippingLabelModal');
  if (btnCloseShipping) btnCloseShipping.addEventListener('click', closeShippingLabelModal);

  const btnCancelShipping = document.getElementById('btnCancelShippingLabel');
  if (btnCancelShipping) btnCancelShipping.addEventListener('click', closeShippingLabelModal);

  const btnPrintShipping = document.getElementById('btnPrintShippingLabel');
  if (btnPrintShipping) btnPrintShipping.addEventListener('click', () => window.print());

  const btnCloseEdit = document.getElementById('btnCloseEditProductModal');
  if (btnCloseEdit) btnCloseEdit.addEventListener('click', closeEditProductModal);

  const btnCancelEdit = document.getElementById('btnCancelEditProduct');
  if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditProductModal);

  // Close modals on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const editModal = document.getElementById('editProductModal');
      if (editModal && editModal.style.display === 'flex') {
        closeEditProductModal();
      }
      const labelModal = document.getElementById('shippingLabelModal');
      if (labelModal && labelModal.style.display === 'flex') {
        closeShippingLabelModal();
      }
    }
  });

  // Sign out button
  const btnLogout = document.getElementById('btnAdminLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      } catch (_) {}
      localStorage.removeItem('umanarayani_user');
      window.location.replace('/');
    });
  }

  // 2. Event Delegation for Dynamic Table and Gallery Action Buttons
  document.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action]');
    if (!target) return;

    const action = target.getAttribute('data-action');
    const id = target.getAttribute('data-id');
    const name = target.getAttribute('data-name');
    const index = target.getAttribute('data-index');

    switch (action) {
      case 'edit-product':
        if (id) openEditProductModal(id);
        break;
      case 'delete-product':
        if (id) handleDeleteProduct(id, name || 'this product');
        break;
      case 'remove-media':
        if (index !== null) removeExistingMedia(parseInt(index, 10));
        break;
      case 'copy-address':
        if (id) copyShippingAddress(id);
        break;
      case 'print-label':
        if (id) openShippingLabelModal(id);
        break;
      case 'reconcile-approve':
        if (id) reconcileUtrOrder(id, 'approve');
        break;
      case 'reconcile-reject':
        if (id) reconcileUtrOrder(id, 'reject');
        break;
    }
  });

  // 3. Admin TOTP Login Form
  const adminLoginForm = document.getElementById('adminLoginForm');
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('adminLoginEmail').value.trim();
      const password = document.getElementById('adminLoginPassword').value;
      const totpToken = document.getElementById('adminLoginTotp').value.trim();
      const submitBtn = document.getElementById('btnAdminLoginSubmit');
      const origBtnHtml = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Authenticating with 2FA...`;

      try {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            email,
            password,
            totpToken: totpToken || undefined,
            setupConfirmed: isSettingUpTotp
          })
        });

        const data = await res.json();

        if (data.requireTotpSetup) {
          isSettingUpTotp = true;
          document.getElementById('adminTotpSetupBox').style.display = 'block';
          document.getElementById('adminSetupSecret').textContent = data.secret;
          showAdminLoginAlert(data.message, true);
          document.getElementById('adminLoginTotp').focus();
        } else if (data.requireTotp) {
          showAdminLoginAlert('Password verified. Enter your 6-digit Authenticator code to continue.', true);
          document.getElementById('adminLoginTotp').focus();
        } else if (data.success && data.user) {
          hideAdminLoginModal();
          showAlert(`Welcome, ${data.user.name}! Authenticated with TOTP 2FA.`, true);

          const emailSpan = document.getElementById('currentAdminEmail');
          const legacyEmailSpan = document.getElementById('adminUserEmail');
          const nameEl = document.getElementById('adminUserName');
          if (emailSpan) emailSpan.textContent = data.user.email || '';
          if (legacyEmailSpan) legacyEmailSpan.textContent = data.user.email || '';
          if (nameEl) nameEl.textContent = data.user.name || 'Admin';

          loadCatalogProducts();
          loadPendingUtrOrders();
        } else {
          showAdminLoginAlert(data.message || 'Authentication failed. Please verify credentials.');
        }
      } catch (err) {
        showAdminLoginAlert('Network error connecting to authentication server.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origBtnHtml;
      }
    });
  }

  // 4. Media Upload Listeners & Drag and Drop
  const addFileInput = document.getElementById('pImageFiles');
  const addPreviewContainer = document.getElementById('addMediaPreview');
  const addDropZone = document.getElementById('addDropZone');

  if (addFileInput && addPreviewContainer) {
    addFileInput.addEventListener('change', (e) => {
      renderFilesPreview(e.target.files, addPreviewContainer);
    });
  }

  if (addDropZone && addFileInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
      addDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        addDropZone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      addDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        addDropZone.classList.remove('dragover');
      });
    });
    addDropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        addFileInput.files = e.dataTransfer.files;
        renderFilesPreview(addFileInput.files, addPreviewContainer);
      }
    });
  }

  const editFileInput = document.getElementById('editMediaFiles');
  const editPreviewContainer = document.getElementById('editNewMediaPreview');
  const editDropZone = document.getElementById('editDropZone');
  const radioMediaAdd = document.getElementById('radioMediaAdd');
  const radioMediaReplace = document.getElementById('radioMediaReplace');

  if (radioMediaAdd) radioMediaAdd.addEventListener('change', updateMediaUploadLabels);
  if (radioMediaReplace) radioMediaReplace.addEventListener('change', updateMediaUploadLabels);

  if (editFileInput && editPreviewContainer) {
    editFileInput.addEventListener('change', (e) => {
      renderFilesPreview(e.target.files, editPreviewContainer);
    });
  }

  if (editDropZone && editFileInput) {
    ['dragenter', 'dragover'].forEach(eventName => {
      editDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        editDropZone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(eventName => {
      editDropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        editDropZone.classList.remove('dragover');
      });
    });
    editDropZone.addEventListener('drop', (e) => {
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        editFileInput.files = e.dataTransfer.files;
        renderFilesPreview(editFileInput.files, editPreviewContainer);
      }
    });
  }

  // 5. Submit Edit Product Form
  const editProductForm = document.getElementById('editProductForm');
  if (editProductForm) {
    editProductForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('editPId').value;
      const submitBtn = document.getElementById('btnSubmitEdit');
      const origHtml = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Updating Formulation...`;

      try {
        const formData = new FormData();
        formData.append('name', document.getElementById('editPName').value.trim());
        formData.append('subtitle', document.getElementById('editPSubtitle').value.trim());
        formData.append('category', document.getElementById('editPCategory').value);
        formData.append('volume', document.getElementById('editPVolume').value.trim());
        formData.append('price', document.getElementById('editPPrice').value);
        formData.append('mrp', document.getElementById('editPMrp').value || '');
        formData.append('inStock', document.getElementById('editPInStock').value);
        formData.append('stockCount', document.getElementById('editPStockCount').value || '50');
        formData.append('shortDescription', document.getElementById('editPShortDesc').value.trim());
        formData.append('description', document.getElementById('editPDescription').value.trim());

        const benefits = document.getElementById('editPBenefits').value.split('\n').map(s => s.trim()).filter(Boolean);
        formData.append('keyBenefits', JSON.stringify(benefits));

        const ingredients = document.getElementById('editPIngredients').value.split(',').map(s => s.trim()).filter(Boolean);
        formData.append('featuredIngredients', JSON.stringify(ingredients));

        formData.append('howToUse', document.getElementById('editPHowToUse').value.trim());
        formData.append('suitableFor', document.getElementById('editPSuitableFor').value.trim());

        const mediaAction = document.querySelector('input[name="editMediaAction"]:checked')?.value || 'add';
        formData.append('mediaAction', mediaAction);
        formData.append('existingGallery', JSON.stringify(currentEditingGallery));

        if (editFileInput && editFileInput.files.length > 0) {
          for (let i = 0; i < editFileInput.files.length; i++) {
            formData.append('media', editFileInput.files[i]);
          }
        }

        const res = await fetch(`/api/products/${encodeURIComponent(id)}`, {
          method: 'PUT',
          credentials: 'include',
          body: formData
        });

        const data = await res.json();
        if (data.success) {
          showAlert(`Success! Formulation for "${data.product.name}" has been updated in the database.`, true);
          closeEditProductModal();
          loadCatalogProducts();
        } else {
          showAlert(data.message || 'Failed to update formulation', false);
        }
      } catch (err) {
        showAlert('Network or server error while updating product.', false);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    });
  }

  // 6. Submit Add Product Form
  const addProductForm = document.getElementById('addProductForm');
  if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = document.getElementById('btnSubmitAdd');
      const origHtml = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading & Saving Formulation...`;

      try {
        const formData = new FormData();
        formData.append('name', document.getElementById('pName').value.trim());
        formData.append('subtitle', document.getElementById('pSubtitle').value.trim());
        formData.append('category', document.getElementById('pCategory').value);
        formData.append('volume', document.getElementById('pVolume').value.trim());
        formData.append('price', document.getElementById('pPrice').value);
        formData.append('mrp', document.getElementById('pMrp').value || '');
        formData.append('shortDescription', document.getElementById('pShortDesc').value.trim());
        formData.append('description', document.getElementById('pDescription').value.trim());

        const benefits = document.getElementById('pBenefits').value.split('\n').map(s => s.trim()).filter(Boolean);
        formData.append('keyBenefits', JSON.stringify(benefits));

        const ingredients = document.getElementById('pIngredients').value.split(',').map(s => s.trim()).filter(Boolean);
        formData.append('featuredIngredients', JSON.stringify(ingredients));

        formData.append('howToUse', document.getElementById('pHowToUse').value.trim());
        formData.append('suitableFor', document.getElementById('pSuitableFor').value.trim());

        if (addFileInput && addFileInput.files.length > 0) {
          for (let i = 0; i < addFileInput.files.length; i++) {
            formData.append('media', addFileInput.files[i]);
          }
        }

        const res = await fetch('/api/products', {
          method: 'POST',
          credentials: 'include',
          body: formData
        });

        const data = await res.json();

        if (data.success) {
          showAlert(`Success! "${data.product.name}" has been uploaded and launched to the store catalog!`, true);
          document.getElementById('addProductForm').reset();
          if (addPreviewContainer) addPreviewContainer.innerHTML = '';
          loadCatalogProducts();
        } else {
          showAlert(data.message || 'Failed to save product', false);
        }
      } catch (err) {
        showAlert('Network error saving formulation to server.', false);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = origHtml;
      }
    });
  }

  // 7. Initial Auth Check and Data Boot
  (async () => {
    const authorized = await verifyAdminAuth();
    if (authorized) {
      loadCatalogProducts();
      loadPendingUtrOrders();
    }
  })();
}

// Window function exposures for backward compatibility and testing
window.escapeHtml = escapeHtml;
window.showAlert = showAlert;
window.showAdminLoginModal = showAdminLoginModal;
window.hideAdminLoginModal = hideAdminLoginModal;
window.verifyAdminAuth = verifyAdminAuth;
window.loadCatalogProducts = loadCatalogProducts;
window.openEditProductModal = openEditProductModal;
window.closeEditProductModal = closeEditProductModal;
window.handleDeleteProduct = handleDeleteProduct;
window.loadPendingUtrOrders = loadPendingUtrOrders;
window.copyShippingAddress = copyShippingAddress;
window.openShippingLabelModal = openShippingLabelModal;
window.closeShippingLabelModal = closeShippingLabelModal;
window.reconcileUtrOrder = reconcileUtrOrder;
window.removeExistingMedia = removeExistingMedia;

// Resilient initialization: handles already-loaded DOM states safely
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
