const fs = require('fs');

const htmls = [
  'public/index.html',
  'public/product.html',
  'public/cart.html',
  'public/signin.html',
  'public/admin.html',
  'public/success.html'
];

console.log('=== AUDITING ALL HTML FILES FOR STRICT CSP COMPLIANCE ===');
let totalViolations = 0;

htmls.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  
  // Check inline event handlers
  const handlerRegex = /\b(on[a-z]+)\s*=\s*(["'])(.*?)\2/gi;
  const inlineHandlers = [];
  let m;
  while ((m = handlerRegex.exec(content)) !== null) {
    inlineHandlers.push({ attr: m[1], val: m[3] });
  }

  // Check inline <script> tags without src
  const scriptRegex = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  const inlineScripts = [];
  while ((m = scriptRegex.exec(content)) !== null) {
    inlineScripts.push(m[0].slice(0, 60) + '...');
  }

  // Check javascript: URLs in href
  const jsHrefRegex = /href\s*=\s*(["'])\s*javascript:(.*?)\1/gi;
  const jsHrefs = [];
  while ((m = jsHrefRegex.exec(content)) !== null) {
    jsHrefs.push(m[0]);
  }

  const count = inlineHandlers.length + inlineScripts.length + jsHrefs.length;
  totalViolations += count;

  if (count > 0) {
    console.error(`[FAIL] ${file}: ${count} violation(s):`);
    if (inlineHandlers.length) console.error('   Handlers:', inlineHandlers);
    if (inlineScripts.length) console.error('   Inline Scripts:', inlineScripts);
    if (jsHrefs.length) console.error('   javascript: hrefs:', jsHrefs);
  } else {
    console.log(`[PASS] ${file}: 0 inline handlers, 0 inline scripts, 0 javascript: hrefs. Clean!`);
  }
});

console.log('---------------------------------------------------------');
console.log('Total HTML CSP Violations:', totalViolations);
process.exit(totalViolations === 0 ? 0 : 1);
