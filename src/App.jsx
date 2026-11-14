import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Checkout from './components/Checkout';
import CheckoutSuccess from './components/CheckoutSuccess';
import CheckoutFailed from './components/CheckoutFailed';

/**
 * UMANARAYNI AYURVEDA — Main React Application Router
 * Configures Standard PhonePe Checkout routes:
 * - /checkout           -> Checkout Form with PhonePe Trigger
 * - /checkout/success   -> Success Confirmation (Redirected from PhonePe status check)
 * - /checkout/failed    -> Failure/Retry Screen (Redirected from PhonePe status check)
 */
function App() {
  return (
    <Router>
      <Routes>
        {/* Checkout Main Route */}
        <Route path="/checkout" element={<Checkout cartTotal={499} />} />

        {/* Post-Payment Status Callback Routes */}
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/failed" element={<CheckoutFailed />} />

        {/* Fallback redirect */}
        <Route path="*" element={<Navigate to="/checkout" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
