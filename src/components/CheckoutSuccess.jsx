import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

/**
 * UMANARAYNI AYURVEDA — React Checkout Success Page
 * Displayed when PhonePe redirects the user back to /checkout/success after successful payment.
 */
const CheckoutSuccess = () => {
  const [shippingDetails, setShippingDetails] = useState(null);

  // Support both React Router useSearchParams and fallback to window.location
  let txnId = '';
  try {
    const [searchParams] = useSearchParams();
    txnId = searchParams.get('txnId') || searchParams.get('transactionId') || searchParams.get('orderId');
  } catch (_) {
    const params = new URLSearchParams(window.location.search);
    txnId = params.get('txnId') || params.get('transactionId') || params.get('orderId');
  }

  const navigate = useNavigate ? (() => {
    try { return useNavigate(); } catch (_) { return null; }
  })() : null;

  useEffect(() => {
    if (!txnId) return;
    fetch(`/api/orders/${encodeURIComponent(txnId)}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data && data.order) {
          const o = data.order;
          setShippingDetails({
            name: o.shipping_address_json?.fullName || o.customerName || 'Customer',
            phone: o.shipping_address_json?.phone || o.customerPhone || '',
            email: o.shipping_address_json?.email || o.customerEmail || '',
            line1: o.shipping_address_json?.addressLine1 || o.shippingAddress || '',
            line2: o.shipping_address_json?.addressLine2 || '',
            landmark: o.shipping_address_json?.landmark || '',
            city: o.shipping_address_json?.city || o.city || '',
            state: o.shipping_address_json?.state || o.state || '',
            pincode: o.shipping_address_json?.pincode || o.pincode || '',
            formatted: o.shippingAddress || ''
          });
        }
      })
      .catch(() => {});
  }, [txnId]);

  const handleReturnHome = () => {
    if (navigate) {
      navigate('/');
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <span style={styles.checkIcon}>✓</span>
        </div>

        <h1 style={styles.title}>Payment Received!</h1>
        <p style={styles.subtitle}>
          Namaste. Your sacred Ayurvedic order has been verified and confirmed.
        </p>

        {txnId && (
          <div style={styles.txnBox}>
            <span style={styles.txnLabel}>Transaction Reference ID</span>
            <span style={styles.txnValue}>{txnId}</span>
          </div>
        )}

        {shippingDetails && (
          <div style={styles.addressBox}>
            <div style={styles.addressTitle}>
              <span>📦</span>
              <span>Delivering To</span>
            </div>
            <div style={styles.addressContent}>
              <strong>{shippingDetails.name}</strong>
              {shippingDetails.phone && ` • +91 ${shippingDetails.phone}`}
              <br />
              {shippingDetails.line1}
              {shippingDetails.line2 ? `, ${shippingDetails.line2}` : ''}
              {shippingDetails.landmark ? ` (Near ${shippingDetails.landmark})` : ''}
              <br />
              {shippingDetails.city ? `${shippingDetails.city}, ${shippingDetails.state} - ${shippingDetails.pincode}` : shippingDetails.formatted}
            </div>
          </div>
        )}

        <div style={styles.perksCard}>
          <div style={styles.perkItem}>
            <span>🌿</span>
            <span>Handcrafted botanical formulations freshly prepared</span>
          </div>
          <div style={styles.perkItem}>
            <span>📦</span>
            <span>Dispatched within 24 hours with Express Pan-India tracking</span>
          </div>
          <div style={styles.perkItem}>
            <span>💬</span>
            <span>Confirmation & invoice sent to your email & WhatsApp</span>
          </div>
        </div>

        <button onClick={handleReturnHome} style={styles.button}>
          Continue Shopping Formulations
        </button>

        <p style={styles.supportNote}>
          Need assistance with your formulation delivery? WhatsApp us at <strong>+91 8641033514</strong>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '30px 20px',
    background: 'linear-gradient(135deg, #f2f7f3 0%, #e5efe7 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    maxWidth: '520px',
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '40px 32px',
    textAlign: 'center',
    boxShadow: '0 16px 40px rgba(21, 71, 52, 0.09)',
    border: '1px solid #d4e4d8'
  },
  iconWrapper: {
    width: '80px',
    height: '80px',
    margin: '0 auto 20px',
    borderRadius: '50%',
    backgroundColor: '#eaf5ee',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: '2px solid #52b788'
  },
  checkIcon: {
    fontSize: '2.5rem',
    color: '#2d6a4f',
    fontWeight: 'bold',
    lineHeight: 1
  },
  title: {
    margin: '0 0 10px 0',
    color: '#154734',
    fontSize: '1.65rem',
    fontWeight: '700'
  },
  subtitle: {
    margin: '0 0 24px 0',
    color: '#496d5b',
    fontSize: '0.98rem',
    lineHeight: 1.5
  },
  txnBox: {
    backgroundColor: '#f7faf8',
    border: '1px solid #dce8df',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  txnLabel: {
    fontSize: '0.78rem',
    color: '#658172',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  txnValue: {
    fontFamily: 'monospace',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: '#154734',
    wordBreak: 'break-all'
  },
  addressBox: {
    backgroundColor: '#f4f8f5',
    border: '1px solid #c8d8ce',
    borderRadius: '10px',
    padding: '14px 16px',
    marginBottom: '20px',
    textAlign: 'left'
  },
  addressTitle: {
    fontSize: '0.85rem',
    fontWeight: '700',
    color: '#154734',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '6px'
  },
  addressContent: {
    fontSize: '0.88rem',
    color: '#2d4739',
    lineHeight: 1.45
  },
  perksCard: {
    backgroundColor: '#fafcfb',
    borderRadius: '12px',
    padding: '16px 18px',
    textAlign: 'left',
    marginBottom: '28px',
    border: '1px dashed #b7d5bf'
  },
  perkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '0.88rem',
    color: '#2d4b3b',
    margin: '8px 0'
  },
  button: {
    width: '100%',
    padding: '14px 20px',
    backgroundColor: '#154734',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    boxShadow: '0 4px 14px rgba(21, 71, 52, 0.2)'
  },
  supportNote: {
    marginTop: '20px',
    fontSize: '0.82rem',
    color: '#6c8577'
  }
};

export default CheckoutSuccess;
