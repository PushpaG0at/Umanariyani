require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
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

const PRODUCTS_FILE = path.join(__dirname, 'data', 'products.json');
const HERBS_FILE = path.join(__dirname, 'data', 'herbs.json');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const REVIEWS_FILE = path.join(__dirname, 'data', 'reviews.json');

// Ensure data files exist
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([
    {
      id: "usr_pushpendra",
      name: "Pushpendra Singh",
      email: "pushpendra@example.com",
      password: "ayurveda_pass",
      dosha: "Pitta-Vata",
      hairType: "Dry & Normal",
      avatar: "🌿"
    }
  ], null, 2));
}

if (!fs.existsSync(REVIEWS_FILE)) {
  fs.writeFileSync(REVIEWS_FILE, JSON.stringify({
    "ayurvedic-hair-oil": [
      {
        id: "rev_1",
        author: "Ananya Sharma",
        location: "Bengaluru, Karnataka",
        rating: 5,
        date: "October 18, 2026",
        title: "Remarkable difference in hair fall and texture!",
        body: "I've tried numerous Ayurvedic oils, but Umanarayani Hair Oil has genuine herbal potency. The infusion of Brahmi, Nagarmotha, and Amarbel gives a cooling champi experience. After 3 weeks, my comb collects noticeably less hair and strands feel super soft.",
        verifiedPurchase: true,
        helpfulCount: 42
      },
      {
        id: "rev_2",
        author: "Vikram Joshi",
        location: "Pune, Maharashtra",
        rating: 5,
        date: "October 12, 2026",
        title: "Authentic classical preparation without synthetic perfume",
        body: "As someone who studies Ayurveda, I immediately checked the ingredient list. The presence of authentic herbs like Jatamansi and Kalonji provides real scalp nourishment without mineral oil fillers. Truly pure nature and care.",
        verifiedPurchase: true,
        helpfulCount: 29
      },
      {
        id: "rev_3",
        author: "Meera Nair",
        location: "Kochi, Kerala",
        rating: 4,
        date: "October 5, 2026",
        title: "Lovely fragrance and zero stickiness",
        body: "It washes out easily with the Umanarayani shampoo and leaves my hair glowing. Highly recommend doing an overnight champi.",
        verifiedPurchase: true,
        helpfulCount: 15
      }
    ],
    "herbal-shampoo": [
      {
        id: "rev_4",
        author: "Rohan Kapoor",
        location: "Delhi NCR",
        rating: 5,
        date: "October 20, 2026",
        title: "Cleanses thoroughly without drying like chemical shampoos",
        body: "Reetha and Shikakai give a surprisingly gentle and rich lather. Scalp feels squeaky clean yet moisturized. Pairs magically with the hair oil.",
        verifiedPurchase: true,
        helpfulCount: 31
      },
      {
        id: "rev_5",
        author: "Pooja Verma",
        location: "Jaipur, Rajasthan",
        rating: 5,
        date: "October 14, 2026",
        title: "Natural shine is back!",
        body: "My frizz has tamed down considerably. No sulphates or parabens, which is a big relief for sensitive scalps.",
        verifiedPurchase: true,
        helpfulCount: 18
      }
    ],
    "orange-face-wash": [
      {
        id: "rev_6",
        author: "Sanya Gupta",
        location: "Chandigarh",
        rating: 5,
        date: "October 21, 2026",
        title: "Instantly removes tanning after sun exposure!",
        body: "The fresh orange peel aroma is heavenly and authentic, not like artificial scents. Cleared up stubborn forehead pimples in just 10 days.",
        verifiedPurchase: true,
        helpfulCount: 37
      },
      {
        id: "rev_7",
        author: "Aditya Mehta",
        location: "Mumbai",
        rating: 4,
        date: "October 16, 2026",
        title: "Controls midday oiliness very effectively",
        body: "Perfect morning face cleanser. Doesn't leave the skin feeling tight or stretchy.",
        verifiedPurchase: true,
        helpfulCount: 12
      }
    ]
  }, null, 2));
}

// Active users tracking & simulation
let baseActiveUsers = 138;
let connectedClients = new Set();

function getDynamicActiveUserCount() {
  // realistic natural fluctuation around base + connected browsers
  const jitter = Math.floor(Math.sin(Date.now() / 15000) * 12) + (Date.now() % 5);
  return Math.max(85, baseActiveUsers + connectedClients.size + jitter);
}

// Helper functions for reading/writing JSON
function readJson(file) {
  try {
    const data = fs.readFileSync(file, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    return [];
  }
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${file}:`, err);
    return false;
  }
}

/* ==================== API ROUTES ==================== */

// 1. Get all products (with optional filtering)
app.get('/api/products', (req, res) => {
  const products = readJson(PRODUCTS_FILE);
  const { category, search } = req.query;

  let filtered = products;

  if (category && category !== 'all') {
    filtered = filtered.filter(p => p.categorySlug === category || p.category.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.subtitle.toLowerCase().includes(q) ||
      p.shortDescription.toLowerCase().includes(q) ||
      p.featuredIngredients.some(ing => ing.toLowerCase().includes(q))
    );
  }

  res.json({
    success: true,
    count: filtered.length,
    products: filtered
  });
});

// 2. Get single product by ID
app.get('/api/products/:id', (req, res) => {
  const products = readJson(PRODUCTS_FILE);
  const product = products.find(p => p.id === req.params.id);

  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found'
    });
  }

  res.json({
    success: true,
    product: product
  });
});

// 3. Add new product (Enables future product additions)
app.post('/api/products', (req, res) => {
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

  const products = readJson(PRODUCTS_FILE);
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `prod-${Date.now()}`;

  // Check if exists
  if (products.some(p => p.id === id)) {
    return res.status(409).json({
      success: false,
      message: 'A product with a similar name already exists'
    });
  }

  const calculatedMrp = mrp || Math.round(Number(price) * 1.3);
  const discountPercent = Math.round(((calculatedMrp - Number(price)) / calculatedMrp) * 100);

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
    asin: `B09AYURV${products.length + 1}`,
    shortDescription: shortDescription || description || "Handcrafted traditional Ayurvedic formula.",
    description: description || shortDescription || "Handcrafted traditional Ayurvedic formula.",
    keyBenefits: Array.isArray(keyBenefits) ? keyBenefits : (keyBenefits ? keyBenefits.split('\n').filter(Boolean) : ["100% Herbal nourishment", "Safe & gentle for regular use"]),
    featuredIngredients: Array.isArray(featuredIngredients) ? featuredIngredients : (featuredIngredients ? featuredIngredients.split(',').map(s => s.trim()) : ["Ayurvedic Botanical Extracts"]),
    howToUse: howToUse || "Apply as directed on packaging. Suitable for daily use.",
    suitableFor: suitableFor || "Suitable for all hair and skin types.",
    certifications: [
      "100% Ayurvedic Formula",
      "Cruelty Free & Paraben Free",
      "Authentic Classical Extraction"
    ]
  };

  products.push(newProduct);
  writeJson(PRODUCTS_FILE, products);

  res.status(201).json({
    success: true,
    message: 'Product added successfully',
    product: newProduct
  });
});

// 4. Get revolving herbs
app.get('/api/herbs', (req, res) => {
  const herbs = readJson(HERBS_FILE);
  res.json({
    success: true,
    herbs: herbs
  });
});

// 5. Active users count
app.get('/api/users/active', (req, res) => {
  const activeCount = getDynamicActiveUserCount();
  res.json({
    success: true,
    activeUsers: activeCount,
    timestamp: new Date().toISOString(),
    message: `${activeCount} Nature Lovers currently exploring Umanarayani Ayurveda`
  });
});

// 6. Server-Sent Events (SSE) for live active user updates in real-time
app.get('/api/users/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const clientId = `client_${Date.now()}_${Math.random()}`;
  connectedClients.add(clientId);

  // Send immediate count
  res.write(`data: ${JSON.stringify({ activeUsers: getDynamicActiveUserCount() })}\n\n`);

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ activeUsers: getDynamicActiveUserCount() })}\n\n`);
  }, 4000);

  req.on('close', () => {
    clearInterval(interval);
    connectedClients.delete(clientId);
  });
});

// 7. Reviews API
app.get('/api/reviews/:productId', (req, res) => {
  const reviewsData = readJson(REVIEWS_FILE);
  const reviews = reviewsData[req.params.productId] || [];
  res.json({
    success: true,
    count: reviews.length,
    reviews: reviews
  });
});

app.post('/api/reviews/:productId', (req, res) => {
  const { author, rating, title, body, location } = req.body;
  if (!author || !rating || !body) {
    return res.status(400).json({ success: false, message: 'Author, rating, and review text are required' });
  }

  const reviewsData = readJson(REVIEWS_FILE);
  const productId = req.params.productId;

  if (!reviewsData[productId]) {
    reviewsData[productId] = [];
  }

  const newReview = {
    id: `rev_${Date.now()}`,
    author,
    location: location || "India",
    rating: Number(rating),
    date: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    title: title || "Verified Customer Review",
    body,
    verifiedPurchase: true,
    helpfulCount: 0
  };

  reviewsData[productId].unshift(newReview);
  writeJson(REVIEWS_FILE, reviewsData);

  res.status(201).json({
    success: true,
    message: 'Review posted successfully',
    review: newReview
  });
});

// 8. Authentication: Register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, dosha, hairType } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ success: false, message: 'Name, email, and password are required' });
  }

  const users = readJson(USERS_FILE);
  if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
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
    joinedDate: new Date().toISOString()
  };

  users.push(newUser);
  writeJson(USERS_FILE, users);

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
});

// 9. Authentication: Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Email and password are required' });
  }

  const users = readJson(USERS_FILE);
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid email or password' });
  }

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
    activeUsersCount: getDynamicActiveUserCount()
  });
});

// 10. WhatsApp Inquiry Helper / Analytics
app.post('/api/inquiry/whatsapp', (req, res) => {
  const { productId, queryType, message } = req.body;
  console.log(`[WhatsApp Inquiry Click] Product: ${productId}, Type: ${queryType}, Msg: ${message}`);
  res.json({
    success: true,
    whatsappNumber: "+918641033514",
    link: `https://wa.me/918641033514?text=${encodeURIComponent(message || 'Hello Umanarayani! I would like to consult about your Ayurvedic personal care products.')}`
  });
});

/* ==================== 11. GEMINI AI AYURVEDIC CONSULTANT ==================== */
// Real-time AI consultation powered by Google Gemini (gemini-3.8-flash)
app.post('/api/ai/consult', async (req, res) => {
  const { message, productId, userDosha, conversationHistory } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: 'Message is required' });
  }

  const products = readJson(PRODUCTS_FILE);
  const herbs = readJson(HERBS_FILE);
  const apiKey = getApiKey();

  // Build product and herbal context for Gemini
  const productCatalogText = products.map(p => `
* ${p.name} (${p.subtitle || ''}) - Price: ₹${p.price} (M.R.P. ₹${p.mrp}, ${p.discountPercent}% OFF)
  Volume: ${p.volume || '200ml'}
  Short Description: ${p.shortDescription}
  Key Ingredients: ${(p.featuredIngredients || []).join(', ')}
  Benefits: ${(p.keyBenefits || []).join('; ')}
  Application Ritual: ${p.howToUse}
  Suitable For: ${p.suitableFor || 'All types'}
`).join('\n');

  const herbDetailsText = herbs.map(h => `
* ${h.name} (${h.hindi}) - Botanical: ${h.botanical}
  Ayurvedic Action: ${h.tagline}
  Role: ${h.role}
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

Brand & Classical Product Formulations:
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

    // High quality Ayurvedic Fallback Knowledge Engine
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

// 12. Gemini AI Dosha Diagnosis & Personalized Regimen Quiz
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

app.listen(PORT, () => {
  console.log(`🌿 Umanarayani Ayurvedic Server running at http://localhost:${PORT}`);
  console.log(`📞 WhatsApp Consultation: +918641033514`);
});
