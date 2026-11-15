/**
 * UMANARAYNI AYURVEDA — Delivery Address & Pincode Service
 * Validates, sanitizes, and formats Indian delivery addresses across all checkout flows
 * (PhonePe, Manual UPI/UTR, WhatsApp orders).
 */

// Official list of all 28 States and 8 Union Territories in India (36 total)
const INDIAN_STATES_AND_UTS = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal'
];

/**
 * Normalizes an Indian phone number to 10 digits
 * Strips leading +91, 91, 0, whitespace, hyphens, and parentheses.
 * Returns 10-digit numeric string or null if invalid.
 */
function normalizeIndianPhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.slice(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.slice(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.slice(1);
  }
  return /^[6-9]\d{9}$/.test(cleaned) ? cleaned : null;
}

/**
 * Validates 6-digit Indian Postal PIN Code
 * Must be 6 digits, first digit cannot be 0.
 */
function isValidIndianPincode(pincode) {
  if (!pincode) return false;
  const clean = String(pincode).trim();
  return /^[1-9][0-9]{5}$/.test(clean);
}

/**
 * Checks pluggable pincode serviceability.
 * Configured via SERVICEABLE_PINCODE_PREFIXES (comma-separated, e.g. "11,12,20,30,40,56")
 * If env is unset, empty, or "*", all valid 6-digit Indian pincodes are serviceable by default.
 */
function checkPincodeServiceability(pincode, overridePrefixes = null) {
  const cleanPin = String(pincode || '').trim();
  if (!isValidIndianPincode(cleanPin)) {
    return {
      valid: false,
      serviceable: false,
      pincode: cleanPin,
      message: 'Invalid pincode format. Must be a 6-digit Indian postal code.'
    };
  }

  const configuredPrefixes = (overridePrefixes !== null ? String(overridePrefixes) : (process.env.SERVICEABLE_PINCODE_PREFIXES || '')).trim();

  // Default: allow all valid Indian pincodes
  if (!configuredPrefixes || configuredPrefixes === '*' || configuredPrefixes.toLowerCase() === 'all') {
    return {
      valid: true,
      serviceable: true,
      pincode: cleanPin,
      message: 'Express delivery available across Pan-India (3-5 business days).'
    };
  }

  const prefixList = configuredPrefixes
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  const isMatched = prefixList.some(prefix => cleanPin.startsWith(prefix));

  if (isMatched) {
    return {
      valid: true,
      serviceable: true,
      pincode: cleanPin,
      message: `Express herbal delivery available for pincode ${cleanPin} (3-5 business days).`
    };
  }

  return {
    valid: true,
    serviceable: false,
    pincode: cleanPin,
    message: `Delivery is currently not available for pincode ${cleanPin}. Please contact our WhatsApp helpline at +91 8641033514 for custom dispatch arrangements.`
  };
}

/**
 * Validates and sanitizes a complete delivery address object.
 * Accepts flexible field names for backward compatibility.
 */
function validateDeliveryAddress(rawAddress) {
  if (!rawAddress || typeof rawAddress !== 'object') {
    return {
      valid: false,
      errors: { address: 'Delivery address details are required.' },
      message: 'Delivery address details are required.'
    };
  }

  const errors = {};

  // Extract raw values
  const name = String(rawAddress.fullName || rawAddress.name || rawAddress.customerName || '').trim();
  const rawMobile = String(rawAddress.mobile || rawAddress.phone || rawAddress.customerPhone || '').trim();
  const email = String(rawAddress.email || rawAddress.customerEmail || '').trim().toLowerCase();
  const addressLine1 = String(rawAddress.addressLine1 || rawAddress.address_line1 || rawAddress.address || '').trim();
  const addressLine2 = String(rawAddress.addressLine2 || rawAddress.address_line2 || '').trim();
  const landmark = String(rawAddress.landmark || '').trim();
  const city = String(rawAddress.city || '').trim();
  const rawState = String(rawAddress.state || '').trim();
  const rawPincode = String(rawAddress.pincode || rawAddress.postalCode || '').trim();
  const label = String(rawAddress.label || 'Home').trim();

  // 1. Validate Full Name
  if (!name || name.length < 2) {
    errors.name = errors.fullName = 'Please provide full name of recipient (at least 2 characters).';
  } else if (name.length > 100) {
    errors.name = errors.fullName = 'Recipient name must not exceed 100 characters.';
  }

  // 2. Validate Mobile Number
  const normalizedPhone = normalizeIndianPhone(rawMobile);
  if (!normalizedPhone) {
    errors.mobile = errors.phone = 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).';
  }

  // 3. Validate Email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!email || !emailRegex.test(email)) {
    errors.email = 'Please provide a valid email address for order confirmation & tracking.';
  }

  // 4. Validate Address Line 1
  if (!addressLine1 || addressLine1.length < 5) {
    errors.addressLine1 = errors.address_line1 = 'Please enter House/Flat No., Building name, and Street (at least 5 characters).';
  } else if (addressLine1.length > 255) {
    errors.addressLine1 = errors.address_line1 = 'Address line 1 must not exceed 255 characters.';
  }

  // 5. Optional Address Line 2 & Landmark
  if (addressLine2 && addressLine2.length > 255) {
    errors.addressLine2 = 'Address line 2 must not exceed 255 characters.';
  }
  if (landmark && landmark.length > 255) {
    errors.landmark = 'Landmark must not exceed 255 characters.';
  }

  // 6. Validate City
  if (!city || city.length < 2) {
    errors.city = 'Please enter city / town / district name.';
  } else if (city.length > 100) {
    errors.city = 'City name must not exceed 100 characters.';
  }

  // 7. Validate State
  const matchedState = INDIAN_STATES_AND_UTS.find(
    s => s.toLowerCase() === rawState.toLowerCase()
  );
  if (!matchedState) {
    errors.state = 'Please select a valid Indian State or Union Territory from the dropdown.';
  }

  // 8. Validate Pincode & Serviceability
  const serviceability = checkPincodeServiceability(rawPincode);
  if (!serviceability.valid) {
    errors.pincode = serviceability.message;
  } else if (!serviceability.serviceable) {
    errors.pincode = serviceability.message;
  }

  if (Object.keys(errors).length > 0) {
    return {
      valid: false,
      errors,
      message: 'Please resolve the highlighted delivery address errors before placing order.'
    };
  }

  // Build clean sanitized snapshot object
  const sanitized = {
    label: label || 'Home',
    fullName: name,
    mobile: normalizedPhone,
    phone: normalizedPhone,
    email: email,
    addressLine1,
    addressLine2: addressLine2 || null,
    landmark: landmark || null,
    city,
    state: matchedState,
    pincode: rawPincode
  };

  const formatted = formatAddressString(sanitized);

  return {
    valid: true,
    errors: {},
    sanitized,
    formatted,
    snapshot: {
      ...sanitized,
      formatted
    }
  };
}

/**
 * Formats a delivery address into an official human-readable string
 */
function formatAddressString(addr) {
  if (!addr) return '';
  const parts = [];
  if (addr.fullName || addr.name) parts.push(addr.fullName || addr.name);
  if (addr.mobile || addr.phone) parts.push(`+91 ${addr.mobile || addr.phone}`);
  if (addr.addressLine1) parts.push(addr.addressLine1);
  if (addr.addressLine2) parts.push(addr.addressLine2);
  if (addr.landmark) parts.push(`Near ${addr.landmark}`);
  const cityStatePin = [addr.city, addr.state].filter(Boolean).join(', ');
  if (cityStatePin) {
    parts.push(addr.pincode ? `${cityStatePin} - ${addr.pincode}` : cityStatePin);
  } else if (addr.pincode) {
    parts.push(addr.pincode);
  }
  return parts.join(', ');
}

module.exports = {
  INDIAN_STATES_AND_UTS,
  normalizeIndianPhone,
  isValidIndianPincode,
  checkPincodeServiceability,
  validateDeliveryAddress,
  formatAddressString
};
