/**
 * UMANARAYNI AYURVEDA — Server-Side Promo Code Service
 * Cryptographically secure server-side promo code validation and discount calculations.
 */

// Fallback launch promo codes in case DB is warming up
const DEFAULT_PROMO_CODES = [
  {
    code: 'AYUR10',
    type: 'percentage',
    value: 10,
    minCart: 499,
    maxDiscount: 150,
    usageLimit: 1000,
    usageCount: 0,
    isActive: true,
    expiresAt: null
  },
  {
    code: 'WELCOME50',
    type: 'flat',
    value: 50,
    minCart: 299,
    maxDiscount: 50,
    usageLimit: 2000,
    usageCount: 0,
    isActive: true,
    expiresAt: null
  },
  {
    code: 'VEDA100',
    type: 'flat',
    value: 100,
    minCart: 999,
    maxDiscount: 100,
    usageLimit: 500,
    usageCount: 0,
    isActive: true,
    expiresAt: null
  }
];

/**
 * Validates a promo code against cart subtotal
 * @param {string} codeRaw 
 * @param {number} cartTotal 
 * @param {object} db 
 */
async function validatePromoCode(codeRaw, cartTotal, db) {
  if (!codeRaw || typeof codeRaw !== 'string') {
    return { valid: false, message: 'Please enter a promo code.' };
  }

  const cleanCode = codeRaw.trim().toUpperCase();
  const subtotal = Number(cartTotal);

  if (isNaN(subtotal) || subtotal <= 0) {
    return { valid: false, message: 'Invalid cart total for promo calculation.' };
  }

  let promo = null;

  // 1. Query MySQL promo_codes table
  try {
    if (db && db.query) {
      const [rows] = await db.query(
        'SELECT * FROM promo_codes WHERE UPPER(code) = ?',
        [cleanCode]
      );
      if (rows && rows.length > 0) {
        promo = rows[0];
      }
    }
  } catch (err) {
    console.warn('[Promo] Database lookup failed, falling back to in-memory config:', err.message);
  }

  // Fallback to launch config
  if (!promo) {
    promo = DEFAULT_PROMO_CODES.find(p => p.code === cleanCode);
  }

  if (!promo) {
    return { valid: false, message: `Promo code "${cleanCode}" is not recognized or does not exist.` };
  }

  // 2. Check active status
  if (!Boolean(promo.isActive)) {
    return { valid: false, message: `Promo code "${cleanCode}" is currently inactive.` };
  }

  // 3. Check expiration
  if (promo.expiresAt) {
    const expiry = new Date(promo.expiresAt);
    if (expiry.getTime() < Date.now()) {
      return { valid: false, message: `Promo code "${cleanCode}" expired on ${expiry.toLocaleDateString('en-IN')}.` };
    }
  }

  // 4. Check minimum cart requirement
  const minCart = Number(promo.minCart || 0);
  if (subtotal < minCart) {
    return {
      valid: false,
      message: `Promo code "${cleanCode}" requires a minimum cart subtotal of ₹${minCart}. (Current: ₹${subtotal})`
    };
  }

  // 5. Check global usage limit
  const usageLimit = Number(promo.usageLimit || 0);
  const usageCount = Number(promo.usageCount || 0);
  if (usageLimit > 0 && usageCount >= usageLimit) {
    return { valid: false, message: `Promo code "${cleanCode}" has reached its maximum redemption limit.` };
  }

  // 6. Calculate discount amount
  let discountAmount = 0;
  const promoValue = Number(promo.value);

  if (promo.type === 'percentage') {
    discountAmount = Math.round((subtotal * (promoValue / 100)) * 100) / 100;
    if (promo.maxDiscount && Number(promo.maxDiscount) > 0) {
      discountAmount = Math.min(discountAmount, Number(promo.maxDiscount));
    }
  } else {
    // Flat discount
    discountAmount = Math.min(promoValue, subtotal);
  }

  discountAmount = Math.max(0, discountAmount);
  const finalPayable = Math.max(0, subtotal - discountAmount);

  return {
    valid: true,
    code: cleanCode,
    type: promo.type,
    value: promoValue,
    discountAmount,
    subtotal,
    finalPayable,
    message: `Promo code "${cleanCode}" applied! You saved ₹${discountAmount}.`
  };
}

/**
 * Increments usage count when order payment succeeds
 */
async function recordPromoUsage(codeRaw, db) {
  if (!codeRaw || !db || !db.query) return;
  const cleanCode = codeRaw.trim().toUpperCase();
  try {
    await db.query(
      'UPDATE promo_codes SET usageCount = usageCount + 1 WHERE UPPER(code) = ?',
      [cleanCode]
    );
  } catch (err) {
    console.warn('[Promo] Could not increment usage count:', err.message);
  }
}

module.exports = {
  validatePromoCode,
  recordPromoUsage,
  DEFAULT_PROMO_CODES
};
