# 🌿 UMANARAYNI — Pure Nature, Pure Care.
### *Classical Ayurvedic Personal Care, Botanical Beauty & AI Herbal Sanctuary*

[![License: ISC](https://img.shields.io/badge/License-ISC-green.svg)](https://opensource.org/licenses/ISC)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-forestgreen.svg)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express.js-v5.3-lightgrey.svg)](https://expressjs.com/)
[![Gemini AI](https://img.shields.io/badge/AI-Google%20Gemini%20Flash-blue.svg)](https://ai.google.dev/)
[![WhatsApp](https://img.shields.io/badge/Consultation-WhatsApp%20Helpline-brightgreen.svg)](https://wa.me/918641033514)

---

## 📖 About Umanarayni

**UMANARAYNI** is an authentic, classical Ayurvedic personal care e-commerce platform and holistic wellness sanctuary. Rooted in traditional Indian botanical wisdom and time-honoured classical formulations (such as *Kshirapak* herbal oil infusion and natural saponin cleansing), Umanarayni delivers pure, uncompromised hair, scalp, and skin care free from sulphates, parabens, and mineral oils.

The platform blends ancient Ayurvedic heritage with a state-of-the-art interactive digital experience — featuring a revolving 8-herbs mandala, real-time live visitor counters, rich Amazon-style product exploration pages, interactive Ayurvedic dosha diagnosis, and an AI-powered Ayurvedic specialist (**"Umanarayni AI Vaidya"**) powered by Google Gemini.

---

## ✨ Key Features & Architecture

### 1. 🌀 Revolving 8 Sacred Herbs Mandala
- An interactive, revolving botanical wheel where the eight sacred herbs of Umanarayni revolve seamlessly around the central brand emblem:
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
  - **Umanarayni Ayurvedic Hair Oil** (₹349 / 200ml) — Infused with Brahmi, Bhringraj, Nagarmotha & Amarbel.
  - **Umanarayni Herbal Shampoo** (₹329 / 250ml) — Sulphate-free Reetha & Shikakai gentle foaming formula.
  - **Umanarayni Ayurvedic Orange Face Wash** (₹279 / 150ml) — Anti-tan, acne-clearing citrus bioflavonoids & Neem.
- Amazon-style product pages (`product.html`) featuring:
  - High-resolution multi-angle image galleries
  - Dynamic pricing, savings badges, and volume selectors
  - Scientific role and benefits for every individual botanical ingredient
  - Step-by-step Ayurvedic application rituals
  - Verified buyer ratings, star distributions, and interactive review submission
  - Direct WhatsApp 1-on-1 consultation button

### 3. 🤖 Gemini AI Ayurvedic Consultant ("Umanarayni AI Vaidya")
- Powered by Google Gemini (`@google/genai`) with dual-mode interactions/generateContent fallback.
- Context-aware consultation engine loaded with the full Umanarayni botanical materia medica.
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
Umanarayni/
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
| `POST` | `/api/ai/consult` | Consult **Umanarayni AI Vaidya** (Google Gemini) |
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
   cd Umanarayni
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
   Visit `http://localhost:3000` to explore the Umanarayni experience!

---

## 🛡️ Reliability, Backups & Production Operations

### 1. 💾 Automated Database Backups (Local + S3 Offsite)

The application includes an automated nightly backup routine (`scripts/backup.js`) powered by `node-cron`:
- **Schedule**: Every night at 02:00 AM server time (configurable via `BACKUP_CRON_SCHEDULE`).
- **Engine**: Executes `mysqldump` with `--single-transaction` and `--quick` flags to ensure complete transactional consistency for InnoDB tables without locking live customer transactions.
- **Local Retention**: Backups are written to `backups/backup_umanarayani_<timestamp>.sql`. Files older than 7 days are automatically purged to prevent disk exhaustion.
- **Offsite Cloud Replication (Amazon S3)**: When `S3_BACKUP_BUCKET` is configured, each backup is immediately streamed to Amazon S3:
  - **Server-Side Encryption**: Enforced with SSE-S3 (`ServerSideEncryption: 'AES256'`).
  - **Partitioning**: Organized under `database-backups/YYYY/MM/<filename>.sql`.
  - **Metadata & Tags**: Tagged with `Environment=production&Retention=30Days&Service=database-backup`.

#### Configuring AWS S3 Lifecycle Retention
To automatically archive or expire backups in S3 without ongoing storage bloat, configure an S3 Lifecycle Rule via the AWS Management Console or AWS CLI:

```bash
# Example AWS CLI lifecycle configuration rule
aws s3api put-bucket-lifecycle-configuration \
  --bucket your-backup-bucket-name \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "ArchiveAndExpireDatabaseBackups",
        "Status": "Enabled",
        "Filter": { "Prefix": "database-backups/" },
        "Transitions": [
          { "Days": 30, "StorageClass": "GLACIER" }
        ],
        "Expiration": { "Days": 90 }
      }
    ]
  }'
```

#### Automated Backup Failure Alerts
If either the MySQL dump or the S3 cloud replication fails, `services/alertService.js` automatically dispatches a critical email alert to `ADMIN_ALERT_EMAIL` with execution duration, system hostname, and exact error details.

---

### 2. 🔄 Database Restore Runbook & Safe Testing

The platform includes a dedicated restore controller (`scripts/restore-database.js`) to restore database snapshots safely.

#### How to Safely Test a Restore (Without Overwriting Production Data)

Always test backups against a temporary scratch database before executing production recovery:

1. **Create a temporary test database in MySQL:**
   ```sql
   CREATE DATABASE IF NOT EXISTS umanarayani_restore_test;
   ```

2. **List available local backups:**
   ```bash
   node scripts/restore-database.js --list-local
   ```

3. **Restore into the test database:**
   ```bash
   # Restore using the latest local backup:
   node scripts/restore-database.js --latest-local --target-db=umanarayani_restore_test --force

   # OR restore a specific file:
   node scripts/restore-database.js --file=backups/backup_umanarayani_2026-11-16T15-55-59-413Z.sql --target-db=umanarayani_restore_test --force
   ```

4. **Restore directly from Amazon S3:**
   ```bash
   # List all backups in S3:
   node scripts/restore-database.js --list-s3

   # Download the latest S3 backup and restore to test database:
   node scripts/restore-database.js --from-s3 --target-db=umanarayani_restore_test --force
   ```

5. **Verify restored data integrity:**
   The restore script automatically runs integrity checks and prints record counts for `products`, `users`, `orders`, `addresses`, and `password_resets`.

6. **Clean up the scratch test database:**
   ```sql
   DROP DATABASE IF EXISTS umanarayani_restore_test;
   ```

> [!CAUTION]
> Restoring into the primary production database (`DB_NAME`) requires the explicit `--force` flag to prevent accidental data loss.

---

### 3. 📊 Observability, Structured Logging & Health Monitoring

#### Error Monitoring (Sentry)
- Sentry error tracking is integrated in `services/monitoringService.js` behind the `ENABLE_SENTRY=true` environment flag.
- When disabled or unconfigured, the application runs with local structured logging and zero external dependencies.
- When enabled, exceptions are automatically reported to Sentry with sensitive information (passwords, OTPs, session secrets) automatically redacted before transmission.

#### Structured Request Logging & Request IDs
- Every incoming HTTP request is assigned a unique UUID via `requestIdMiddleware` in `services/logger.js`.
- If an upstream proxy (AWS ALB, Cloudflare, Nginx) supplies an `X-Request-Id` header, it is automatically preserved and forwarded in the response headers.
- Access logs are emitted with timestamp, request ID, client IP, method, route, HTTP status, and response latency. Setting `STRUCTURED_LOGS=true` outputs machine-parseable JSON lines for CloudWatch, Datadog, or Elasticsearch.

#### `/health` Uptime & Readiness Endpoint
- **URL**: `GET /health` (also aliased at `GET /api/health` and `HEAD /health` for lightweight probes).
- **Behavior**: Executes a live `SELECT 1 AS alive` query against the MySQL connection pool.
- **Success Response (HTTP 200)**:
  ```json
  {
    "status": "ok",
    "timestamp": "2026-11-16T16:00:31.365Z",
    "uptime": 1420.5,
    "requestId": "9c8071c2-c6dc-42fa-8946-0649aac421c4",
    "database": {
      "status": "connected",
      "latencyMs": 1.2
    },
    "system": {
      "nodeVersion": "v24.19.0",
      "environment": "production",
      "memory": {
        "rssMb": "58.42",
        "heapUsedMb": "31.15",
        "heapTotalMb": "42.50"
      }
    }
  }
  ```
- **Failure Response (HTTP 503 Service Unavailable)**:
  If the database connection pool is unavailable, returns `status: "degraded"` with the error description, allowing AWS Route 53 or load balancers to redirect traffic.

---

### 4. 🚀 PM2 Production Management & Log Rotation

A production-grade PM2 ecosystem configuration (`ecosystem.config.js`) manages the server process on AWS EC2:

- **Single Fork Mode**: Guarantees single-process stability for in-memory timers and `node-cron` schedulers.
- **Auto-Restart**: `autorestart: true` with exponential backoff delay (`exp_backoff_restart_delay: 100`) to prevent CPU thrashing during network or database outages.
- **Memory Threshold**: Automatically restarts the Node worker gracefully if RSS memory exceeds **500MB** (`max_memory_restart: '500M'`).
- **Standardized Logs**: Combined and formatted logs saved to `./logs/pm2-out.log` and `./logs/pm2-error.log`.

#### Managing PM2 on AWS EC2
```bash
# Start in production mode
npm run start:prod

# Zero-downtime reload
npm run reload:prod

# Restart application
npm run restart:prod

# View live real-time logs
npm run logs:prod

# Stop service
npm run stop:prod
```

#### Setting Up PM2 Log Rotation
To prevent log files from consuming server disk space indefinitely, install and configure `pm2-logrotate`:
```bash
# Install the PM2 logrotate module
pm2 install pm2-logrotate

# Configure automatic rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 14
pm2 set pm2-logrotate:compress true
```

---

### 5. 🧪 Continuous Integration (GitHub Actions)

The repository includes a GitHub Actions CI pipeline (`.github/workflows/ci.yml`) that validates every commit and pull request to `main`:

1. **Node.js Environment**: Sets up Node.js v24 on Ubuntu with npm dependency caching.
2. **Ephemeral MySQL 8.0 Service**: Boots an isolated MySQL container for integration tests.
3. **Strict CSP Audit**: Runs `scripts/audit-final-csp.js` ensuring 0 inline event handlers and 0 inline scripts.
4. **Idempotent Database Migrations**: Runs `npm run migrate`.
5. **Database Pool & Schema Tests**: Runs `npm run test:db`.
6. **Health & Request ID Checks**: Runs `npm run test:health`.
7. **Security & Recovery Tests**: Runs `scripts/test-forgot-password.js` (33 security assertions).
8. **Bot Defense Tests**: Runs `scripts/test-turnstile-bypass.js`.
9. **Address & Checkout Tests**: Runs `scripts/test-address-checkout.js`.
10. **Storefront API Tests**: Runs `npm run test:api`.

---

## 🌿 Brand Values & Trust Commitments

- **Classical Integrity**: Guided by principles from classical Ayurvedic texts (*Charaka Samhita*, *Sushruta Samhita*).
- **100% Transparency**: Full disclosure of all herbal extracts, plant saponins, and zero synthetic fillers.
- **Ethical Formulations**: Cruelty-free, vegan, dermatologically tested, paraben-free, and sulphate-free.

---

*© Umanarayni Herbal Products. Pure Nature, Pure Care. All Rights Reserved.*
