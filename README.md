# 🌿 UMANARAYANI — Pure Nature, Pure Care.
### *Classical Ayurvedic Personal Care, Botanical Beauty & AI Herbal Sanctuary*

[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-forestgreen.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v5.3-lightgrey.svg)](https://expressjs.com/)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%20Flash-blue.svg)](https://ai.google.dev/)
[![WhatsApp](https://img.shields.io/badge/Consultation-WhatsApp%20Helpline-brightgreen.svg)](https://wa.me/918641033514)

---

## 📖 About Umanarayani

**UMANARAYANI** is an authentic, classical Ayurvedic personal care e-commerce platform and holistic wellness sanctuary. Rooted in traditional Indian botanical wisdom and time-honoured classical formulations (such as *Kshirapak* herbal oil infusion and natural saponin cleansing), Umanarayani delivers pure, uncompromised hair, scalp, and skin care free from sulphates, parabens, and mineral oils.

The platform blends ancient Ayurvedic heritage with a state-of-the-art interactive digital experience — featuring a revolving 8-herbs mandala, real-time live visitor counters, rich Amazon-style product exploration pages, interactive Ayurvedic dosha diagnosis, and an AI-powered Ayurvedic specialist (**"Umanarayani AI Vaidya"**) powered by Google Gemini.

---

## ✨ Key Features & Architecture

### 1. 🌀 Revolving 8 Sacred Herbs Mandala
- An interactive, revolving botanical wheel where the eight sacred herbs of Umanarayani revolve seamlessly around the central brand emblem:
  1. **Amla (Phyllanthus emblica)** — Natural Vitamin C & Youthful Vitality
  2. **Reetha (Sapindus mukorossi)** — Nature's Pure Cleansing Saponin
  3. **Shikakai (Acacia concinna)** — Traditional Fruit for Hair & Silkiness
  4. **Brahmi (Bacopa monnieri)** — Mind & Crown Calmer, Follicle Rejuvenator
  5. **Kalonji (Nigella sativa)** — Miracle Seed of Vitality & Hair Density
  6. **Jatamansi (Nardostachys jatamansi)** — Sacred Calming Root for Anagen Growth
  7. **Nagarmotha (Cyperus scariosus)** — Scalp Microbiome Purifier & Root Anchor
  8. **Amarbel (Cuscuta reflexa)** — Traditional Length & Density Booster
- Orbiting animation with interactive hover-to-pause, zoom focal effects, and dynamic botanical detail cards.

### 2. 🧴 Classical Product Catalog & Dynamic Detail Experience
- Comprehensive product catalog showcasing flagship classical preparations:
  - **Umanarayani Ayurvedic Hair Oil** (₹349 / 200ml) — Infused with Brahmi, Bhringraj, Nagarmotha & Amarbel.
  - **Umanarayani Herbal Shampoo** (₹329 / 250ml) — Sulphate-free Reetha & Shikakai gentle foaming formula.
  - **Umanarayani Ayurvedic Orange Face Wash** (₹279 / 150ml) — Anti-tan, acne-clearing citrus bioflavonoids & Neem.
  - **Umanarayani Neem & Tulsi Purifying Body Wash** (₹349 / 300ml) — Antibacterial botanical shower ritual.
- Amazon-style product pages (`product.html`) featuring:
  - High-resolution multi-angle image galleries
  - Dynamic pricing, savings badges, and volume selectors
  - Scientific role and benefits for every individual botanical ingredient
  - Step-by-step Ayurvedic application rituals
  - Verified buyer ratings, star distributions, and interactive review submission
  - Direct WhatsApp 1-on-1 consultation button

### 3. 🤖 Gemini AI Ayurvedic Consultant ("Umanarayani AI Vaidya")
- Powered by Google Gemini (`@google/genai`) with dual-mode interactions/generateContent fallback.
- Context-aware consultation engine loaded with the full Umanarayani botanical materia medica.
- Helps customers resolve concerns such as Pitta heat, scalp dryness, seasonal hair fall, dandruff, and dull skin with classical guidance and product suggestions.
- Built-in graceful offline Ayurvedic knowledge engine if internet or API limits are encountered.

### 4. 🧘 Interactive Ayurvedic Dosha Diagnosis & Regimen Quiz
- Comprehensive constitutional assessment analyzing hair texture, skin type, scalp tendencies, and primary concerns.
- Diagnoses the user's primary Dosha (*Vata, Pitta, Kapha* or dual *Pitta-Vata*) and provides a tailor-made morning and evening Ayurvedic ritual.

### 5. 👥 Real-Time Active Users Simulation (SSE)
- Live community presence indicator powered by Server-Sent Events (`/api/users/stream`).
- Reflects real-time browser sessions with natural organic activity fluctuations.

### 6. 🛒 Shopping Cart & Checkout Experience
- Dynamic cart management with local storage persistence.
- Free shipping threshold progress bar (Free shipping above ₹499).
- Instant coupon code discounts (e.g., `AYURVEDA10` for 10% off).
- Transparent order summary with taxes, discounts, and checkout modal.

### 7. 🔐 Member Sign-In & Personalized Profile
- Community registration and login system (`signin.html`).
- Stores user dosha profiles, hair types, and preferences for a tailored shopping journey.

### 8. 🛠️ Admin Inventory Management Portal
- Store manager dashboard (`admin.html`) enabling instantaneous addition of new Ayurvedic formulations to the persistent catalog without code changes.

### 9. 📞 Instant WhatsApp Care Helpline
- Integrated WhatsApp concierge (`+91 8641033514`) pre-filling consultation inquiries directly to human Ayurvedic specialists.

---

## 🎨 Design Philosophy & Aesthetics

- **Curated Color Palette**:
  - Forest Emerald (`#133e2b`, `#1a5336`) — Reflecting deep Ayurvedic herbal forests.
  - Sacred Gold (`#d4af37`, `#c59b27`, `#e8c15a`) — Representing classical purity and luxury.
  - Warm Herb Cream (`#faf8f5`, `#f4ede2`) — Soothing, natural parchment tones.
- **Typography**: Refined serif headings paired with crisp modern typography for maximum readability and prestige.
- **Micro-Animations**: Smooth card elevations, pulse badges, glassmorphism containers, and interactive revolving transforms.

---

## 📂 Project Directory Structure

```text
Umanarayani/
│
├── .env.example             # Template for environment variables (Gemini API key, Port)
├── .gitignore               # Ignores node_modules and sensitive .env files
├── package.json             # Node dependencies and project scripts
├── package-lock.json        # Locked dependency tree
├── server.js                # Core Express server, REST endpoints, SSE & Gemini AI logic
├── index.js                 # Server entry point forwarder
│
├── data/                    # JSON database files (read/write data layer)
│   ├── herbs.json           # Detailed botanical data for the 8 sacred herbs
│   ├── products.json        # Full product catalog, ingredients, benefits, FAQs
│   ├── reviews.json         # Customer verified reviews and star ratings
│   └── users.json           # User profiles, saved doshas, and credentials
│
└── public/                  # Frontend static assets
    ├── index.html           # Main storefront homepage with revolving mandala
    ├── product.html         # Amazon-style dedicated product detail page
    ├── cart.html            # Shopping cart and checkout page
    ├── signin.html          # Authentication & Ayurvedic Dosha Quiz page
    ├── admin.html           # Store inventory & product addition portal
    │
    ├── css/
    │   ├── style.css             # Main styling, layout, header, footer & hero
    │   ├── revolving-mandala.css # Revolving 8-herbs mandala animations & orbit
    │   ├── product.css           # Amazon-style product page styles & review cards
    │   ├── signin.css            # Auth portal & Dosha quiz styles
    │   └── ai-consultant.css     # AI Vaidya chat window & floating trigger styles
    │
    ├── js/
    │   ├── main.js               # Homepage interactions, catalog renderer, SSE listener
    │   ├── revolving-mandala.js  # Revolving herb mandala mechanics & event handling
    │   ├── revolving-herbs.js    # Supplementary herb interaction module
    │   ├── product.js            # Dynamic product page builder, reviews & cart actions
    │   ├── auth.js               # User authentication & Dosha quiz submission logic
    │   └── ai-consultant.js      # Gemini AI chat widget, history & messaging
    │
    └── images/                   # High-res product photography, herbal badges & logos
        ├── logo-center.png
        ├── logo.jpg
        ├── hair-oil.png
        ├── shampoo.png
        ├── face-wash.png
        ├── ayurvedic_herbs_circle.jpg
        ├── badge-amla.png
        ├── badge-reetha.png
        ├── badge-shikakai.png
        ├── badge-brahmi.png
        ├── badge-kalonji.png
        ├── badge-jatamansi.png
        ├── badge-nagarmotha.png
        └── badge-amarbel.png
```

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/products` | Retrieve all products (supports `?category=` and `?search=`) |
| `GET` | `/api/products/:id` | Fetch single product by unique ID |
| `POST` | `/api/products` | Add a new product to the catalog (Admin) |
| `GET` | `/api/herbs` | Retrieve the 8 sacred revolving herbs metadata |
| `GET` | `/api/users/active` | Get current active community count |
| `GET` | `/api/users/stream` | Server-Sent Events (SSE) stream for real-time live user counters |
| `GET` | `/api/reviews/:productId`| Fetch verified reviews for a specific product |
| `POST` | `/api/reviews/:productId`| Submit a new verified review |
| `POST` | `/api/auth/register` | Register a new customer with Dosha profile |
| `POST` | `/api/auth/login` | Authenticate customer and retrieve Dosha profile |
| `POST` | `/api/ai/consult` | Consult **Umanarayani AI Vaidya** (Google Gemini) |
| `POST` | `/api/ai/diagnose-dosha`| Diagnostic Dosha Assessment (Google Gemini) |
| `POST` | `/api/inquiry/whatsapp` | Generate direct WhatsApp consultation link |

---

## 🚀 Quick Start Guide

### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- npm (v9.0.0 or higher)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository_url>
   cd Umanarayani
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Add your Google Gemini API key:
   ```env
   PORT=3000
   GEMINI_API_KEY=your_actual_gemini_api_key_here
   ```
   *(Note: If no API key is provided, the platform automatically activates its built-in classical Ayurvedic Knowledge Fallback Engine).*

4. **Start the application:**
   ```bash
   # Development mode with auto-reload:
   npm run dev

   # Production mode:
   npm start
   ```

5. **Open in Browser:**
   Visit `http://localhost:3000` to explore the Umanarayani experience!

---

## 🌿 Brand Values & Trust Commitments

- **Classical Integrity**: Guided by principles from classical Ayurvedic texts (*Charaka Samhita*, *Sushruta Samhita*).
- **100% Transparency**: Full disclosure of all herbal extracts, plant saponins, and zero synthetic fillers.
- **Ethical Formulations**: Cruelty-free, vegan, dermatologically tested, paraben-free, and sulphate-free.

---

*© Umanarayani Herbal Products. Pure Nature, Pure Care. All Rights Reserved.*
