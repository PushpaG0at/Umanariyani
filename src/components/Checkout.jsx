import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry'
];

/**
 * UMANARAYNI AYURVEDA — React Checkout Component
 * Standard Checkout Integration with PhonePe PG Sandbox / Production
 * Low-friction bot mitigation with human_verified cookie / session bypass.
 */
const Checkout = ({ cartItems = [], cartTotal = 499 }) => {
  const [address, setAddress] = useState({
    fullName: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    landmark: '',
    city: '',
    state: '',
    pincode: ''
  });

  const [formErrors, setFormErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Low-friction bot protection state
  const [isBotVerified, setIsBotVerified] = useState(false);
  const [requiresChallenge, setRequiresChallenge] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileWidgetId, setTurnstileWidgetId] = useState(null);
  const turnstileContainerRef = useRef(null);

  // Check bot verification status on mount: skip widget if cookie or session is valid
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const res = await axios.get('https://umanarayni.com/api/bot-verification-status', {
          withCredentials: true,
          timeout: 8000
        });

        if (!isMounted) return;

        if (res.data?.verified) {
          setIsBotVerified(true);
          setRequiresChallenge(false);
        } else {
          setIsBotVerified(false);
          setRequiresChallenge(true);
          initTurnstileWidget(res.data?.siteKey);
        }
      } catch (err) {
        if (!isMounted) return;
        setIsBotVerified(false);
        setRequiresChallenge(true);
        initTurnstileWidget();
      }
    };

    checkStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const initTurnstileWidget = (siteKeyParam) => {
    const siteKey = siteKeyParam || window.TURNSTILE_SITE_KEY || '0x4AAAAAAF5yxm-iBychLJBe';

    const renderWidget = () => {
      if (window.turnstile && turnstileContainerRef.current && turnstileWidgetId === null) {
        try {
          const wId = window.turnstile.render(turnstileContainerRef.current, {
            sitekey: siteKey,
            theme: 'light',
            appearance: 'interaction-only',
            callback: (token) => {
              setTurnstileToken(token);
              setErrorMessage('');
            },
            'expired-callback': () => {
              setTurnstileToken('');
              if (window.turnstile && wId !== null) {
                try { window.turnstile.reset(wId); } catch (_) {}
              }
            },
            'error-callback': () => {
              setTurnstileToken('');
              if (window.turnstile && wId !== null) {
                try { window.turnstile.reset(wId); } catch (_) {}
              }
            }
          });
          setTurnstileWidgetId(wId);
        } catch (_) {}
      }
    };

    if (window.turnstile) {
      if (typeof window.turnstile.ready === 'function') {
        window.turnstile.ready(renderWidget);
      } else {
        renderWidget();
      }
    } else {
      setTimeout(renderWidget, 500);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setAddress(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors = {};
    if (!address.fullName.trim() || address.fullName.trim().length < 2) {
      errors.fullName = 'Full name is required (min 2 characters).';
    }
    const cleanPhone = address.phone.replace(/[\s\-\+]/g, '').slice(-10);
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      errors.phone = 'Valid 10-digit Indian mobile number is required.';
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.email.trim())) {
      errors.email = 'Valid email address is required.';
    }
    if (!address.addressLine1.trim() || address.addressLine1.trim().length < 5) {
      errors.addressLine1 = 'House/Flat No. and Street address required (min 5 chars).';
    }
    if (!/^[1-9][0-9]{5}$/.test(address.pincode.trim())) {
      errors.pincode = 'Valid 6-digit Indian PIN code required.';
    }
    if (!address.city.trim() || address.city.trim().length < 2) {
      errors.city = 'City/Town is required.';
    }
    if (!address.state) {
      errors.state = 'Please select a State or Union Territory.';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Triggers PhonePe Standard Checkout via backend /api/payment/initiate-payment
   */
  const handlePayment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!validateForm()) {
      setErrorMessage('Please fix highlighted delivery address fields.');
      return;
    }

    // If bot check is not bypassed via cookie/session and no token is present, prompt user
    if (!isBotVerified && !turnstileToken) {
      setRequiresChallenge(true);
      setErrorMessage('Please complete the quick security check below before continuing.');
      if (window.turnstile && turnstileWidgetId !== null && typeof window.turnstile.execute === 'function') {
        try {
          window.turnstile.execute(turnstileWidgetId);
        } catch (_) {}
      }
      return;
    }

    setLoading(true);
    setErrorMessage('');

    const formattedAddress = `${address.fullName.trim()}, +91 ${address.phone.trim()}, ${address.addressLine1.trim()}${address.addressLine2 ? ', ' + address.addressLine2.trim() : ''}${address.landmark ? ' (Near ' + address.landmark.trim() + ')' : ''}, ${address.city.trim()}, ${address.state} - ${address.pincode.trim()}`;

    const deliveryAddressObj = {
      fullName: address.fullName.trim(),
      phone: address.phone.replace(/[\s\-\+]/g, '').slice(-10),
      email: address.email.trim(),
      addressLine1: address.addressLine1.trim(),
      addressLine2: address.addressLine2.trim() || null,
      landmark: address.landmark.trim() || null,
      city: address.city.trim(),
      state: address.state,
      pincode: address.pincode.trim(),
      formatted: formattedAddress
    };

    try {
      // 1. Post order total & customer details to backend endpoint
      const response = await axios.post(
        'https://umanarayni.com/api/payment/initiate-payment',
        {
          amount: cartTotal,
          cartTotal: cartTotal,
          deliveryAddress: deliveryAddressObj,
          customerName: deliveryAddressObj.fullName,
          customerEmail: deliveryAddressObj.email,
          customerPhone: deliveryAddressObj.phone,
          shippingAddress: formattedAddress,
          turnstileToken: turnstileToken || undefined,
          items: cartItems.length > 0 ? cartItems : [
            { id: 'PROD-HERBAL-01', name: 'Ayurvedic Formulations Order', price: cartTotal, quantity: 1 }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          withCredentials: true,
          timeout: 15000
        }
      );

      // 2. Extract PhonePe checkout URL
      const paymentUrl = response.data?.url || response.data?.redirectUrl || response.data?.checkoutUrl;

      if (response.data?.success && paymentUrl) {
        // 3. Redirect user directly to the secure PhonePe payment gateway page
        window.location.href = paymentUrl;
      } else {
        setErrorMessage(response.data?.message || 'Could not retrieve payment gateway link. Please try again.');
        setLoading(false);
      }
    } catch (error) {
      console.error('PhonePe Payment Initiation Error:', error);
      const errData = error.response?.data;
      if (error.response?.status === 403 && (errData?.code === 'BOT_VERIFICATION_REQUIRED' || errData?.code === 'RECHALLENGE_REQUIRED')) {
        setIsBotVerified(false);
        setRequiresChallenge(true);
        setTurnstileToken('');
        if (window.turnstile && turnstileWidgetId !== null) {
          try { window.turnstile.reset(turnstileWidgetId); } catch (_) {}
        }
        setErrorMessage(errData?.message || 'Quick security check required. Please verify below and click Pay again.');
      } else {
        const detail = errData?.message || error.message || 'Payment server unreachable';
        setErrorMessage(`Payment initialization failed: ${detail}`);
      }
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logoBadge}>🌿</div>
          <h2 style={styles.title}>UMANARAYNI AYURVEDA</h2>
          <p style={styles.subtitle}>Pure Nature, Pure Care — Secure Standard Checkout</p>
        </div>

        {errorMessage && (
          <div style={styles.errorBanner}>
            <span>⚠️ {errorMessage}</span>
          </div>
        )}

        <form onSubmit={handlePayment} style={styles.form}>
          <h3 style={styles.sectionHeading}>1. Delivery Destination</h3>
          
          <div style={styles.twoCol}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Full Name *</label>
              <input
                type="text"
                name="fullName"
                value={address.fullName}
                onChange={handleInputChange}
                autoComplete="name"
                required
                style={formErrors.fullName ? { ...styles.input, ...styles.inputError } : styles.input}
                placeholder="e.g. Rajesh Kumar"
              />
              {formErrors.fullName && <span style={styles.errText}>{formErrors.fullName}</span>}
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Mobile Number *</label>
              <input
                type="tel"
                name="phone"
                value={address.phone}
                onChange={handleInputChange}
                autoComplete="tel"
                required
                maxLength={14}
                style={formErrors.phone ? { ...styles.input, ...styles.inputError } : styles.input}
                placeholder="10-digit mobile (e.g. 9876543210)"
              />
              {formErrors.phone && <span style={styles.errText}>{formErrors.phone}</span>}
            </div>
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address (for order tracking & invoice) *</label>
            <input
              type="email"
              name="email"
              value={address.email}
              onChange={handleInputChange}
              autoComplete="email"
              required
              style={formErrors.email ? { ...styles.input, ...styles.inputError } : styles.input}
              placeholder="e.g. patron@example.com"
            />
            {formErrors.email && <span style={styles.errText}>{formErrors.email}</span>}
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Address Line 1 (Flat/House No., Building, Street) *</label>
            <input
              type="text"
              name="addressLine1"
              value={address.addressLine1}
              onChange={handleInputChange}
              autoComplete="address-line1"
              required
              style={formErrors.addressLine1 ? { ...styles.input, ...styles.inputError } : styles.input}
              placeholder="e.g. Flat 402, Green Valley Apartments, 5th Cross Road"
            />
            {formErrors.addressLine1 && <span style={styles.errText}>{formErrors.addressLine1}</span>}
          </div>

          <div style={styles.twoCol}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>Address Line 2 (Area, Colony, Sector - Optional)</label>
              <input
                type="text"
                name="addressLine2"
                value={address.addressLine2}
                onChange={handleInputChange}
                autoComplete="address-line2"
                style={styles.input}
                placeholder="e.g. Sector 18"
              />
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Landmark (Optional)</label>
              <input
                type="text"
                name="landmark"
                value={address.landmark}
                onChange={handleInputChange}
                style={styles.input}
                placeholder="e.g. Near Metro Station"
              />
            </div>
          </div>

          <div style={styles.threeCol}>
            <div style={styles.fieldGroup}>
              <label style={styles.label}>PIN Code *</label>
              <input
                type="text"
                name="pincode"
                value={address.pincode}
                onChange={handleInputChange}
                autoComplete="postal-code"
                maxLength={6}
                required
                style={formErrors.pincode ? { ...styles.input, ...styles.inputError } : styles.input}
                placeholder="6 digits"
              />
              {formErrors.pincode && <span style={styles.errText}>{formErrors.pincode}</span>}
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>Town / City *</label>
              <input
                type="text"
                name="city"
                value={address.city}
                onChange={handleInputChange}
                autoComplete="address-level2"
                required
                style={formErrors.city ? { ...styles.input, ...styles.inputError } : styles.input}
                placeholder="City"
              />
              {formErrors.city && <span style={styles.errText}>{formErrors.city}</span>}
            </div>

            <div style={styles.fieldGroup}>
              <label style={styles.label}>State / UT *</label>
              <select
                name="state"
                value={address.state}
                onChange={handleInputChange}
                autoComplete="address-level1"
                required
                style={formErrors.state ? { ...styles.input, ...styles.inputError } : styles.input}
              >
                <option value="">Select State</option>
                {INDIAN_STATES.map(st => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              {formErrors.state && <span style={styles.errText}>{formErrors.state}</span>}
            </div>
          </div>

          <h3 style={styles.sectionHeading}>2. Order Summary</h3>
          <div style={styles.summaryBox}>
            <div style={styles.summaryRow}>
              <span>Herbal Formulations Subtotal:</span>
              <span>₹{cartTotal}</span>
            </div>
            <div style={styles.summaryRow}>
              <span>Pan-India Sacred Delivery:</span>
              <span style={{ color: '#2d6a4f', fontWeight: 'bold' }}>FREE</span>
            </div>
            <div style={styles.divider}></div>
            <div style={styles.totalRow}>
              <span>Grand Total:</span>
              <span style={styles.totalPrice}>₹{cartTotal}</span>
            </div>
          </div>

          {/* Cloudflare Turnstile container: hidden when verified by session/cookie, displayed if challenge required */}
          <div
            ref={turnstileContainerRef}
            id="reactCheckoutTurnstile"
            style={{
              margin: requiresChallenge ? '16px auto' : '0',
              display: requiresChallenge ? 'flex' : 'none',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: requiresChallenge ? '65px' : '0'
            }}
          />

          <button
            type="submit"
            disabled={loading}
            style={loading ? { ...styles.payButton, ...styles.payButtonDisabled } : styles.payButton}
          >
            {loading ? (
              <span>Connecting to Secure PhonePe...</span>
            ) : (
              <span>Proceed to Pay with PhonePe • ₹{cartTotal}</span>
            )}
          </button>
        </form>

        <div style={styles.securityFooter}>
          <span>🔒 256-Bit SSL Encrypted &bull; Official PhonePe Standard Checkout</span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f7f9f7 0%, #eef5ee 100%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '24px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    maxWidth: '560px',
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    padding: '36px 32px',
    boxShadow: '0 12px 36px rgba(21, 71, 52, 0.08)',
    border: '1px solid #dbe7df'
  },
  header: {
    textAlign: 'center',
    marginBottom: '28px'
  },
  logoBadge: {
    fontSize: '2.4rem',
    marginBottom: '8px'
  },
  title: {
    margin: '0 0 6px 0',
    color: '#154734',
    fontSize: '1.5rem',
    letterSpacing: '1px',
    fontWeight: '700'
  },
  subtitle: {
    margin: 0,
    color: '#52796f',
    fontSize: '0.9rem'
  },
  sectionHeading: {
    color: '#154734',
    fontSize: '1.05rem',
    margin: '20px 0 12px 0',
    borderBottom: '1px solid #eef3ef',
    paddingBottom: '6px'
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    marginBottom: '14px',
    flex: 1
  },
  twoCol: {
    display: 'flex',
    gap: '12px'
  },
  threeCol: {
    display: 'flex',
    gap: '10px'
  },
  inputError: {
    borderColor: '#e02424',
    backgroundColor: '#fdf2f2'
  },
  errText: {
    color: '#e02424',
    fontSize: '0.75rem',
    marginTop: '4px'
  },
  label: {
    fontSize: '0.85rem',
    fontWeight: '600',
    color: '#2d6a4f',
    marginBottom: '6px'
  },
  input: {
    padding: '11px 14px',
    borderRadius: '8px',
    border: '1px solid #c8d8ce',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.2s',
    backgroundColor: '#fafcfb'
  },
  textarea: {
    padding: '11px 14px',
    borderRadius: '8px',
    border: '1px solid #c8d8ce',
    fontSize: '0.95rem',
    outline: 'none',
    fontFamily: 'inherit',
    backgroundColor: '#fafcfb'
  },
  summaryBox: {
    background: '#f4f8f5',
    borderRadius: '10px',
    padding: '16px',
    margin: '16px 0 24px 0',
    border: '1px solid #dbe7df'
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.9rem',
    color: '#406050',
    marginBottom: '8px'
  },
  divider: {
    height: '1px',
    backgroundColor: '#dbe7df',
    margin: '10px 0'
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '1.1rem',
    fontWeight: 'bold',
    color: '#154734'
  },
  totalPrice: {
    color: '#154734',
    fontSize: '1.25rem'
  },
  payButton: {
    width: '100%',
    padding: '15px 20px',
    backgroundColor: '#154734',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1.05rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s, transform 0.1s',
    boxShadow: '0 4px 14px rgba(21, 71, 52, 0.25)'
  },
  payButtonDisabled: {
    backgroundColor: '#8da89d',
    cursor: 'not-allowed',
    boxShadow: 'none'
  },
  errorBanner: {
    backgroundColor: '#fde8e8',
    color: '#9b1c1c',
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '18px',
    fontSize: '0.9rem',
    border: '1px solid #f8b4b4'
  },
  securityFooter: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '0.8rem',
    color: '#6c8577'
  }
};

export default Checkout;
