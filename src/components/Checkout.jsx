import React, { useState } from 'react';
import axios from 'axios';

/**
 * UMANARAYNI AYURVEDA — React Checkout Component
 * Standard Checkout Integration with PhonePe PG Sandbox / Production.
 */
const Checkout = ({ cartItems = [], cartTotal = 499 }) => {
  const [userDetails, setUserDetails] = useState({
    name: 'Pushpendra Singh',
    email: 'singhpushpendra95734@gmail.com',
    phone: '8641033514',
    address: 'Express Delivery Address, India'
  });

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setUserDetails(prev => ({ ...prev, [name]: value }));
  };

  /**
   * Triggers PhonePe Standard Checkout via backend /api/payment/initiate-payment
   */
  const handlePayment = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    try {
      // 1. Post order total & customer details to backend endpoint
      const response = await axios.post(
        'https://umanarayni.com/api/payment/initiate-payment',
        {
          amount: cartTotal,
          cartTotal: cartTotal,
          userDetails: {
            name: userDetails.name,
            email: userDetails.email,
            phone: userDetails.phone,
            address: userDetails.address
          },
          customerName: userDetails.name,
          customerEmail: userDetails.email,
          customerPhone: userDetails.phone,
          shippingAddress: userDetails.address,
          items: cartItems.length > 0 ? cartItems : [
            { id: 'PROD-HERBAL-01', name: 'Ayurvedic Formulations Order', price: cartTotal, quantity: 1 }
          ]
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
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
      const detail = error.response?.data?.message || error.message || 'Payment server unreachable';
      setErrorMessage(`Payment initialization failed: ${detail}`);
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
          <h3 style={styles.sectionHeading}>1. Delivery & Contact Details</h3>
          
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Full Name</label>
            <input
              type="text"
              name="name"
              value={userDetails.name}
              onChange={handleInputChange}
              required
              style={styles.input}
              placeholder="e.g. Pushpendra Singh"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email Address</label>
            <input
              type="email"
              name="email"
              value={userDetails.email}
              onChange={handleInputChange}
              required
              style={styles.input}
              placeholder="name@domain.com"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Mobile Number (10 digits)</label>
            <input
              type="tel"
              name="phone"
              value={userDetails.phone}
              onChange={handleInputChange}
              required
              pattern="[0-9]{10}"
              style={styles.input}
              placeholder="9876543210"
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Shipping Address</label>
            <textarea
              name="address"
              value={userDetails.address}
              onChange={handleInputChange}
              required
              rows="3"
              style={styles.textarea}
              placeholder="Flat/House No., Street, City, State, PIN"
            />
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
    marginBottom: '14px'
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
