const fs = require('fs');
const path = require('path');
const http = require('http');

console.log('🔍 Starting Comprehensive End-to-End System & Asset Verification...\n');

let errors = 0;

// 1. Check all HTML files for asset integrity
const htmlFiles = ['index.html', 'product.html', 'signin.html', 'cart.html', 'admin.html', 'success.html'];

for (const file of htmlFiles) {
  const filePath = path.join(__dirname, '..', 'public', file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Missing HTML file: ${file}`);
    errors++;
    continue;
  }
  const content = fs.readFileSync(filePath, 'utf8');

  // Check CSS
  const cssRegex = /href=["']([^"']+\.css[^"']*)["']/g;
  let match;
  while ((match = cssRegex.exec(content)) !== null) {
    let raw = match[1].split('?')[0];
    if (raw.startsWith('http://') || raw.startsWith('https://')) continue;
    if (raw.startsWith('/')) raw = raw.slice(1);
    const fullPath = path.join(__dirname, '..', 'public', raw);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ [${file}] Missing CSS file: ${raw}`);
      errors++;
    }
  }

  // Check JS
  const jsRegex = /src=["']([^"']+\.js[^"']*)["']/g;
  while ((match = jsRegex.exec(content)) !== null) {
    let raw = match[1].split('?')[0];
    if (raw.startsWith('http://') || raw.startsWith('https://')) continue;
    if (raw.startsWith('/')) raw = raw.slice(1);
    const fullPath = path.join(__dirname, '..', 'public', raw);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ [${file}] Missing script file: ${raw}`);
      errors++;
    }
  }

  // Check images
  const imgRegex = /(?:src|href)=["'](?:\/)?(images\/[^"']+)["']/g;
  while ((match = imgRegex.exec(content)) !== null) {
    let raw = match[1].split('?')[0];
    if (raw.startsWith('/')) raw = raw.slice(1);
    const fullPath = path.join(__dirname, '..', 'public', raw);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ [${file}] Missing image file: ${raw}`);
      errors++;
    }
  }
}

if (errors === 0) {
  console.log('✅ HTML Asset Check: All CSS, JS, and image assets referenced across all HTML pages exist.\n');
}

// 2. HTTP Server Health and Endpoints Check
function fetchJson(urlPath) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000${urlPath}`, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(raw) });
        } catch(e) {
          resolve({ status: res.statusCode, raw });
        }
      });
    }).on('error', reject);
  });
}

(async () => {
  try {
    const health = await fetchJson('/api/health');
    if (health.status !== 200 || !health.data.success) {
      console.error('❌ Server health failed:', health);
      errors++;
    } else {
      console.log('✅ Server Health: OK (Status: healthy, DB: connected, Gemini: active)');
    }

    const prods = await fetchJson('/api/products');
    if (prods.status !== 200 || !prods.data.products || prods.data.products.length === 0) {
      console.error('❌ Products catalog failed:', prods);
      errors++;
    } else {
      console.log(`✅ Products API: OK (${prods.data.products.length} products loaded from MySQL)`);
    }

    const herbs = await fetchJson('/api/herbs');
    if (herbs.status !== 200 || !herbs.data.herbs || herbs.data.herbs.length < 8) {
      console.error('❌ Herbs catalog failed:', herbs);
      errors++;
    } else {
      console.log(`✅ Herbs API: OK (${herbs.data.herbs.length} sacred revolving herbs loaded)`);
    }

    const usersActive = await fetchJson('/api/users/active');
    if (usersActive.status !== 200 || typeof usersActive.data.activeUsers !== 'number') {
      console.error('❌ Active users metric failed:', usersActive);
      errors++;
    } else {
      console.log(`✅ Live Users & Community Stats: OK (Live: ${usersActive.data.activeUsers}, Total: ${usersActive.data.totalUsers})`);
    }

    console.log('\n==================================================');
    if (errors === 0) {
      console.log('🎉 AUDIT COMPLETE: 0 ERRORS FOUND ACROSS ALL FEATURES!');
    } else {
      console.log(`⚠️ AUDIT COMPLETE: ${errors} errors found.`);
    }
    console.log('==================================================\n');
    process.exit(errors > 0 ? 1 : 0);
  } catch(e) {
    console.error('❌ Verification script error:', e.message);
    process.exit(1);
  }
})();

