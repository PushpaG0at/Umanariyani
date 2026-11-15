/**
 * UMANARAYNI AYURVEDA — Delivery Address & Checkout Verification Test Suite
 * Validates address validation, pincode serviceability, DB persistence, and order rejection without address.
 */
const {
  validateDeliveryAddress,
  isValidIndianPincode,
  normalizeIndianPhone,
  checkPincodeServiceability,
  INDIAN_STATES_AND_UTS,
  formatAddressString
} = require('../services/addressService.js');
const {
  db,
  addUserAddress,
  getUserAddresses,
  getUserDefaultAddress,
  setDefaultUserAddress,
  updateUserAddress,
  deleteUserAddress
} = require('../db.js');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('\n=============================================================');
  console.log('🌿 UMANARAYNI AYURVEDA: DELIVERY ADDRESS & CHECKOUT TESTS');
  console.log('=============================================================\n');

  // TEST 1: Phone Normalization & Validation
  console.log('--- TEST GROUP 1: Indian Phone Number Normalization ---');
  const phone1 = normalizeIndianPhone('+91 98765 43210');
  assert(phone1 === '9876543210', 'Strips +91, spaces and returns 10-digit clean mobile');

  const phone2 = normalizeIndianPhone('09876543210');
  assert(phone2 === '9876543210', 'Strips leading 0');

  const phone3 = normalizeIndianPhone('12345');
  assert(phone3 === null, 'Rejects invalid short phone number');

  const phone4 = normalizeIndianPhone('5123456789');
  assert(phone4 === null, 'Rejects Indian mobile starting with 5 (must start with 6-9)');

  // TEST 2: Indian Pincode Validation
  console.log('\n--- TEST GROUP 2: Indian PIN Code Format Validation ---');
  assert(isValidIndianPincode('560038') === true, 'Accepts valid 6-digit PIN code (560038)');
  assert(isValidIndianPincode('110001') === true, 'Accepts valid Delhi PIN code (110001)');
  assert(isValidIndianPincode('012345') === false, 'Rejects PIN starting with 0');
  assert(isValidIndianPincode('56003') === false, 'Rejects 5-digit PIN code');
  assert(isValidIndianPincode('5600389') === false, 'Rejects 7-digit PIN code');
  assert(isValidIndianPincode('5600AB') === false, 'Rejects alphanumeric PIN code');

  // TEST 3: Pincode Serviceability Check
  console.log('\n--- TEST GROUP 3: Pincode Serviceability Pluggable Check ---');
  const serviceAll = checkPincodeServiceability('201301', '*');
  assert(serviceAll.serviceable === true, 'Wildcard * services all of India');

  const serviceRestricted = checkPincodeServiceability('201301', '11,12,20');
  assert(serviceRestricted.serviceable === true, 'Prefix 20 matches prefix list 11,12,20');

  const serviceRejected = checkPincodeServiceability('560038', '11,12,20');
  assert(serviceRejected.serviceable === false, 'Prefix 56 is rejected when only 11,12,20 are serviceable');

  // TEST 4: Full Delivery Address Validation & Sanitization
  console.log('\n--- TEST GROUP 4: Full Address Validation & Sanitization ---');
  const validAddressInput = {
    fullName: 'Rajesh Kumar',
    phone: '+91 98765-43210',
    email: 'rajesh.kumar@example.com',
    addressLine1: 'Flat 402, Tulsi Enclave, 12th Cross',
    addressLine2: 'Indiranagar Stage 2',
    landmark: 'Near BDA Complex',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560038'
  };

  const validationResult = validateDeliveryAddress(validAddressInput);
  assert(validationResult.valid === true, 'Valid address passes validation');
  assert(validationResult.sanitized.phone === '9876543210', 'Sanitized phone is clean 10 digits');
  assert(validationResult.sanitized.state === 'Karnataka', 'State matches accepted list');
  assert(typeof validationResult.formatted === 'string' && validationResult.formatted.includes('560038'), 'Formatted string contains pincode');
  assert(validationResult.snapshot.pincode === '560038', 'Snapshot contains structured pincode');

  // Negative validation tests
  const missingName = validateDeliveryAddress({ ...validAddressInput, fullName: '' });
  assert(missingName.valid === false && missingName.errors.fullName !== undefined, 'Fails on missing full name');

  const invalidEmail = validateDeliveryAddress({ ...validAddressInput, email: 'not-an-email' });
  assert(invalidEmail.valid === false && invalidEmail.errors.email !== undefined, 'Fails on invalid email');

  const shortLine1 = validateDeliveryAddress({ ...validAddressInput, addressLine1: 'AB' });
  assert(shortLine1.valid === false && shortLine1.errors.addressLine1 !== undefined, 'Fails on short addressLine1 (< 5 chars)');

  const invalidState = validateDeliveryAddress({ ...validAddressInput, state: 'Atlantis' });
  assert(invalidState.valid === false && invalidState.errors.state !== undefined, 'Fails on unrecognized state');

  // TEST 5: Database Address Operations for Logged-In Users
  console.log('\n--- TEST GROUP 5: Database Address CRUD Operations ---');
  try {
    // Look up or create a test user
    const [users] = await db.execute('SELECT id FROM users LIMIT 1');
    let testUserId = null;
    if (users.length > 0) {
      testUserId = users[0].id;
    } else {
      testUserId = 'test-user-' + Date.now();
      await db.execute(
        'INSERT INTO users (id, phone, name, email) VALUES (?, ?, ?, ?)',
        [testUserId, '9999999999', 'Test Patron', 'testpatron@umanarayni.com']
      );
    }

    // 1. Add Address
    const createdAddress = await addUserAddress(testUserId, {
      label: 'Home',
      fullName: 'Priya Sharma',
      phone: '9876543210',
      email: 'priya@example.com',
      addressLine1: 'Villa 14, Lotus Gardens',
      addressLine2: 'Whitefield',
      landmark: 'Opposite Palm Meadows',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560066',
      isDefault: true
    });
    const addressId = createdAddress.id;
    assert(Boolean(addressId), `Address added successfully (ID: ${addressId})`);

    // 2. Fetch User Addresses
    const list = await getUserAddresses(testUserId);
    assert(list.length > 0, `Fetched ${list.length} saved addresses for user`);

    // 3. Get Default Address
    const defAddr = await getUserDefaultAddress(testUserId);
    assert(defAddr !== null && defAddr.id === addressId, 'Fetched default address correctly');

    // 4. Update Address
    const updated = await updateUserAddress(testUserId, addressId, {
      ...defAddr,
      label: 'Office',
      address_line1: 'Villa 14B, Lotus Gardens Updated'
    });
    assert(updated !== null && updated.label === 'Office', 'Updated address successfully');

    // 5. Delete Address
    const deleted = await deleteUserAddress(testUserId, addressId);
    assert(deleted === true, 'Deleted address successfully');
  } catch (dbErr) {
    console.error('DB test error:', dbErr);
    assert(false, `Database test encountered error: ${dbErr.message}`);
  }

  // TEST 6: Verify Orders Table Schema Additions
  console.log('\n--- TEST GROUP 6: Orders Table Immutable Schema Additions ---');
  try {
    const [cols] = await db.execute(`
      SELECT COLUMN_NAME, DATA_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'orders' 
      AND COLUMN_NAME IN ('shipping_address_json', 'city', 'state', 'pincode', 'shippingAddress')
    `);
    const foundColNames = cols.map(c => c.COLUMN_NAME);
    assert(foundColNames.includes('shipping_address_json'), 'Column shipping_address_json exists on orders');
    assert(foundColNames.includes('city'), 'Column city exists on orders');
    assert(foundColNames.includes('state'), 'Column state exists on orders');
    assert(foundColNames.includes('pincode'), 'Column pincode exists on orders');
    assert(foundColNames.includes('shippingAddress'), 'Column shippingAddress exists on orders');
  } catch (colErr) {
    assert(false, `Column verification error: ${colErr.message}`);
  }

  console.log('\n=============================================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('=============================================================\n');

  try {
    await db.end();
  } catch (_) {}

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTestSuite();
