/**
 * UMANARAYNI AYURVEDA — PAYMENT & ORDER INTEGRITY TEST SUITE
 * Tests:
 * 1. PhonePe Webhook signature verification & tampering detection
 * 2. Order status state machine transitions & rejection of invalid flows
 * 3. Server-side promo code validation, expiry, and min-cart enforcement
 * 4. Stock reservation and release logic (preventing overselling)
 * 5. Idempotent payment transition guards
 */

const assert = require('node:assert');
const crypto = require('node:crypto');
const { ORDER_STATES, canTransition, assertValidTransition } = require('../services/orderStateMachine');
const { validatePromoCode } = require('../services/promoService');
const { verifyS2SCallback } = require('../services/phonepe');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] ${name}:`, err.message);
    failedTests++;
  }
}

async function main() {
  console.log('\n--- 1. Testing PhonePe Webhook Signature & Checksum ---');

  runTest('Valid PhonePe S2S webhook signature is accepted', () => {
    const saltKey = process.env.PHONEPE_SALT_KEY || '96434309-7796-489d-8924-ab56988a6076';
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const samplePayload = JSON.stringify({
      response: {
        code: 'PAYMENT_SUCCESS',
        merchantId: 'TEST_MERCHANT',
        transactionId: 'TXN_TEST_1001',
        amount: 49900
      }
    });
    const base64Payload = Buffer.from(samplePayload).toString('base64');
    const expectedHash = crypto.createHash('sha256').update(base64Payload + saltKey).digest('hex');
    const validXVerify = `${expectedHash}###${saltIndex}`;

    const res = verifyS2SCallback({
      responseBase64: base64Payload,
      xVerify: validXVerify
    });

    assert.strictEqual(res.isValid, true, 'Valid signature must return true');
  });

  runTest('Tampered payload is rejected by PhonePe checksum validator', () => {
    const saltKey = process.env.PHONEPE_SALT_KEY || '96434309-7796-489d-8924-ab56988a6076';
    const saltIndex = process.env.PHONEPE_SALT_INDEX || '1';
    const originalPayload = Buffer.from('{"amount": 49900}').toString('base64');
    const tamperedPayload = Buffer.from('{"amount": 99900}').toString('base64');
    const originalHash = crypto.createHash('sha256').update(originalPayload + saltKey).digest('hex');
    const xVerify = `${originalHash}###${saltIndex}`;

    const res = verifyS2SCallback({
      responseBase64: tamperedPayload,
      xVerify
    });

    assert.strictEqual(res.isValid, false, 'Tampered payload must return false');
  });

  runTest('Missing or malformed X-VERIFY header is rejected', () => {
    assert.strictEqual(verifyS2SCallback({ responseBase64: 'abc', xVerify: '' }).isValid, false);
    assert.strictEqual(verifyS2SCallback({ responseBase64: '', xVerify: 'xyz###1' }).isValid, false);
    assert.strictEqual(verifyS2SCallback({ responseBase64: 'abc', xVerify: 'no-separator' }).isValid, false);
  });

  console.log('\n--- 2. Testing Order Status State Machine ---');

  runTest('Valid forward order transitions are permitted', () => {
    assert.strictEqual(canTransition('Pending', 'Paid'), true);
    assert.strictEqual(canTransition('Pending', 'Awaiting_Verification'), true);
    assert.strictEqual(canTransition('Awaiting_Verification', 'Paid'), true);
    assert.strictEqual(canTransition('Paid', 'Confirmed'), true);
    assert.strictEqual(canTransition('Confirmed', 'Shipped'), true);
    assert.strictEqual(canTransition('Shipped', 'Delivered'), true);
  });

  runTest('Invalid backward and illegal transitions are rejected', () => {
    assert.strictEqual(canTransition('Delivered', 'Pending'), false);
    assert.strictEqual(canTransition('Cancelled', 'Confirmed'), false);
    assert.strictEqual(canTransition('Failed', 'Paid'), false);
    assert.strictEqual(canTransition('Delivered', 'Cancelled'), false);
  });

  runTest('assertValidTransition throws on invalid transition', () => {
    assert.throws(() => {
      assertValidTransition('Delivered', 'Pending');
    }, /Illegal Order Status Transition/i);
  });

  runTest('Idempotent self-transitions are accepted', () => {
    assert.strictEqual(canTransition('Paid', 'Paid'), true);
    assert.strictEqual(canTransition('Confirmed', 'Confirmed'), true);
    assert.strictEqual(canTransition('Delivered', 'Delivered'), true);
  });

  console.log('\n--- 3. Testing Server-Side Promo Code Validation ---');

  await runAsyncTest('Valid AYUR10 promo applies 10% discount on carts over ₹499', async () => {
    const result = await validatePromoCode('AYUR10', 1000);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.discountAmount, 100);
    assert.strictEqual(result.finalPayable, 900);
  });

  await runAsyncTest('Promo code is rejected if cart subtotal is below minimum requirement', async () => {
    const result = await validatePromoCode('AYUR10', 300); // AYUR10 requires min ₹499
    assert.strictEqual(result.valid, false);
    assert.match(result.message, /minimum cart subtotal/i);
  });

  await runAsyncTest('Fixed discount code WELCOME50 applies ₹50 deduction', async () => {
    const result = await validatePromoCode('WELCOME50', 500);
    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.discountAmount, 50);
    assert.strictEqual(result.finalPayable, 450);
  });

  await runAsyncTest('Invalid promo code returns descriptive rejection', async () => {
    const result = await validatePromoCode('NONEXISTENT_CODE_XYZ', 1500);
    assert.strictEqual(result.valid, false);
    assert.match(result.message, /not recognized|does not exist/i);
  });

  console.log('\n--- 4. Testing Stock Reservation & Idempotency Simulation ---');

  runTest('Simulated stock reservation prevents overselling and handles concurrency', () => {
    const inventory = {
      'neelibhringadi-oil': { stockCount: 5, reservedStock: 0 },
      'amla-shampoo': { stockCount: 1, reservedStock: 0 }
    };

    function simulateReserve(item, qty) {
      const row = inventory[item];
      if (!row) throw new Error('Product not found');
      const available = row.stockCount - row.reservedStock;
      if (available < qty) {
        throw new Error(`Insufficient stock: requested ${qty}, available ${available}`);
      }
      row.reservedStock += qty;
      return true;
    }

    function simulateRelease(item, qty) {
      const row = inventory[item];
      if (row) {
        row.reservedStock = Math.max(0, row.reservedStock - qty);
      }
    }

    function simulateFinalize(item, qty) {
      const row = inventory[item];
      if (row) {
        row.stockCount = Math.max(0, row.stockCount - qty);
        row.reservedStock = Math.max(0, row.reservedStock - qty);
      }
    }

    // First customer reserves 1 amla-shampoo -> succeeds
    simulateReserve('amla-shampoo', 1);
    assert.strictEqual(inventory['amla-shampoo'].reservedStock, 1);

    // Second customer tries to reserve same amla-shampoo -> fails (oversell prevented)
    assert.throws(() => {
      simulateReserve('amla-shampoo', 1);
    }, /Insufficient stock/);

    // First customer payment fails or order expires -> stock is released
    simulateRelease('amla-shampoo', 1);
    assert.strictEqual(inventory['amla-shampoo'].reservedStock, 0);

    // Now customer can reserve again
    simulateReserve('amla-shampoo', 1);
    // Order paid -> finalized
    simulateFinalize('amla-shampoo', 1);
    assert.strictEqual(inventory['amla-shampoo'].stockCount, 0);
    assert.strictEqual(inventory['amla-shampoo'].reservedStock, 0);
  });

  runTest('Idempotent callback execution prevents duplicate processing', () => {
    let executedCount = 0;
    let orderState = { id: 101, paymentStatus: 'Pending', orderStatus: 'Pending', paymentProcessedAt: null };

    function processPaymentCallback(order, incomingStatus) {
      if (order.paymentStatus === incomingStatus) {
        return { skipped: true, order };
      }
      order.paymentStatus = incomingStatus;
      order.orderStatus = incomingStatus === 'Paid' ? 'Confirmed' : 'Failed';
      order.paymentProcessedAt = new Date().toISOString();
      executedCount++;
      return { skipped: false, order };
    }

    // First callback from PhonePe S2S webhook
    const res1 = processPaymentCallback(orderState, 'Paid');
    assert.strictEqual(res1.skipped, false);
    assert.strictEqual(executedCount, 1);

    // Duplicate callback from network retry or browser redirect
    const res2 = processPaymentCallback(orderState, 'Paid');
    assert.strictEqual(res2.skipped, true);
    assert.strictEqual(executedCount, 1, 'Duplicate callback must NOT execute side-effects again');
  });

  console.log('\n========================================');
  console.log(`Test Results: ${passedTests} passed, ${failedTests} failed.`);
  console.log('========================================\n');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
