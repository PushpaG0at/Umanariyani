require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Robust CORS configuration supporting cross-origin frontends, preflights, and credentials
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl) or any web origin in dev/prod
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-session-id'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // Cache preflight checks for 24h
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Safe API Key resolver
function getApiKey() {
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return process.env.GEMINI_API_KEY.trim();
  }
  try {
    const raw = fs.readFileSync(path.join(__dirname, '.env'), 'utf8').trim();
    const match = raw.match(/GEMINI_API_KEY\s*=\s*(.+)/);
    if (match) return match[1].trim();
  } catch (e) {}
  return process.env.GEMINI_API_KEY || "";
}

// Real-time actual active visitors tracking (Session-aware, synchronized across all users)
const activeSessions = new Map(); // sessionId -> { lastSeen: number, responses: Set }

function cleanStaleSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions.entries()) {
    // If no active connections and last seen more than 15s ago, remove
    if (session.responses.size === 0 && now - session.lastSeen > 15000) {
      activeSessions.delete(id);
    }
  }
}

function getActualActiveUserCount() {
  cleanStaleSessions();
  // Return actual unique sessions count (minimum 1 when requested by a browsing visitor)
  return Math.max(1, activeSessions.size);
}

function broadcastActiveUserCount() {
  const count = getActualActiveUserCount();
  const payload = `data: ${JSON.stringify({ activeUsers: count })}\n\n`;
  for (const session of activeSessions.values()) {
    for (const clientRes of session.responses) {
      try {
        clientRes.write(payload);
      } catch (err) {
        session.responses.delete(clientRes);
      }
    }
  }
}

// Data formatters for MySQL query results
function formatProduct(p) {
  if (!p) return null;
  const parseJsonField = (field, fallback = []) => {
    if (!field) return fallback;
    if (Array.isArray(field) || typeof field === 'object') return field;
    try {
      return JSON.parse(field);
    } catch {
      return fallback;
    }
  };

  return {
    ...p,
    price: Number(p.price),
    mrp: p.mrp != null ? Number(p.mrp) : undefined,
    discountPercent: Number(p.discountPercent) || 0,
    rating: Number(p.rating) || 5.0,
    ratingCount: Number(p.ratingCount) || 0,
    stockCount: Number(p.stockCount) || 0,
    inStock: Boolean(p.inStock),
    gallery: parseJsonField(p.gallery, [p.image || "images/ayurvedic_herbs_circle.jpg"]),
    keyBenefits: parseJsonField(p.keyBenefits, []),
    featuredIngredients: parseJsonField(p.featuredIngredients, []),
    ingredientsDetails: parseJsonField(p.ingredientsDetails, []),
    usageSteps: parseJsonField(p.usageSteps, []),
    certifications: parseJsonField(p.certifications, []),
    faqs: parseJsonField(p.faqs, []),
  };
}

function formatHerb(h) {
  if (!h) return null;
  const parseJsonField = (field, fallback = []) => {
    if (!field) return fallback;
    if (Array.isArray(field) || typeof field === 'object') return field;
    try {
      return JSON.parse(field);
    } catch {
      return fallback;
    }
  };

  return {
    ...h,
    benefits: parseJsonField(h.benefits, []),
    presentIn: parseJsonField(h.presentIn, []),
  };
}

function formatReview(r) {
  if (!r) return null;
  return {
    ...r,
    rating: Number(r.rating) || 5,
    helpfulCount: Number(r.helpfulCount) || 0,
    verifiedPurchase: Boolean(r.verifiedPurchase),
  };
}

/* ==================== API ROUTES ==================== */

// 1. Get all products (with optional category and search filtering via MySQL)
app.get('/api/products', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category && category !== 'all') {
      query += ' AND (categorySlug = ? OR LOWER(category) = LOWER(?))';
      params.push(category, category);
    }

    if (search) {
      const q = `%${search.toLowerCase().trim()}%`;
      query += ' AND (LOWER(name) LIKE ? OR LOWER(subtitle) LIKE ? OR LOWER(shortDescription) LIKE ? OR JSON_SEARCH(LOWER(featuredIngredients), "one", ?) IS NOT NULL)';
      params.push(q, q, q, q);
    }

    query += ' ORDER BY created_at DESC';

    const [rows] = await db.query(query, params);
    const products = rows.map(formatProduct);

    res.json({
      success: true,
      count: products.length,
      products: products
    });
  } catch (err) {
    console.error('Error fetching products from MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error fetching products' });
  }
});

// 2. Get single product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.json({
      success: true,
      product: formatProduct(rows[0])
    });
  } catch (err) {
    console.error('Error fetching product by ID from MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error fetching product' });
  }
});

// 3. Add new product to MySQL
app.post('/api/products', async (req, res) => {
  try {
    const {
      name,
      subtitle,
      category,
      price,
      mrp,
      volume,
      image,
      shortDescription,
      description,
      keyBenefits,
      featuredIngredients,
      howToUse,
      suitableFor
    } = req.body;

    if (!name || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Product name, price, and category are required'
      });
    }

    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `prod-${Date.now()}`;

    // Check duplicate
    const [existing] = await db.query('SELECT id FROM products WHERE id = ?', [id]);
    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A product with a similar name already exists'
      });
    }

    const calculatedMrp = mrp || Math.round(Number(price) * 1.3);
    const discountPercent = Math.round(((calculatedMrp - Number(price)) / calculatedMrp) * 100);

    const [countRows] = await db.query('SELECT COUNT(*) AS total FROM products');
    const totalCount = countRows[0].total || 0;

    const newProduct = {
      id,
      name: name.toUpperCase(),
      subtitle: subtitle || "Pure Ayurvedic Formulation",
      tagline: "Pure Nature, Pure Care.",
      category,
      categorySlug: category.toLowerCase().replace(/\s+/g, '-'),
      price: Number(price),
      mrp: calculatedMrp,
      discountPercent,
      rating: 5.0,
      ratingCount: 1,
      badge: "New Launch",
      volume: volume || "200 ml",
      image: image || "images/ayurvedic_herbs_circle.jpg",
      gallery: [image || "images/ayurvedic_herbs_circle.jpg"],
      inStock: true,
      stockCount: 50,
      asin: `B09AYURV${totalCount + 1}`,
      shortDescription: shortDescription || description || "Handcrafted traditional Ayurvedic formula.",
      description: description || shortDescription || "Handcrafted traditional Ayurvedic formula.",
      keyBenefits: Array.isArray(keyBenefits) ? keyBenefits : (keyBenefits ? keyBenefits.split('\n').filter(Boolean) : ["100% Herbal nourishment", "Safe & gentle for regular use"]),
      featuredIngredients: Array.isArray(featuredIngredients) ? featuredIngredients : (featuredIngredients ? featuredIngredients.split(',').map(s => s.trim()) : ["Ayurvedic Botanical Extracts"]),
      ingredientsDetails: [],
      howToUse: howToUse || "Apply as directed on packaging. Suitable for daily use.",
      usageSteps: [],
      suitableFor: suitableFor || "Suitable for all hair and skin types.",
      certifications: [
        "100% Ayurvedic Formula",
        "Cruelty Free & Paraben Free",
        "Authentic Classical Extraction"
      ],
      faqs: []
    };

    await db.query(`
      INSERT INTO products (
        id, name, subtitle, tagline, category, categorySlug, price, mrp, discountPercent,
        rating, ratingCount, badge, volume, image, gallery, inStock, stockCount, asin,
        shortDescription, description, keyBenefits, featuredIngredients, ingredientsDetails,
        howToUse, usageSteps, suitableFor, certifications, faqs
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newProduct.id,
      newProduct.name,
      newProduct.subtitle,
      newProduct.tagline,
      newProduct.category,
      newProduct.categorySlug,
      newProduct.price,
      newProduct.mrp,
      newProduct.discountPercent,
      newProduct.rating,
      newProduct.ratingCount,
      newProduct.badge,
      newProduct.volume,
      newProduct.image,
      JSON.stringify(newProduct.gallery),
      newProduct.inStock,
      newProduct.stockCount,
      newProduct.asin,
      newProduct.shortDescription,
      newProduct.description,
      JSON.stringify(newProduct.keyBenefits),
      JSON.stringify(newProduct.featuredIngredients),
      JSON.stringify(newProduct.ingredientsDetails),
      newProduct.howToUse,
      JSON.stringify(newProduct.usageSteps),
      newProduct.suitableFor,
      JSON.stringify(newProduct.certifications),
      JSON.stringify(newProduct.faqs)
    ]);

    res.status(201).json({
      success: true,
      message: 'Product added successfully to MySQL',
      product: newProduct
    });
  } catch (err) {
    console.error('Error inserting product into MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error adding product' });
  }
});

// 3b. Update product (price, stock, details)
app.put('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { price, mrp, inStock, stockCount, name, subtitle, category } = req.body;

    const [existing] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const current = existing[0];
    const newPrice = price !== undefined ? Number(price) : Number(current.price);
    const newMrp = mrp !== undefined ? Number(mrp) : Number(current.mrp);
    const discountPercent = Math.round(((newMrp - newPrice) / newMrp) * 100);

    await db.query(`
      UPDATE products SET
        name = COALESCE(?, name),
        subtitle = COALESCE(?, subtitle),
        category = COALESCE(?, category),
        price = ?,
        mrp = ?,
        discountPercent = ?,
        inStock = COALESCE(?, inStock),
        stockCount = COALESCE(?, stockCount)
      WHERE id = ?
    `, [
      name || null,
      subtitle || null,
      category || null,
      newPrice,
      newMrp,
      discountPercent,
      inStock !== undefined ? Boolean(inStock) : null,
      stockCount !== undefined ? Number(stockCount) : null,
      id
    ]);

    const [updated] = await db.query('SELECT * FROM products WHERE id = ?', [id]);
    res.json({
      success: true,
      message: 'Product updated successfully',
      product: formatProduct(updated[0])
    });
  } catch (err) {
    console.error('Error updating product:', err);
    res.status(500).json({ success: false, message: 'Database error updating product' });
  }
});

// 3c. Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await db.query('DELETE FROM products WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted successfully', id });
  } catch (err) {
    console.error('Error deleting product:', err);
    res.status(500).json({ success: false, message: 'Database error deleting product' });
  }
});

// 4. Get revolving herbs
app.get('/api/herbs', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM herbs ORDER BY id ASC');
    res.json({
      success: true,
      herbs: rows.map(formatHerb)
    });
  } catch (err) {
    console.error('Error fetching herbs from MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error fetching herbs' });
  }
});

// 4b. Get single herb by ID
app.get('/api/herbs/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM herbs WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Herb not found' });
    }
    res.json({
      success: true,
      herb: formatHerb(rows[0])
    });
  } catch (err) {
    console.error('Error fetching herb:', err);
    res.status(500).json({ success: false, message: 'Database error fetching herb' });
  }
});

// 5. Active users count (Actual connected visitors)
app.get('/api/users/active', (req, res) => {
  const sessionId = req.query.sessionId || req.ip;
  if (sessionId) {
    if (!activeSessions.has(sessionId)) {
      activeSessions.set(sessionId, { lastSeen: Date.now(), responses: new Set() });
    } else {
      activeSessions.get(sessionId).lastSeen = Date.now();
    }
  }
  const activeCount = getActualActiveUserCount();
  res.json({
    success: true,
    activeUsers: activeCount,
    timestamp: new Date().toISOString(),
    message: `${activeCount} Nature Lover${activeCount === 1 ? '' : 's'} currently exploring Umanarayani Ayurveda`
  });
});

// 6. Server-Sent Events (SSE) for live active user updates in real-time
app.get('/api/users/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sessionId = req.query.sessionId || req.ip || `client_${Date.now()}_${Math.random()}`;

  if (!activeSessions.has(sessionId)) {
    activeSessions.set(sessionId, { lastSeen: Date.now(), responses: new Set() });
  }

  const session = activeSessions.get(sessionId);
  session.lastSeen = Date.now();
  session.responses.add(res);

  // Broadcast immediate actual count to all connected browsers
  broadcastActiveUserCount();

  // Heartbeat comment every 15s to keep the socket alive
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch {
      clearInterval(heartbeat);
    }
  }, 15000);

  req.on('close', () => {
    clearInterval(heartbeat);
    session.responses.delete(res);
    if (session.responses.size === 0) {
      session.lastSeen = Date.now();
      setTimeout(() => {
        cleanStaleSessions();
        broadcastActiveUserCount();
      }, 1000);
    }
  });
});

// 7. Reviews API
app.get('/api/reviews/:productId', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM reviews WHERE productId = ? ORDER BY created_at DESC',
      [req.params.productId]
    );

    res.json({
      success: true,
      count: rows.length,
      reviews: rows.map(formatReview)
    });
  } catch (err) {
    console.error('Error fetching reviews from MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error fetching reviews' });
  }
});

app.post('/api/reviews/:productId', async (req, res) => {
  try {
    const { author, rating, title, body, location } = req.body;
    if (!author || !rating || !body) {
      return res.status(400).json({ success: false, message: 'Author, rating, and review text are required' });
    }

    const productId = req.params.productId;
    const newReview = {
      id: `rev_${Date.now()}`,
      productId,
      author,
      location: location || "India",
      rating: Number(rating),
      date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      title: title || "Verified Customer Review",
      body,
      verifiedPurchase: true,
      helpfulCount: 0
    };

    await db.query(`
      INSERT INTO reviews (id, productId, author, location, rating, date, title, body, verifiedPurchase, helpfulCount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      newReview.id,
      newReview.productId,
      newReview.author,
      newReview.location,
      newReview.rating,
      newReview.date,
      newReview.title,
      newReview.body,
      newReview.verifiedPurchase,
      newReview.helpfulCount
    ]);

    // Recalculate average rating & count for the product
    try {
      const [stats] = await db.query(
        'SELECT AVG(rating) AS avgRating, COUNT(*) AS countReviews FROM reviews WHERE productId = ?',
        [productId]
      );
      if (stats.length > 0 && stats[0].countReviews > 0) {
        const avg = Number(stats[0].avgRating).toFixed(1);
        const count = Number(stats[0].countReviews);
        await db.query('UPDATE products SET rating = ?, ratingCount = ? WHERE id = ?', [avg, count, productId]);
      }
    } catch (e) {
      console.warn('Could not update product rating aggregate:', e.message);
    }

    res.status(201).json({
      success: true,
      message: 'Review posted successfully',
      review: newReview
    });
  } catch (err) {
    console.error('Error posting review to MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error posting review' });
  }
});

// 8. Authentication: Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, dosha, hairType } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
    }

    const [existing] = await db.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists' });
    }

    const newUser = {
      id: `usr_${Date.now()}`,
      name,
      email: email.toLowerCase(),
      password,
      dosha: dosha || "Balanced Tridosha",
      hairType: hairType || "Normal",
      avatar: ["🌿", "🌸", "🍃", "✨", "🌺"][Math.floor(Math.random() * 5)],
    };

    await db.query(`
      INSERT INTO users (id, name, email, password, dosha, hairType, avatar, joinedDate)
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      newUser.id,
      newUser.name,
      newUser.email,
      newUser.password,
      newUser.dosha,
      newUser.hairType,
      newUser.avatar
    ]);

    res.status(201).json({
      success: true,
      message: 'Welcome to Umanarayani Ayurveda community!',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        dosha: newUser.dosha,
        hairType: newUser.hairType,
        avatar: newUser.avatar
      }
    });
  } catch (err) {
    console.error('Error registering user in MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error registering account' });
  }
});

// 9. Authentication: Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }

    const [rows] = await db.query(
      'SELECT * FROM users WHERE LOWER(email) = LOWER(?) AND password = ?',
      [email, password]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    const user = rows[0];
    res.json({
      success: true,
      message: 'Namaste! Login successful',
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        dosha: user.dosha,
        hairType: user.hairType,
        avatar: user.avatar || "🌿"
      },
      activeUsersCount: getActualActiveUserCount()
    });
  } catch (err) {
    console.error('Error logging in user in MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error logging in' });
  }
});

// 10. Orders API (Production e-commerce order management)
app.post('/api/orders', async (req, res) => {
  try {
    const {
      userId,
      customerName,
      customerEmail,
      customerPhone,
      shippingAddress,
      items,
      subtotal,
      discount,
      tax,
      shippingFee,
      total,
      paymentMethod
    } = req.body;

    if (!customerName || !customerEmail || !items || !total) {
      return res.status(400).json({ success: false, message: 'Missing required order details' });
    }

    const orderId = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await db.query(`
      INSERT INTO orders (
        id, userId, customerName, customerEmail, customerPhone, shippingAddress,
        items, subtotal, discount, tax, shippingFee, total, paymentMethod
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderId,
      userId || null,
      customerName,
      customerEmail,
      customerPhone || '',
      shippingAddress || '',
      JSON.stringify(items),
      Number(subtotal || total),
      Number(discount || 0),
      Number(tax || 0),
      Number(shippingFee || 0),
      Number(total),
      paymentMethod || 'COD'
    ]);

    res.status(201).json({
      success: true,
      message: 'Order created successfully in database',
      orderId
    });
  } catch (err) {
    console.error('Error creating order in MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error creating order' });
  }
});

// 10b. Get orders (all or filtered by userId / email)
app.get('/api/orders', async (req, res) => {
  try {
    const { userId, email } = req.query;
    let query = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (userId) {
      query += ' AND userId = ?';
      params.push(userId);
    } else if (email) {
      query += ' AND LOWER(customerEmail) = LOWER(?)';
      params.push(email);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const [rows] = await db.query(query, params);
    const orders = rows.map(o => ({
      ...o,
      items: typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items,
      subtotal: Number(o.subtotal),
      discount: Number(o.discount),
      tax: Number(o.tax),
      shippingFee: Number(o.shippingFee),
      total: Number(o.total)
    }));

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (err) {
    console.error('Error fetching orders from MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error fetching orders' });
  }
});

// 10c. Get single order by ID
app.get('/api/orders/:id', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }
    const o = rows[0];
    res.json({
      success: true,
      order: {
        ...o,
        items: typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items,
        subtotal: Number(o.subtotal),
        discount: Number(o.discount),
        tax: Number(o.tax),
        shippingFee: Number(o.shippingFee),
        total: Number(o.total)
      }
    });
  } catch (err) {
    console.error('Error fetching order by ID from MySQL:', err);
    res.status(500).json({ success: false, message: 'Database error fetching order' });
  }
});

// 11. WhatsApp Inquiry Helper / Analytics
app.post('/api/inquiry/whatsapp', (req, res) => {
  const { productId, queryType, message } = req.body;
  console.log(`[WhatsApp Inquiry Click] Product: ${productId}, Type: ${queryType}, Msg: ${message}`);
  res.json({
    success: true,
    whatsappNumber: "+918641033514",
    link: `https://wa.me/918641033514?text=${encodeURIComponent(message || 'Hello Umanarayani! I would like to consult about your Ayurvedic personal care products.')}`
  });
});

/* ==================== 12. GEMINI AI AYURVEDIC CONSULTANT ==================== */
// Real-time AI consultation powered by Google Gemini and live MySQL data
app.post('/api/ai/consult', async (req, res) => {
  const { message, productId, userDosha, conversationHistory } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  // Fetch live products and herbs from MySQL
  let products = [];
  let herbs = [];
  try {
    const [pRows] = await db.query('SELECT * FROM products');
    const [hRows] = await db.query('SELECT * FROM herbs');
    products = pRows.map(formatProduct);
    herbs = hRows.map(formatHerb);
  } catch (err) {
    console.error('Error querying catalog for Gemini AI context:', err.message);
  }

  const apiKey = getApiKey();

  // Build product and herbal context for Gemini
  const productCatalogText = products.map(p => `
* ${p.name} (${p.subtitle || ''}) - Price: ₹${p.price} (M.R.P. ₹${p.mrp || ''}, ${p.discountPercent}% OFF)
  Volume: ${p.volume || '200ml'}
  Short Description: ${p.shortDescription}
  Key Ingredients: ${(p.featuredIngredients || []).join(', ')}
  Benefits: ${(p.keyBenefits || []).join('; ')}
  Application Ritual: ${p.howToUse}
  Suitable For: ${p.suitableFor || 'All types'}
`).join('\n');

  const herbDetailsText = herbs.map(h => `
* ${h.name} (${h.hindi || ''}) - Botanical: ${h.botanical || ''}
  Ayurvedic Action: ${h.tagline || ''}
  Role: ${h.role || ''}
  Benefits: ${(h.benefits || []).join(', ')}
  Present in Umanarayani Products: ${(h.presentIn || []).join(', ')}
`).join('\n');

  let activeProductContext = "";
  if (productId) {
    const p = products.find(prod => prod.id === productId);
    if (p) {
      activeProductContext = `\n[CURRENT PRODUCT IN VIEW]: The user is currently browsing "${p.name}". Price: ₹${p.price}. Key Herbs: ${(p.featuredIngredients || []).join(', ')}. Key Benefits: ${(p.keyBenefits || []).join('; ')}. If their question relates to this product, provide specific guidance for it.`;
    }
  }

  const systemInstruction = `You are "Umanarayani AI Vaidya" (उमानारायणी आयुर्वेदिक AI विशेषज्ञ), the official virtual Ayurvedic Herbal Care Specialist and Product Consultant for UMANARAYANI HERBAL PRODUCTS (Tagline: "Pure Nature, Pure Care"). You provide classical botanical wisdom, herbal ingredient guidance, and daily personal care routine recommendations for hair, skin, and scalp wellness. Never claim medical qualifications or provide clinical treatments; provide authentic Ayurvedic personal care and formulation advice.

Brand & Classical Product Formulations (from Database):
${productCatalogText}

The Eight Sacred Revolving Herbs:
${herbDetailsText}
${activeProductContext}
${userDosha ? `\nUser's Declared Dosha Profile: ${userDosha}` : ''}

Consultation Rules & Persona:
1. Greet warmly with traditional Indian reverence (e.g. "Namaste! 🙏", "Ayubowan", or "Warm Ayurvedic greetings!").
2. Answer the user's question clearly, thoroughly, and scientifically using classical Ayurvedic principles (Vata, Pitta, Kapha balance, Kshirapak cold herbal oil infusion, natural saponins).
3. Recommend specific Umanarayani products when relevant, detailing *which specific herbal ingredients* in the product directly solve their hair, scalp, or skin concern.
4. Provide practical Ayurvedic tips (e.g., scalp champi duration, lukewarm water washing, diet/lifestyle tips).
5. Format with beautiful, easy-to-read markdown (bullet points, bold highlights, herbal emojis 🌿🧴✨).
6. HERBAL CARE TEAM SUPPORT: Remind the user that if they have any doubts, need personalized routine guidance, or prefer talking directly to our Herbal Care Team, they can connect anytime on WhatsApp at +91 8641033514.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `${systemInstruction}\n\nUser Question: ${message.trim()}`;

    let reply = "";
    try {
      const interaction = await ai.interactions.create({
        model: "gemini-3.6-flash",
        input: prompt
      });
      reply = interaction.output_text || "";
    } catch (apiErr) {
      console.warn("Interactions API attempt failed, trying models API:", apiErr.message);
      const modelRes = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt
      });
      reply = modelRes.text || "";
    }

    // Detect if specific products were mentioned in answer
    const mentionedProducts = products.filter(p => 
      reply.toLowerCase().includes(p.name.toLowerCase()) || 
      reply.toLowerCase().includes(p.id.replace(/-/g, ' '))
    ).map(p => ({
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image
    }));

    res.json({
      success: true,
      reply,
      suggestedProducts: mentionedProducts,
      whatsappNumber: "+918641033514",
      whatsappLink: `https://wa.me/918641033514?text=${encodeURIComponent('Hello Umanarayani! I consulted your AI and want to talk with a human specialist about: ' + message.substring(0, 80))}`
    });
  } catch (err) {
    console.error("Gemini AI API Error in /api/ai/consult:", err.message);

    // Fallback Ayurvedic Knowledge Engine
    let fallbackReply = `Namaste! 🙏 Thank you for reaching out to Umanarayani Ayurveda.\n\n`;
    const lower = message.toLowerCase();

    if (lower.includes('hair') || lower.includes('fall') || lower.includes('oil') || lower.includes('dandruff')) {
      fallbackReply += `🌿 **For Hair Care & Scalp Health:**\nWe strongly recommend our classical **UMANARAYANI AYURVEDIC HAIR OIL** (₹349, 200ml) infused with Brahmi, Bhringraj, Nagarmotha, and Amarbel. It cools Pitta heat, curbs dryness-related breakage, and stimulates follicles.\n\nPair it with **UMANARAYANI HERBAL SHAMPOO** (₹329) with natural Reetha & Shikakai saponins that wash without stripping scalp oils.\n\n*Usage Ritual:* Massage 5–10 ml into scalp at night or 1 hr before bath, rinse with lukewarm water.`;
    } else if (lower.includes('face') || lower.includes('skin') || lower.includes('tan') || lower.includes('pimple') || lower.includes('glow')) {
      fallbackReply += `🍊 **For Skin Glow, Tanning & Pimples:**\nOur **UMANARAYANI AYURVEDIC ORANGE FACE WASH** (₹279, 150ml) is formulated with natural citrus orange peel bioflavonoids, Neem, and Tulsi. It gently lifts away sun tanning, balances oily sebum, and eliminates acne-causing bacteria without tight dryness.`;
    } else {
      fallbackReply += `🌿 **Ayurvedic Care Guidance:**\nUmanarayani brings authentic classical botanical care (Pure Nature, Pure Care) free from parabens, sulphates, and mineral oils.\n\n• **Hair Oil:** ₹349 (Brahmi, Bhringraj, Amarbel)\n• **Herbal Shampoo:** ₹329 (Shikakai, Reetha, Amla)\n• **Orange Face Wash:** ₹279 (Orange peel, Neem, Tulsi)`;
    }

    fallbackReply += `\n\n💬 **Prefer talking to our Herbal Care Team?**\nYou can chat directly with our Ayurvedic support specialists on WhatsApp at **+91 8641033514**!`;

    res.json({
      success: true,
      reply: fallbackReply,
      whatsappNumber: "+918641033514",
      whatsappLink: `https://wa.me/918641033514?text=${encodeURIComponent('Hello Umanarayani! I have a question regarding: ' + message.substring(0, 80))}`
    });
  }
});

// 13. Gemini AI Dosha Diagnosis & Personalized Regimen Quiz
app.post('/api/ai/diagnose-dosha', async (req, res) => {
  const { hairTexture, skinType, scalpTendency, mainConcern } = req.body;
  const apiKey = getApiKey();

  const prompt = `You are the Ayurvedic Herbal Care Specialist for Umanarayani Ayurveda (Tagline: Pure Nature, Pure Care). Provide authentic herbal wellness and personal care routine guidance.
Analyze the user's attributes:
- Hair Texture: ${hairTexture || 'Normal to Dry'}
- Skin Type: ${skinType || 'Combination'}
- Scalp Tendency: ${scalpTendency || 'Occasional Flakes / Warmth'}
- Primary Concern: ${mainConcern || 'Hair Fall & Skin Glow'}

Please provide:
1. Primary Ayurvedic Dosha diagnosis (Vata, Pitta, Kapha, or dual dosha like Pitta-Vata) with a short classical explanation.
2. Recommended daily routine (morning & night rituals).
3. The exact matching Umanarayani product regimen (Hair Oil, Herbal Shampoo, Orange Face Wash).
4. Reminder that they can discuss custom adjustments with a human expert on WhatsApp at +91 8641033514.
Keep the response warm, encouraging, beautifully formatted in markdown.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    let diagnosis = "";
    try {
      const interaction = await ai.interactions.create({
        model: "gemini-3.6-flash",
        input: prompt
      });
      diagnosis = interaction.output_text || "";
    } catch(err) {
      const resp = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt
      });
      diagnosis = resp.text || "";
    }

    res.json({
      success: true,
      diagnosis,
      whatsappNumber: "+918641033514"
    });
  } catch (err) {
    console.error("Gemini Dosha Error:", err.message);
    res.json({
      success: true,
      diagnosis: `### 🌿 Ayurvedic Constitution: Pitta-Vata\n\nYour profile indicates a combination of warm **Pitta** (inducing scalp heat and sensitive skin) and dry **Vata** (causing strand roughness and dryness).\n\n**Recommended Umanarayani Regimen:**\n1. **Night Champi:** Massage **Umanarayani Ayurvedic Hair Oil** (Brahmi & Jatamansi) twice weekly to pacify Pitta and calm scalp nerves.\n2. **Morning Cleansing:** Wash with **Umanarayani Herbal Shampoo** (Reetha & Shikakai) to protect natural moisture.\n3. **Facial Revival:** Use **Umanarayani Orange Face Wash** with Neem to curb excess oil and blemishes while brightening skin tone.\n\n💬 *Want a 1-on-1 human consultation? WhatsApp our Ayurvedic team on +91 8641033514!*`,
      whatsappNumber: "+918641033514"
    });
  }
});

// 14a. General Server, CORS & Database Health Check
app.get('/api/health', async (req, res) => {
  const healthData = {
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString(),
    cors: 'enabled (wildcard reflection with credentials)',
    database: 'disconnected',
    services: {
      geminiAi: Boolean(getApiKey()),
      mysql: false
    }
  };

  try {
    await db.query('SELECT 1');
    healthData.database = 'connected';
    healthData.services.mysql = true;
    res.json({ success: true, status: 'healthy', ...healthData });
  } catch (err) {
    healthData.databaseError = err.message;
    res.status(503).json({ success: false, status: 'degraded', ...healthData });
  }
});

// 14b. MySQL Database Connection Pool Health Check
app.get('/api/health/db', async (req, res) => {
  try {
    const [result] = await db.query('SELECT 1 + 1 AS healthCheck');
    const [counts] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM products) AS totalProducts,
        (SELECT COUNT(*) FROM herbs) AS totalHerbs,
        (SELECT COUNT(*) FROM reviews) AS totalReviews,
        (SELECT COUNT(*) FROM users) AS totalUsers
    `);

    res.json({
      success: true,
      status: 'connected',
      message: 'MySQL connection pool is active and responding',
      data: result[0],
      databaseStats: counts[0]
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      status: 'disconnected',
      error: err.message,
      help: 'Check if MySQL service is running and credentials in .env match your local MySQL configuration.'
    });
  }
});

// Specific HTML page routes
app.get('/product', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'product.html'));
});

app.get('/signin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'signin.html'));
});

app.get('/cart', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'cart.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Fallback routing for SPA or direct page access
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, async () => {
  console.log(`🌿 Umanarayani Ayurvedic Server running at http://localhost:${PORT}`);
  console.log(`📞 WhatsApp Consultation: +918641033514`);
  
  // Test MySQL connection pool on server boot
  await db.testConnection();
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server and closing MySQL connection pool...');
  try {
    await db.pool.end();
  } catch (err) {}
  process.exit(0);
});
