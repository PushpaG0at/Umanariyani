/**
 * UMANARAYNI AYURVEDA — Stock Management & Inventory Reservation Service
 * Implements pessimistic row-level locking (SELECT ... FOR UPDATE) and atomic inventory transactions
 * to prevent overselling, race conditions, and phantom inventory.
 */

/**
 * Reserves stock for an array of cart items within a DB transaction using pessimistic locking.
 * Throws an error if any requested item has insufficient inventory.
 * 
 * @param {Array} items Cart items array [{ id, quantity, ... }]
 * @param {object} connection Active mysql2 connection with an open transaction
 * @returns {Promise<{ verifiedSubtotal: number, verifiedItems: Array }>}
 */
async function reserveStockForItems(items, connection) {
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('No items specified for stock reservation');
  }

  const itemIds = items.map(item => item.id).filter(Boolean);
  if (itemIds.length === 0) {
    throw new Error('Invalid cart items format for stock check');
  }

  // 1. Acquire pessimistic row-level lock on the requested catalog products
  const [rows] = await connection.query(
    'SELECT id, name, price, volume, inStock, stockCount FROM products WHERE id IN (?) FOR UPDATE',
    [itemIds]
  );

  const productMap = new Map();
  rows.forEach(p => productMap.set(p.id, p));

  let verifiedSubtotal = 0;
  const verifiedItems = [];

  // 2. Validate availability and decrement reserved inventory atomically
  for (const item of items) {
    const prod = productMap.get(item.id);
    if (!prod) {
      const err = new Error(`Formulation "${item.id}" is no longer active in the catalog.`);
      err.code = 'PRODUCT_NOT_FOUND';
      err.status = 404;
      throw err;
    }

    const requestedQty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const availableStock = Number(prod.stockCount) || 0;

    // Reject if product is marked out of stock or requested quantity exceeds available inventory
    if (!Boolean(prod.inStock) || availableStock < requestedQty) {
      const err = new Error(
        `Insufficient stock for "${prod.name}". Only ${availableStock} units remaining (requested: ${requestedQty}).`
      );
      err.code = 'INSUFFICIENT_STOCK';
      err.status = 409;
      err.productId = prod.id;
      err.availableStock = availableStock;
      err.requestedQuantity = requestedQty;
      throw err;
    }

    // 3. Atomically deduct inventory from available stock
    const newStock = availableStock - requestedQty;
    const stillInStock = newStock > 0;

    await connection.query(
      'UPDATE products SET stockCount = ?, inStock = ?, updated_at = NOW() WHERE id = ?',
      [newStock, stillInStock, prod.id]
    );

    const price = Number(prod.price);
    const lineTotal = price * requestedQty;
    verifiedSubtotal += lineTotal;

    verifiedItems.push({
      id: prod.id,
      name: prod.name,
      price,
      volume: prod.volume,
      quantity: requestedQty,
      itemTotal: lineTotal
    });
  }

  return { verifiedSubtotal, verifiedItems };
}

/**
 * Releases reserved stock back to the active catalog when an order fails, is cancelled, or expires.
 * 
 * @param {Array|string} items Items array or JSON string from order record
 * @param {object} connection Active mysql2 connection or pool
 */
async function releaseReservedStock(items, connection) {
  let parsedItems = items;
  if (typeof items === 'string') {
    try {
      parsedItems = JSON.parse(items);
    } catch (_) {
      return;
    }
  }

  if (!Array.isArray(parsedItems) || parsedItems.length === 0) return;

  for (const item of parsedItems) {
    if (!item.id) continue;
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);

    await connection.query(
      `UPDATE products 
       SET stockCount = stockCount + ?, inStock = TRUE, updated_at = NOW() 
       WHERE id = ?`,
      [qty, item.id]
    );
  }
}

module.exports = {
  reserveStockForItems,
  releaseReservedStock
};
