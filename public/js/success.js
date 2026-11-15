/**
 * UMANARAYNI AYURVEDA — ORDER SUCCESS CONTROLLER
 * Full CSP-compliant external script.
 */

function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, m => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[m]);
    }

    document.addEventListener('DOMContentLoaded', () => {
      // 1. Clear cart upon confirmed payment
      localStorage.removeItem('umanarayani_cart');

      // 2. Extract Order ID from URL query parameters
      const urlParams = new URLSearchParams(window.location.search);
      const orderId = urlParams.get('orderId') || urlParams.get('txnId') || '';
      const orderIdEl = document.getElementById('orderIdText');
      if (orderIdEl) {
        orderIdEl.textContent = orderId || ('CONFIRMED-' + Date.now());
      }

      // 3. Fetch order details to display confirmed delivery address
      if (orderId) {
        fetch(`/api/orders/${encodeURIComponent(orderId)}`, { credentials: 'include' })
          .then(res => res.json())
          .then(data => {
            if (data && data.order) {
              const o = data.order;
              const destCard = document.getElementById('deliveryDestinationCard');
              const destBody = document.getElementById('deliveryDestinationBody');
              if (destCard && destBody) {
                const addr = o.shipping_address_json || {};
                const name = addr.fullName || o.customerName || 'Customer';
                const phone = addr.phone || o.customerPhone || '';
                const line1 = addr.addressLine1 || o.shippingAddress || '';
                const line2 = addr.addressLine2 ? `, ${addr.addressLine2}` : '';
                const landmark = addr.landmark ? ` (Near ${addr.landmark})` : '';
                const cityState = (addr.city && addr.state)
                  ? `${addr.city}, ${addr.state} - ${addr.pincode}`
                  : (o.shippingAddress || '');

                destBody.innerHTML = `
                  <strong>${escapeHtml(name)}</strong> ${phone ? `&bull; +91 ${escapeHtml(phone)}` : ''}<br>
                  ${escapeHtml(line1)}${escapeHtml(line2)}${escapeHtml(landmark)}<br>
                  ${escapeHtml(cityState)}
                `;
                destCard.style.display = 'block';
              }
            }
          })
          .catch(() => {});
      }

      // 4. Configure WhatsApp notification button
      const waBtn = document.getElementById('btnWhatsAppConfirm');
      if (waBtn) {
        const msg = encodeURIComponent(`Hello Umanarayni! I have completed my order payment. Transaction ID: ${orderId || 'Order'}. Please share updates on dispatch.`);
        waBtn.href = `https://wa.me/918641033514?text=${msg}`;
      }
    });