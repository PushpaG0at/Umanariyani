/**
 * UMANARAYNI AYURVEDA — Order Status State Machine
 * Defines valid lifecycle transitions for e-commerce orders and prevents illegal mutations.
 */

const ORDER_STATES = {
  PENDING: 'Pending',
  AWAITING_VERIFICATION: 'Awaiting_Verification',
  PAID: 'Paid',
  CONFIRMED: 'Confirmed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  FAILED: 'Failed',
  EXPIRED: 'Expired'
};

const VALID_TRANSITIONS = {
  // 1. Initial State
  [ORDER_STATES.PENDING]: [
    ORDER_STATES.AWAITING_VERIFICATION, // Manual UTR submitted
    ORDER_STATES.PAID,                  // PhonePe success callback / status
    ORDER_STATES.FAILED,                // Payment declined by bank
    ORDER_STATES.CANCELLED,             // Customer or system cancellation
    ORDER_STATES.EXPIRED                // Checkout session timeout
  ],

  // 2. Manual UPI / QR submission awaiting admin review
  [ORDER_STATES.AWAITING_VERIFICATION]: [
    ORDER_STATES.PAID,                  // Admin marks payment received
    ORDER_STATES.CONFIRMED,             // Admin confirms order
    ORDER_STATES.FAILED,                // Fake/invalid UTR rejected
    ORDER_STATES.CANCELLED,             // Rejected by admin with reason
    ORDER_STATES.EXPIRED                // Exceeded UTR verification SLA
  ],

  // 3. Payment Received
  [ORDER_STATES.PAID]: [
    ORDER_STATES.CONFIRMED,             // Pack & prepare order
    ORDER_STATES.CANCELLED              // Refunded / Customer cancelled before dispatch
  ],

  // 4. Order Confirmed & In Preparation
  [ORDER_STATES.CONFIRMED]: [
    ORDER_STATES.SHIPPED,               // Handed over to courier with tracking
    ORDER_STATES.CANCELLED              // Cancelled prior to pickup
  ],

  // 5. In Transit
  [ORDER_STATES.SHIPPED]: [
    ORDER_STATES.DELIVERED,             // Successfully delivered to customer
    ORDER_STATES.CANCELLED              // Return To Origin (RTO) / Lost in transit
  ],

  // 6. Terminal States (No further transitions allowed)
  [ORDER_STATES.DELIVERED]: [],
  [ORDER_STATES.FAILED]: [],
  [ORDER_STATES.CANCELLED]: [],
  [ORDER_STATES.EXPIRED]: []
};

/**
 * Validates whether transitioning from currentStatus to targetStatus is permitted.
 * Note: Same-state transitions (e.g. Paid -> Paid) are allowed as idempotent no-ops.
 */
function canTransition(currentStatus, targetStatus) {
  if (!currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true; // Idempotent no-op

  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) return false;

  return allowed.includes(targetStatus);
}

/**
 * Asserts valid transition, throwing a detailed descriptive error if illegal.
 */
function assertValidTransition(currentStatus, targetStatus, orderId = 'Unknown') {
  if (!canTransition(currentStatus, targetStatus)) {
    const allowed = (VALID_TRANSITIONS[currentStatus] || []).join(', ') || 'None (Terminal state)';
    const err = new Error(
      `Illegal Order Status Transition for Order '${orderId}': Cannot change from '${currentStatus}' to '${targetStatus}'. Permitted transitions: [${allowed}].`
    );
    err.code = 'INVALID_ORDER_STATE_TRANSITION';
    err.status = 400;
    err.currentStatus = currentStatus;
    err.targetStatus = targetStatus;
    throw err;
  }
}

module.exports = {
  ORDER_STATES,
  VALID_TRANSITIONS,
  canTransition,
  assertValidTransition
};
