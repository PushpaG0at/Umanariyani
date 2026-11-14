import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

/**
 * UMANARAYNI AYURVEDA — React Checkout Failed Page
 * Displayed when PhonePe redirects the user back to /checkout/failed after an incomplete/failed payment.
 */
const CheckoutFailed = () => {
  let txnId = '';
  let reason = '';
  try {
    const [searchParams] = useSearchParams();
    txnId = searchParams.get('txnId') || searchParams.get('transactionId');
    reason = searchParams.get('reason') || '';
  } catch (_) {
    const params = new URLSearchParams(window.location.search);
    txnId = params.get('txnId') || params.get('transactionId');
    reason = params.get('reason') || '';
  }

  const navigate = useNavigate ? (() => {
    try { return useNavigate(); } catch (_) { return null; }
  })() : null;

  const handleRetryPayment = () => {
    if (navigate) {
      navigate('/checkout');
    } else {
      window.location.href = '/checkout';
    }
  };

  const handleWhatsAppHelp = () => {
    const msg = encodeURIComponent(`Hello Umanarayni Support, my PhonePe payment failed (Txn ID: ${txnId || 'N/A'}). Please assist me with my order.`);
    window.open(`https://wa.me/918641033514?text=${msg}`, '_blank');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrapper}>
          <span style={styles.failedIcon}>✕</span>
        </div>

        <h1 style={styles.title}>Payment Incomplete</h1>
        <p style={styles.subtitle}>
          Your transaction could not be processed by the bank or was cancelled. No charges have been debited from your account.
        </p>

        {txnId && (
          <div style={styles.txnBox}>
            <span style={styles.txnLabel}>Attempt Reference ID</span>
            <span style={styles.txnValue}>{txnId}</span>
          </div>
        )}

        <div style={styles.troubleshootBox}>
          <div style={styles.tipItem}>
            <span>•</span>
            <span>Ensure your UPI app / card has active international/e-commerce authorization</span>
          </div>
          <div style={styles.tipItem}>
            <span>•</span>
            <span>Check network connectivity or switch to another UPI app</span>
          </div>
          <div style={styles.tipItem}>
            <span>•</span>
            <span>Alternatively, place your order directly via WhatsApp Concierge</span>
          </div>
        </div>

        <div style={styles.buttonStack}>
          <button onClick={handleRetryPayment} style={styles.retryButton}>
            Try Payment Again
          </button>
          
          <button onClick={handleWhatsAppHelp} style={styles.whatsappButton}>
            💬 Complete Order via WhatsApp Helpline
          </button>
        </div>

        <p style={styles.supportNote}>
          Need instant help? Call or WhatsApp our helpline at <strong>+91 8641033514</strong>
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
    background: 'linear-gradient(135deg, #fdf8f8 0%, #fbf0f0 100%)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  card: {
    maxWidth: '520px',
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: '20px',
    padding: '40px 32px',
    textAlign: 'center',
    boxShadow: '0 16px 40px rgba(155, 28, 28, 0.08)',
    border: '1px solid #fbd5d5'
  },
  iconWrapper: {
    width: '80px',
    height: '80px',
    margin: '0 auto 20px',
    borderRadius: '50%',
    backgroundColor: '#fde8e8',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: '2px solid #f05252'
  },
  failedIcon: {
    fontSize: '2.5rem',
    color: '#c81e1e',
    fontWeight: 'bold',
    lineHeight: 1
  },
  title: {
    margin: '0 0 10px 0',
    color: '#9b1c1c',
    fontSize: '1.65rem',
    fontWeight: '700'
  },
  subtitle: {
    margin: '0 0 24px 0',
    color: '#6e4040',
    fontSize: '0.98rem',
    lineHeight: 1.5
  },
  txnBox: {
    backgroundColor: '#fff8f8',
    border: '1px solid #fed7d7',
    borderRadius: '10px',
    padding: '12px 16px',
    marginBottom: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  txnLabel: {
    fontSize: '0.78rem',
    color: '#9b1c1c',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  txnValue: {
    fontFamily: 'monospace',
    fontSize: '0.95rem',
    fontWeight: 'bold',
    color: '#771d1d',
    wordBreak: 'break-all'
  },
  troubleshootBox: {
    backgroundColor: '#fafbfc',
    borderRadius: '12px',
    padding: '14px 18px',
    textAlign: 'left',
    marginBottom: '26px',
    border: '1px dashed #e3a9a9'
  },
  tipItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    fontSize: '0.86rem',
    color: '#553c3c',
    margin: '8px 0',
    lineHeight: 1.4
  },
  buttonStack: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  retryButton: {
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
  whatsappButton: {
    width: '100%',
    padding: '13px 20px',
    backgroundColor: '#25D366',
    color: '#ffffff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '0.95rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity 0.2s'
  },
  supportNote: {
    marginTop: '20px',
    fontSize: '0.82rem',
    color: '#775a5a'
  }
};

export default CheckoutFailed;
