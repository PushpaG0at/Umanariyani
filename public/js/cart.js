/**
 * UMANARAYNI AYURVEDA — SHOPPING CART & CHECKOUT CONTROLLER
 * Full CSP-compliant external script.
 */

document.addEventListener('DOMContentLoaded', () => {
const WHATSAPP_NO = "918641033514";
    let currentUser = null;
    let userSavedAddresses = [];
    let selectedAddressId = null;
    let isPincodeServiceable = true;

    // Delivery Address Validation & Field Management
    const addrFields = {
      fullName: document.getElementById('addrFullName'),
      phone: document.getElementById('addrPhone'),
      email: document.getElementById('addrEmail'),
      line1: document.getElementById('addrLine1'),
      line2: document.getElementById('addrLine2'),
      landmark: document.getElementById('addrLandmark'),
      pincode: document.getElementById('addrPincode'),
      city: document.getElementById('addrCity'),
      state: document.getElementById('addrState')
    };

    const deliveryForm = document.getElementById('deliveryAddressForm');
    if (deliveryForm) deliveryForm.addEventListener('submit', (e) => e.preventDefault());
    const qrForm = document.getElementById('qrPaymentForm');
    if (qrForm) qrForm.addEventListener('submit', (e) => e.preventDefault());

    function clearFieldError(fieldId) {
      const input = document.getElementById(fieldId);
      const errEl = document.getElementById(`err_${fieldId}`);
      if (input) input.classList.remove('field-invalid');
      if (errEl) {
        errEl.textContent = '';
        errEl.style.display = 'none';
      }
    }

    function setFieldError(fieldId, msg) {
      const input = document.getElementById(fieldId);
      const errEl = document.getElementById(`err_${fieldId}`);
      if (input) input.classList.add('field-invalid');
      if (errEl) {
        errEl.textContent = msg;
        errEl.style.display = 'block';
      }
    }

    function cleanPhone(raw) {
      if (!raw) return '';
      let cleaned = String(raw).replace(/[\s\-\(\)\.]/g, '');
      if (cleaned.startsWith('+91')) cleaned = cleaned.slice(3);
      else if (cleaned.startsWith('91') && cleaned.length === 12) cleaned = cleaned.slice(2);
      else if (cleaned.startsWith('0') && cleaned.length === 11) cleaned = cleaned.slice(1);
      return cleaned;
    }

    function validateAddressForm(showErrors = false) {
      let isValid = true;
      let firstInvalidInput = null;

      // 1. Full Name
      const fullName = (addrFields.fullName?.value || '').trim();
      if (!fullName || fullName.length < 2) {
        isValid = false;
        if (showErrors) setFieldError('addrFullName', 'Please enter your full name (at least 2 characters).');
        if (!firstInvalidInput) firstInvalidInput = addrFields.fullName;
      } else {
        clearFieldError('addrFullName');
      }

      // 2. Mobile Phone
      const rawPhone = addrFields.phone?.value || '';
      const phone = cleanPhone(rawPhone);
      const phoneRegex = /^[6-9]\d{9}$/;
      if (!phone || !phoneRegex.test(phone)) {
        isValid = false;
        if (showErrors) setFieldError('addrPhone', 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).');
        if (!firstInvalidInput) firstInvalidInput = addrFields.phone;
      } else {
        clearFieldError('addrPhone');
      }

      // 3. Email Address
      const email = (addrFields.email?.value || '').trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!email || !emailRegex.test(email)) {
        isValid = false;
        if (showErrors) setFieldError('addrEmail', 'Please enter a valid email address for order tracking.');
        if (!firstInvalidInput) firstInvalidInput = addrFields.email;
      } else {
        clearFieldError('addrEmail');
      }

      // 4. Address Line 1
      const line1 = (addrFields.line1?.value || '').trim();
      if (!line1 || line1.length < 5) {
        isValid = false;
        if (showErrors) setFieldError('addrLine1', 'Please enter your house/flat number and street (at least 5 characters).');
        if (!firstInvalidInput) firstInvalidInput = addrFields.line1;
      } else {
        clearFieldError('addrLine1');
      }

      // 5. Line 2 & Landmark (Optional)
      const line2 = (addrFields.line2?.value || '').trim();
      const landmark = (addrFields.landmark?.value || '').trim();

      // 6. Pincode
      const pincode = (addrFields.pincode?.value || '').trim();
      const pincodeRegex = /^[1-9][0-9]{5}$/;
      if (!pincode || !pincodeRegex.test(pincode)) {
        isValid = false;
        if (showErrors) setFieldError('addrPincode', 'Please enter a valid 6-digit Indian PIN code.');
        if (!firstInvalidInput) firstInvalidInput = addrFields.pincode;
      } else if (!isPincodeServiceable) {
        isValid = false;
        if (showErrors) setFieldError('addrPincode', 'We currently do not offer delivery to this PIN code.');
        if (!firstInvalidInput) firstInvalidInput = addrFields.pincode;
      } else {
        clearFieldError('addrPincode');
      }

      // 7. City
      const city = (addrFields.city?.value || '').trim();
      if (!city || city.length < 2) {
        isValid = false;
        if (showErrors) setFieldError('addrCity', 'Please enter your city/town.');
        if (!firstInvalidInput) firstInvalidInput = addrFields.city;
      } else {
        clearFieldError('addrCity');
      }

      // 8. State
      const state = (addrFields.state?.value || '').trim();
      if (!state) {
        isValid = false;
        if (showErrors) setFieldError('addrState', 'Please select your State or Union Territory.');
        if (!firstInvalidInput) firstInvalidInput = addrFields.state;
      } else {
        clearFieldError('addrState');
      }

      // Toggle Payment Buttons State & Notice
      const btnPay = document.getElementById('btnProceedPayment');
      const btnPhonePe = document.getElementById('btnProceedPhonePeHosted');
      const btnWa = document.getElementById('btnCheckoutWhatsApp');
      const notice = document.getElementById('checkoutAddressNotice');
      const qrPreview = document.getElementById('qrDeliveringToSummary');

      let formattedAddress = '';
      if (isValid) {
        formattedAddress = `${fullName}, +91 ${phone}, ${line1}${line2 ? ', ' + line2 : ''}${landmark ? ' (Near ' + landmark + ')' : ''}, ${city}, ${state} - ${pincode}`;
        if (btnPay) btnPay.classList.remove('btn-pay-disabled');
        if (btnPhonePe) btnPhonePe.classList.remove('btn-pay-disabled');
        if (btnWa) btnWa.classList.remove('btn-pay-disabled');
        if (notice) notice.style.display = 'none';
        if (qrPreview) {
          qrPreview.innerHTML = `<strong>${escapeHtml(fullName)}</strong> (+91 ${escapeHtml(phone)})<br>${escapeHtml(line1)}${line2 ? ', ' + escapeHtml(line2) : ''}<br>${escapeHtml(city)}, ${escapeHtml(state)} - <strong>${escapeHtml(pincode)}</strong>`;
        }

        // Keep legacy hidden fields synced
        const qrCustName = document.getElementById('qrCustomerName');
        const qrCustPhone = document.getElementById('qrCustomerPhone');
        const qrCustEmail = document.getElementById('qrCustomerEmail');
        const qrShipAddr = document.getElementById('qrShippingAddress');
        if (qrCustName) qrCustName.value = fullName;
        if (qrCustPhone) qrCustPhone.value = phone;
        if (qrCustEmail) qrCustEmail.value = email;
        if (qrShipAddr) qrShipAddr.value = formattedAddress;
      } else {
        if (btnPay) btnPay.classList.add('btn-pay-disabled');
        if (btnPhonePe) btnPhonePe.classList.add('btn-pay-disabled');
        if (btnWa) btnWa.classList.add('btn-pay-disabled');
        if (notice) notice.style.display = 'flex';
        if (qrPreview) {
          qrPreview.innerHTML = `<span style="color:#DC2626;"><i class="fa-solid fa-triangle-exclamation"></i> Incomplete address. Please fill required fields on cart page.</span>`;
        }
      }

      if (showErrors && firstInvalidInput) {
        firstInvalidInput.focus();
        firstInvalidInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }

      return {
        valid: isValid,
        address: {
          fullName,
          phone,
          email,
          addressLine1: line1,
          addressLine2: line2 || null,
          landmark: landmark || null,
          city,
          state,
          pincode,
          formatted: formattedAddress
        }
      };
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[m]);
    }

    // Attach real-time input listeners to all address fields
    Object.values(addrFields).forEach(field => {
      if (!field) return;
      field.addEventListener('input', () => validateAddressForm(false));
      field.addEventListener('change', () => validateAddressForm(false));
    });

    // Real-time Pincode Serviceability Check
    let pincodeTimer = null;
    addrFields.pincode?.addEventListener('input', (e) => {
      const pin = e.target.value.replace(/\D/g, '').slice(0, 6);
      e.target.value = pin;
      clearTimeout(pincodeTimer);
      const statusEl = document.getElementById('pincodeServiceabilityStatus');

      if (pin.length === 6) {
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.innerHTML = `<span style="color:#6B7280;"><i class="fa-solid fa-spinner fa-spin"></i> Checking delivery serviceability...</span>`;
        }
        pincodeTimer = setTimeout(async () => {
          try {
            const res = await fetch(`/api/shipping/check-pincode/${pin}`);
            const data = await res.json();
            if (data && data.serviceable) {
              isPincodeServiceable = true;
              if (statusEl) {
                statusEl.innerHTML = `<span style="color:#059669; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Standard Delivery Available</span>`;
              }
              clearFieldError('addrPincode');
            } else {
              isPincodeServiceable = false;
              if (statusEl) {
                statusEl.innerHTML = `<span style="color:#DC2626; font-weight:600;"><i class="fa-solid fa-circle-xmark"></i> Sorry, unserviceable PIN code</span>`;
              }
              setFieldError('addrPincode', 'Delivery is currently not available to this PIN code.');
            }
          } catch (_) {
            isPincodeServiceable = true;
            if (statusEl) statusEl.style.display = 'none';
          }
          validateAddressForm(false);
        }, 350);
      } else {
        if (statusEl) statusEl.style.display = 'none';
        isPincodeServiceable = true;
      }
    });

    // Saved Addresses API & Management for Logged-In Users
    async function loadUserAddresses() {
      if (!currentUser) return;
      try {
        const res = await fetch('/api/addresses', { credentials: 'include' });
        const data = await res.json();
        if (data && data.addresses && Array.isArray(data.addresses) && data.addresses.length > 0) {
          userSavedAddresses = data.addresses;
          renderSavedAddressesList();
          // Prefill default or first address
          const def = data.addresses.find(a => a.is_default) || data.addresses[0];
          selectSavedAddress(def.id);
        }
      } catch (err) {
        console.warn('Could not load saved addresses:', err);
      }
    }

    function renderSavedAddressesList() {
      const container = document.getElementById('savedAddressesContainer');
      const list = document.getElementById('savedAddressesList');
      if (!container || !list) return;

      if (userSavedAddresses.length === 0) {
        container.style.display = 'none';
        return;
      }

      container.style.display = 'block';
      list.innerHTML = userSavedAddresses.map(addr => {
        const isSelected = selectedAddressId === addr.id;
        return `
          <div class="saved-addr-card ${isSelected ? 'selected-addr' : ''}" data-addr-id="${addr.id}">
            <div style="flex:1;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                <strong style="color:var(--green-primary); font-size:0.92rem;">${escapeHtml(addr.full_name)}</strong>
                <span style="font-size:0.75rem; background:#E2E8F0; padding:2px 8px; border-radius:10px; text-transform:uppercase; font-weight:600;">${escapeHtml(addr.label || 'Home')}</span>
                ${addr.is_default ? '<span style="font-size:0.72rem; background:#D8F3DC; color:#1B4332; padding:2px 6px; border-radius:8px; font-weight:700;">DEFAULT</span>' : ''}
              </div>
              <div style="font-size:0.83rem; color:var(--text-dark); line-height:1.4;">
                ${escapeHtml(addr.address_line1)}${addr.address_line2 ? ', ' + escapeHtml(addr.address_line2) : ''}${addr.landmark ? ' (Near ' + escapeHtml(addr.landmark) + ')' : ''}<br>
                ${escapeHtml(addr.city)}, ${escapeHtml(addr.state)} - <strong>${escapeHtml(addr.pincode)}</strong><br>
                <span style="color:var(--text-muted); font-size:0.78rem;">Mobile: +91 ${escapeHtml(addr.phone)} &bull; ${escapeHtml(addr.email)}</span>
              </div>
            </div>
            <div style="text-align:right;">
              <input type="radio" name="selectedSavedAddr" value="${addr.id}" ${isSelected ? 'checked' : ''} style="accent-color:var(--green-primary); width:18px; height:18px;" />
            </div>
          </div>
        `;
      }).join('');

      if (!list.dataset.eventsBound) {
        list.dataset.eventsBound = 'true';
        list.addEventListener('click', (e) => {
          const card = e.target.closest('.saved-addr-card');
          if (card) {
            const addrId = Number(card.getAttribute('data-addr-id'));
            if (addrId) selectSavedAddress(addrId);
          }
        });
      }
    }

    window.selectSavedAddress = function(id) {
      selectedAddressId = id;
      const addr = userSavedAddresses.find(a => a.id === id);
      if (!addr) return;

      if (addrFields.fullName) addrFields.fullName.value = addr.full_name || '';
      if (addrFields.phone) addrFields.phone.value = addr.phone || '';
      if (addrFields.email) addrFields.email.value = addr.email || '';
      if (addrFields.line1) addrFields.line1.value = addr.address_line1 || '';
      if (addrFields.line2) addrFields.line2.value = addr.address_line2 || '';
      if (addrFields.landmark) addrFields.landmark.value = addr.landmark || '';
      if (addrFields.pincode) addrFields.pincode.value = addr.pincode || '';
      if (addrFields.city) addrFields.city.value = addr.city || '';
      if (addrFields.state) addrFields.state.value = addr.state || '';

      renderSavedAddressesList();
      validateAddressForm(false);
    };

    document.getElementById('btnAddNewAddress')?.addEventListener('click', () => {
      selectedAddressId = null;
      if (addrFields.fullName) addrFields.fullName.value = currentUser?.name || '';
      if (addrFields.phone) addrFields.phone.value = cleanPhone(currentUser?.phone_number || currentUser?.phone || '');
      if (addrFields.email) addrFields.email.value = currentUser?.email || '';
      if (addrFields.line1) addrFields.line1.value = '';
      if (addrFields.line2) addrFields.line2.value = '';
      if (addrFields.landmark) addrFields.landmark.value = '';
      if (addrFields.pincode) addrFields.pincode.value = '';
      if (addrFields.city) addrFields.city.value = '';
      if (addrFields.state) addrFields.state.value = '';

      renderSavedAddressesList();
      validateAddressForm(false);
      addrFields.line1?.focus();
    });

    async function saveAddressIfRequested(addressObj) {
      const chk = document.getElementById('chkSaveAddress');
      if (!chk || !chk.checked || !currentUser) return;
      try {
        await fetch('/api/addresses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            label: 'Home',
            fullName: addressObj.fullName,
            phone: addressObj.phone,
            email: addressObj.email,
            addressLine1: addressObj.addressLine1,
            addressLine2: addressObj.addressLine2,
            landmark: addressObj.landmark,
            city: addressObj.city,
            state: addressObj.state,
            pincode: addressObj.pincode,
            isDefault: userSavedAddresses.length === 0
          })
        });
      } catch (_) {}
    }

    function updateUserHeaderButton(user) {
      const signinBtn = document.getElementById('headerSignInBtn');
      if (!signinBtn) return;
      if (user && user.name) {
        const firstName = user.name.split(' ')[0];
        const safeAvatar = (user.avatar && user.avatar !== '?' && !user.avatar.includes('?')) ? user.avatar : '🌿';
        signinBtn.innerHTML = `
          <span style="font-size: 1rem;">${safeAvatar}</span>
          <span class="user-btn-name">${firstName}</span>
        `;
        signinBtn.href = "signin.html";
        signinBtn.title = `${user.name} (${user.dosha || 'Ayurvedic Profile'}) — View profile / logout`;
      } else {
        signinBtn.innerHTML = `<i class="fa-regular fa-user"></i> <span>Sign In</span>`;
        signinBtn.href = "signin.html";
        signinBtn.title = "Sign In / Register";
      }
    }

    async function checkUserState() {
      const localUser = JSON.parse(localStorage.getItem('umanarayani_user') || 'null');
      currentUser = localUser;
      updateUserHeaderButton(localUser);

      try {
        const res = await fetch('/api/auth/me', { credentials: 'include' });
        const data = await res.json();
        if (data && data.authenticated && data.user) {
          currentUser = data.user;
          localStorage.setItem('umanarayani_user', JSON.stringify(data.user));
          updateUserHeaderButton(data.user);
          await loadUserAddresses();
        } else if (data && !data.authenticated && !localUser) {
          currentUser = null;
          updateUserHeaderButton(null);
        }
      } catch (e) {}

      // Initial validation check
      validateAddressForm(false);
    }

    function loadCart() {
      const cart = JSON.parse(localStorage.getItem('umanarayani_cart') || '[]');
      const container = document.getElementById('cartItemsContainer');
      const emptyMsg = document.getElementById('emptyCartMsg');
      const totalCountEl = document.getElementById('cartTotalItemsCount');

      const totalQty = cart.reduce((s, i) => s + i.quantity, 0);
      totalCountEl.textContent = totalQty;

      if (cart.length === 0) {
        container.style.display = 'none';
        emptyMsg.style.display = 'block';
        updateTotals(0, 0);
        return;
      }

      container.style.display = 'block';
      emptyMsg.style.display = 'none';

      let totalMrp = 0;
      let totalPayable = 0;

      container.innerHTML = cart.map(item => {
        const itemTotal = item.price * item.quantity;
        const itemMrpTotal = (item.mrp || Math.round(item.price * 1.3)) * item.quantity;
        totalMrp += itemMrpTotal;
        totalPayable += itemTotal;

        return `
          <div class="cart-item-row">
            <img src="${item.image}" alt="${item.name}" class="cart-item-img">
            <div>
              <h4 style="font-size:1rem; color:var(--green-primary); margin-bottom:4px;">${item.name}</h4>
              <span style="font-size:0.8rem; color:var(--text-muted);">${item.volume || '200 ml'} &bull; In Stock</span>
              <div class="cart-qty-ctrl">
                <button type="button" class="qty-btn" data-action="qty-dec" data-id="${item.id}">-</button>
                <span style="font-weight:700; font-size:0.9rem;">${item.quantity}</span>
                <button type="button" class="qty-btn" data-action="qty-inc" data-id="${item.id}">+</button>
                <button type="button" class="cart-remove-btn" data-action="remove" data-id="${item.id}" style="margin-left:12px; background:none; border:none; color:#C0392B; font-size:0.8rem; text-decoration:underline; cursor:pointer;">Remove</button>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:1.15rem; font-weight:800; color:var(--text-main);">₹${itemTotal}</div>
              <div style="font-size:0.8rem; color:var(--text-muted); text-decoration:line-through;">₹${itemMrpTotal}</div>
            </div>
          </div>
        `;
      }).join('');

      if (container && !container.dataset.eventsBound) {
        container.dataset.eventsBound = 'true';
        container.addEventListener('click', (e) => {
          const btn = e.target.closest('[data-action]');
          if (!btn) return;
          const action = btn.getAttribute('data-action');
          const id = btn.getAttribute('data-id');
          if (!id) return;
          if (action === 'qty-dec') changeQty(id, -1);
          else if (action === 'qty-inc') changeQty(id, 1);
          else if (action === 'remove') removeItem(id);
        });
      }

      updateTotals(totalMrp, totalPayable);
    }

    let currentPayableTotal = 0;
    let currentRawSubtotal = 0;
    let appliedPromo = null;

    function updateTotals(mrp, payable) {
      currentRawSubtotal = payable;
      let finalPayable = payable;

      if (appliedPromo) {
        if (payable < (appliedPromo.minCartSubtotal || 0)) {
          appliedPromo = null;
          showPromoStatus('Cart subtotal fell below minimum coupon requirement. Coupon removed.', false);
        } else {
          let discount = 0;
          if (appliedPromo.discountType === 'percent') {
            discount = Math.round((payable * appliedPromo.discountValue) / 100);
            if (appliedPromo.maxDiscount && discount > appliedPromo.maxDiscount) {
              discount = appliedPromo.maxDiscount;
            }
          } else {
            discount = appliedPromo.discountValue;
          }
          discount = Math.min(discount, payable);
          finalPayable = Math.max(0, payable - discount);

          const couponRow = document.getElementById('summaryCouponRow');
          if (couponRow) couponRow.style.display = 'flex';
          const codeEl = document.getElementById('appliedCouponCode');
          if (codeEl) codeEl.textContent = appliedPromo.code;
          const discEl = document.getElementById('summaryCouponDiscount');
          if (discEl) discEl.textContent = `-₹${discount}`;
        }
      }

      if (!appliedPromo) {
        const couponRow = document.getElementById('summaryCouponRow');
        if (couponRow) couponRow.style.display = 'none';
      }

      currentPayableTotal = finalPayable;
      document.getElementById('summaryMrp').textContent = `₹${mrp}`;
      document.getElementById('summaryDiscount').textContent = `-₹${mrp - payable}`;
      document.getElementById('summaryTotal').textContent = `₹${finalPayable}`;
      const modalAmt = document.getElementById('qrModalPayableAmount');
      const stepAmt = document.getElementById('qrModalStepAmount');
      if (modalAmt) modalAmt.textContent = `₹${finalPayable}`;
      if (stepAmt) stepAmt.textContent = `₹${finalPayable}`;
    }

    function showPromoStatus(msg, isSuccess) {
      const el = document.getElementById('promoCodeStatus');
      if (!el) return;
      el.style.display = 'block';
      el.style.color = isSuccess ? '#007600' : '#DC2626';
      el.textContent = msg;
    }

    document.getElementById('btnApplyPromo').addEventListener('click', async () => {
      const input = document.getElementById('promoCodeInput');
      const code = input ? input.value.trim().toUpperCase() : '';
      if (!code) {
        showPromoStatus('Please enter a coupon code.', false);
        return;
      }
      try {
        const res = await fetch('/api/promo/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, cartSubtotal: currentRawSubtotal })
        });
        const data = await res.json();
        if (data.valid && data.promo) {
          appliedPromo = data.promo;
          showPromoStatus(`Coupon "${data.promo.code}" applied! You save ₹${data.promo.discountAmount}`, true);
          loadCart();
        } else {
          showPromoStatus(data.message || 'Invalid or expired promo code.', false);
        }
      } catch (err) {
        showPromoStatus('Unable to validate promo code. Please try again.', false);
      }
    });

    function showQrAlert(msg) {
      const alertBox = document.getElementById('qrModalAlert');
      const alertMsg = document.getElementById('qrModalAlertMsg');
      if (alertBox && alertMsg) {
        alertMsg.textContent = msg;
        alertBox.style.display = 'flex';
      }
    }

    function hideQrAlert() {
      const alertBox = document.getElementById('qrModalAlert');
      if (alertBox) alertBox.style.display = 'none';
    }

    function openQrPaymentModal() {
      const cart = JSON.parse(localStorage.getItem('umanarayani_cart') || '[]');
      if (cart.length === 0) {
        alert("Your herbal basket is empty. Please add items to proceed with payment.");
        return;
      }

      // 1. Mandatory Address Validation Before Opening QR Modal
      const addrCheck = validateAddressForm(true);
      if (!addrCheck.valid) {
        return;
      }

      hideQrAlert();

      const modalAmt = document.getElementById('qrModalPayableAmount');
      const stepAmt = document.getElementById('qrModalStepAmount');
      if (modalAmt) modalAmt.textContent = `₹${currentPayableTotal}`;
      if (stepAmt) stepAmt.textContent = `₹${currentPayableTotal}`;

      const modal = document.getElementById('qrPaymentModal');
      if (modal) modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';
      document.getElementById('qrUtrInput')?.focus();
    }

    function closeQrPaymentModal() {
      const modal = document.getElementById('qrPaymentModal');
      if (modal) modal.style.display = 'none';
      document.body.style.overflow = 'auto';
      hideQrAlert();
    }

    // Modal Triggers: Open on primary Pay button
    document.getElementById('btnProceedPayment').addEventListener('click', openQrPaymentModal);

    // Close button & backdrop click
    document.getElementById('btnCloseQrModal').addEventListener('click', closeQrPaymentModal);
    document.getElementById('btnQrChangeAddress')?.addEventListener('click', () => {
      closeQrPaymentModal();
      document.getElementById('deliveryAddressCard')?.scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('qrPaymentModal').addEventListener('click', (e) => {
      if (e.target.id === 'qrPaymentModal') closeQrPaymentModal();
    });

    // Handle QR Payment Submission
    document.getElementById('qrPaymentForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      hideQrAlert();

      const cart = JSON.parse(localStorage.getItem('umanarayani_cart') || '[]');
      if (cart.length === 0) {
        showQrAlert("Your herbal basket is empty. Please add products to complete order.");
        return;
      }

      // Re-validate address
      const addrCheck = validateAddressForm(true);
      if (!addrCheck.valid) {
        closeQrPaymentModal();
        return;
      }

      const rawUtr = document.getElementById('qrUtrInput').value;
      const cleanUtr = (rawUtr || '').trim().toUpperCase();

      // UTR Validations
      if (!cleanUtr) {
        showQrAlert("Please enter the 12-digit UPI Transaction ID / UTR from your payment app.");
        document.getElementById('qrUtrInput').focus();
        return;
      }

      const utrRegex = /^[A-Z0-9_-]{8,35}$/;
      if (!utrRegex.test(cleanUtr)) {
        showQrAlert("Invalid Transaction ID format. Expected an 8 to 35 character reference number (e.g. 431289567012).");
        document.getElementById('qrUtrInput').focus();
        return;
      }

      const submitBtn = document.getElementById('btnSubmitQrPayment');
      const originalBtnHtml = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Verifying Payment Reference...`;

      try {
        const payload = {
          transactionId: cleanUtr,
          customerName: addrCheck.address.fullName,
          customerPhone: addrCheck.address.phone,
          customerEmail: addrCheck.address.email,
          shippingAddress: addrCheck.address.formatted,
          deliveryAddress: addrCheck.address,
          items: cart,
          promoCode: appliedPromo ? appliedPromo.code : undefined,
          turnstileToken: currentCartTurnstileToken || undefined
        };

        const res = await fetch('/api/payment/verify-qr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.status === 403 && data && (data.code === 'BOT_VERIFICATION_REQUIRED' || data.code === 'RECHALLENGE_REQUIRED')) {
          isCartBotVerified = false;
          const container = document.getElementById('cartTurnstile');
          if (container) container.style.display = 'flex';
          if (window.turnstile && cartTurnstileWidgetId !== null) {
            try { window.turnstile.reset(cartTurnstileWidgetId); } catch (_) {}
          }
          currentCartTurnstileToken = '';
          showQrAlert('Security challenge required. Please complete verification on the checkout screen and submit again.');
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
          return;
        }

        if (res.ok && data.success) {
          isCartBotVerified = true;
          await saveAddressIfRequested(addrCheck.address);
          localStorage.removeItem('umanarayani_cart');
          window.location.href = `/success.html?orderId=${encodeURIComponent(data.orderId || cleanUtr)}&method=upi_qr`;
        } else {
          const errMsg = data?.message || "Could not verify payment reference. Please check your UTR number or contact WhatsApp helpline.";
          showQrAlert(errMsg);
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalBtnHtml;
        }
      } catch (networkErr) {
        console.error('QR Payment verification network error:', networkErr);
        showQrAlert("Network error communicating with payment verification server. Please verify your connection or order via WhatsApp.");
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    });

    // PhonePe Hosted Standard Checkout Integration
    document.getElementById('btnProceedPhonePeHosted').addEventListener('click', async () => {
      const cart = JSON.parse(localStorage.getItem('umanarayani_cart') || '[]');
      if (cart.length === 0) {
        alert("Your herbal basket is empty. Please add items to proceed to payment.");
        return;
      }

      // Mandatory address validation
      const addrCheck = validateAddressForm(true);
      if (!addrCheck.valid) {
        return;
      }

      const payBtn = document.getElementById('btnProceedPhonePeHosted');
      const originalHtml = payBtn.innerHTML;
      payBtn.disabled = true;
      payBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Connecting to Secure PhonePe...`;

      try {
        await saveAddressIfRequested(addrCheck.address);
        const res = await fetch('/api/payment/initiate-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            items: cart,
            customerName: addrCheck.address.fullName,
            customerEmail: addrCheck.address.email,
            customerPhone: addrCheck.address.phone,
            shippingAddress: addrCheck.address.formatted,
            deliveryAddress: addrCheck.address,
            promoCode: appliedPromo ? appliedPromo.code : undefined,
            turnstileToken: currentCartTurnstileToken || undefined
          })
        });

        const data = await res.json();

        if (res.status === 403 && data && (data.code === 'BOT_VERIFICATION_REQUIRED' || data.code === 'RECHALLENGE_REQUIRED')) {
          isCartBotVerified = false;
          const container = document.getElementById('cartTurnstile');
          if (container) container.style.display = 'flex';
          if (window.turnstile && cartTurnstileWidgetId !== null) {
            try { window.turnstile.reset(cartTurnstileWidgetId); } catch (_) {}
          }
          currentCartTurnstileToken = '';
          alert('Security verification needed. Please complete the quick bot check below and click Pay again.');
          payBtn.disabled = false;
          payBtn.innerHTML = originalHtml;
          return;
        }

        const payUrl = data?.url || data?.redirectUrl || data?.checkoutUrl;
        if (data && data.success && payUrl) {
          isCartBotVerified = true;
          window.location.href = payUrl;
        } else {
          alert(data?.message || 'Could not initiate PhonePe payment. Please try again or use WhatsApp order.');
          payBtn.disabled = false;
          payBtn.innerHTML = originalHtml;
        }
      } catch (err) {
        console.error('PhonePe Checkout Error:', err);
        alert('Network error connecting to payment gateway. Please check your connection or order via WhatsApp.');
        payBtn.disabled = false;
        payBtn.innerHTML = originalHtml;
      }
    });

    window.changeQty = function(id, delta) {
      let cart = JSON.parse(localStorage.getItem('umanarayani_cart') || '[]');
      const item = cart.find(i => i.id === id);
      if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
          cart = cart.filter(i => i.id !== id);
        }
        localStorage.setItem('umanarayani_cart', JSON.stringify(cart));
        loadCart();
      }
    };

    window.removeItem = function(id) {
      let cart = JSON.parse(localStorage.getItem('umanarayani_cart') || '[]');
      cart = cart.filter(i => i.id !== id);
      localStorage.setItem('umanarayani_cart', JSON.stringify(cart));
      loadCart();
    };

    // WhatsApp Checkout & Database Order Creation
    document.getElementById('btnCheckoutWhatsApp').addEventListener('click', async () => {
      const cart = JSON.parse(localStorage.getItem('umanarayani_cart') || '[]');
      if (cart.length === 0) {
        alert("Your cart is empty. Please add items to checkout.");
        return;
      }

      // Mandatory address validation
      const addrCheck = validateAddressForm(true);
      if (!addrCheck.valid) {
        return;
      }

      const addr = addrCheck.address;
      await saveAddressIfRequested(addr);

      let text = `*New Order Request — Umanarayni Ayurveda*%0A%0A`;
      let total = 0;
      cart.forEach((item, idx) => {
        text += `${idx + 1}. *${item.name}* x ${item.quantity} = ₹${item.price * item.quantity}%0A`;
        total += item.price * item.quantity;
      });
      if (appliedPromo) {
        text += `*Applied Coupon:* ${appliedPromo.code}%0A`;
      }
      text += `%0A*Total Order Amount:* ₹${currentPayableTotal}%0A*Delivery:* FREE%0A%0A`;
      text += `*Delivery Destination:*%0A`;
      text += `*Name:* ${addr.fullName}%0A`;
      text += `*Phone:* +91 ${addr.phone}%0A`;
      text += `*Address:* ${addr.addressLine1}%0A`;
      if (addr.addressLine2) text += `*Area/Colony:* ${addr.addressLine2}%0A`;
      if (addr.landmark) text += `*Landmark:* ${addr.landmark}%0A`;
      text += `*City/State:* ${addr.city}, ${addr.state} - ${addr.pincode}%0A`;
      text += `*Email:* ${addr.email}%0A%0A`;
      text += `Please confirm my herbal order and provide dispatch details.`;

      // Save order to MySQL backend
      try {
        await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            userId: currentUser?.id || null,
            customerName: addr.fullName,
            customerEmail: addr.email,
            customerPhone: addr.phone,
            shippingAddress: addr.formatted,
            deliveryAddress: addr,
            items: cart,
            subtotal: currentRawSubtotal,
            total: currentPayableTotal,
            paymentMethod: 'COD'
          })
        });
      } catch (err) {
        console.warn('Order could not be saved to backend:', err);
      }

      window.open(`https://wa.me/${WHATSAPP_NO}?text=${text}`, '_blank');
    });

    // Check for payment error parameter from PhonePe redirect
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('error') === 'payment_failed') {
      const banner = document.getElementById('paymentAlertBanner');
      if (banner) banner.style.display = 'flex';
    }

    // ==================== LOW-FRICTION BOT VERIFICATION ====================
    let isCartBotVerified = false;
    let currentCartTurnstileToken = '';
    let cartTurnstileWidgetId = null;

    async function checkBotVerificationStatus() {
      const container = document.getElementById('cartTurnstile');
      try {
        const res = await fetch('/api/bot-verification-status', { credentials: 'include' });
        const data = await res.json();

        if (data && data.verified) {
          isCartBotVerified = true;
          if (container) container.style.display = 'none';
          return;
        }

        // Guest / unverified client: prepare least-intrusive Turnstile widget
        isCartBotVerified = false;
        if (container) container.style.display = 'flex';
        initCartTurnstile(data?.siteKey);
      } catch (e) {
        initCartTurnstile();
      }
    }

    async function initCartTurnstile(providedSiteKey) {
      const container = document.getElementById('cartTurnstile');
      if (!container) return;

      let siteKey = providedSiteKey || (document.querySelector('[data-sitekey]') ? document.querySelector('[data-sitekey]').getAttribute('data-sitekey') : null) || window.TURNSTILE_SITE_KEY;
      if (!siteKey) {
        try {
          const res = await fetch('/api/config');
          const cfg = await res.json();
          if (cfg && cfg.turnstileSiteKey) siteKey = cfg.turnstileSiteKey;
        } catch (_) {}
      }
      siteKey = siteKey || '0x4AAAAAAF5yxm-iBychLJBe';

      const render = () => {
        if (window.turnstile && container && cartTurnstileWidgetId === null) {
          try {
            cartTurnstileWidgetId = window.turnstile.render('#cartTurnstile', {
              sitekey: siteKey,
              appearance: 'interaction-only',
              theme: 'light',
              callback: (token) => {
                currentCartTurnstileToken = token;
              },
              'expired-callback': () => {
                currentCartTurnstileToken = '';
                if (window.turnstile && cartTurnstileWidgetId !== null) {
                  try { window.turnstile.reset(cartTurnstileWidgetId); } catch (_) {}
                }
              },
              'error-callback': () => {
                currentCartTurnstileToken = '';
                if (window.turnstile && cartTurnstileWidgetId !== null) {
                  try { window.turnstile.reset(cartTurnstileWidgetId); } catch (_) {}
                }
              }
            });
          } catch (_) {}
        }
      };

      if (window.turnstile) {
        try {
          if (typeof window.turnstile.ready === 'function') window.turnstile.ready(render);
          else render();
        } catch (_) { render(); }
      } else {
        window.addEventListener('load', () => setTimeout(render, 400));
      }
    }

    checkBotVerificationStatus();
    checkUserState();
    loadCart();
});
