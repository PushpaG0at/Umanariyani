/**
 * ==============================================================================
 * UMANARAYNI AYURVEDA — DATABASE PRODUCT CATALOG HARMONIZATION UTILITY
 * ==============================================================================
 * 
 * Harmonizes live database product titles, descriptions, and certifications:
 * 1. Harmonizes brand spelling:
 *    - "UMANARAYANI" -> "UMANARAYNI"
 *    - "Umanarayani" -> "Umanarayni"
 * 2. Cleans up unverified statutory claims:
 *    - "Ayush Certified" / "Ayush Approved" -> "Classical Ayurvedic Formulation"
 *    - "GMP Quality Assured" / "GMP Quality" -> "Classical Ayurvedic Quality"
 * 
 * SAFETY GUARDS:
 * - DRY-RUN BY DEFAULT: Scans MySQL and reports every proposed change without
 *   writing anything to the database.
 * - Requires both `--execute` AND `--confirm="UPDATE_PRODUCT_CATALOG"` to apply changes.
 * - ALWAYS triggers an automated database backup (runBackup()) before executing
 *   any UPDATE query.
 * - Never prints secrets or credentials.
 * ==============================================================================
 */

require('dotenv').config();
const mysql = require('mysql2/promise');
const { runBackup } = require('./backup');

const HARMONIZATION_RULES = [
  // Brand name spelling corrections
  { pattern: /UMANARAYANI/g, replacement: 'UMANARAYNI' },
  { pattern: /Umanarayani/g, replacement: 'Umanarayni' },
  // Unverified certification claim harmonization
  { pattern: /Ayush Certified/gi, replacement: 'Classical Ayurvedic Formulation' },
  { pattern: /Ayush Approved/gi, replacement: 'Classical Ayurvedic Formulation' },
  { pattern: /GMP Quality Assured/gi, replacement: 'Classical Ayurvedic Quality' },
  { pattern: /GMP Quality/gi, replacement: 'Classical Herbal Purity' }
];

function harmonizeText(text) {
  if (typeof text !== 'string') return text;
  let updated = text;
  for (const rule of HARMONIZATION_RULES) {
    updated = updated.replace(rule.pattern, rule.replacement);
  }
  return updated;
}

function harmonizeValue(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return harmonizeText(val);
  }
  if (Array.isArray(val)) {
    return val.map(item => harmonizeValue(item));
  }
  if (typeof val === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = harmonizeValue(v);
    }
    return res;
  }
  return val;
}

async function harmonizeProducts() {
  const args = process.argv.slice(2);
  const isExecute = args.includes('--execute');
  const confirmArg = args.find(a => a.startsWith('--confirm='));
  const confirmVal = confirmArg ? confirmArg.split('=')[1].replace(/["']/g, '') : '';

  console.log('================================================================');
  console.log('🌿 UMANARAYNI AYURVEDA — PRODUCT CATALOG HARMONIZATION');
  console.log('================================================================');
  console.log(`Execution Mode: ${isExecute ? '⚠️ LIVE WRITE EXECUTION' : '🔍 DRY RUN (Default - No changes will be saved)'}`);

  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'umanarayani',
    waitForConnections: true,
    connectionLimit: 5
  });

  try {
    // 1. Verify products table exists and retrieve columns
    const [columns] = await pool.query('SHOW COLUMNS FROM `products`');
    const textColumns = columns
      .filter(col => {
        const type = col.Type.toLowerCase();
        return type.includes('varchar') || type.includes('text') || type.includes('json');
      })
      .map(col => col.Field)
      // Exclude primary identifiers, image filepaths, and urls
      .filter(f => !['id', 'image', 'gallery', 'asin', 'categorySlug'].includes(f));

    console.log(`Auditing columns (${textColumns.length}): ${textColumns.join(', ')}\n`);

    // 2. Fetch all products
    const [products] = await pool.query('SELECT * FROM `products`');
    console.log(`Found ${products.length} catalog formulation(s) in database.\n`);

    const changesToApply = [];

    for (const prod of products) {
      const prodChanges = {
        id: prod.id,
        name: prod.name,
        updates: {}
      };

      for (const col of textColumns) {
        const originalVal = prod[col];
        if (originalVal === null || originalVal === undefined) continue;

        let parsed = originalVal;
        let isJson = false;

        if (typeof originalVal === 'string') {
          if (originalVal.startsWith('{') || originalVal.startsWith('[')) {
            try {
              parsed = JSON.parse(originalVal);
              isJson = true;
            } catch (_) {
              parsed = originalVal;
            }
          }
        } else if (typeof originalVal === 'object') {
          isJson = true;
        }

        const harmonized = harmonizeValue(parsed);
        const origStr = typeof originalVal === 'object' ? JSON.stringify(originalVal) : String(originalVal);
        const harmStr = typeof harmonized === 'object' ? JSON.stringify(harmonized) : String(harmonized);

        if (origStr !== harmStr) {
          prodChanges.updates[col] = {
            original: origStr,
            proposed: harmStr
          };
        }
      }

      if (Object.keys(prodChanges.updates).length > 0) {
        changesToApply.push(prodChanges);
      }
    }

    if (changesToApply.length === 0) {
      console.log('✅ All catalog product titles, descriptions, and certifications are already fully harmonized!');
      console.log('No modifications necessary.');
      await pool.end();
      return;
    }

    console.log(`📋 Found ${changesToApply.length} product(s) requiring harmonization:\n`);
    for (const item of changesToApply) {
      console.log(`----------------------------------------------------------------`);
      console.log(`Formulation ID: ${item.id} ("${item.name}")`);
      for (const [col, diff] of Object.entries(item.updates)) {
        console.log(`  🔹 Field [${col}]:`);
        const origSnippet = diff.original.length > 90 ? diff.original.slice(0, 87) + '...' : diff.original;
        const propSnippet = diff.proposed.length > 90 ? diff.proposed.slice(0, 87) + '...' : diff.proposed;
        console.log(`     Current:  ${origSnippet}`);
        console.log(`     Proposed: ${propSnippet}`);
      }
    }
    console.log(`----------------------------------------------------------------\n`);

    // 3. Execution gatekeeper
    if (!isExecute) {
      console.log('ℹ️  DRY RUN COMPLETED.');
      console.log('To apply these proposed updates to the database, run:');
      console.log('  node scripts/harmonize-db-products.js --execute --confirm="UPDATE_PRODUCT_CATALOG"\n');
      return;
    }

    if (confirmVal !== 'UPDATE_PRODUCT_CATALOG') {
      console.error('❌ EXECUTION ABORTED: Confirmation phrase mismatch.');
      console.error('Required argument: --confirm="UPDATE_PRODUCT_CATALOG"');
      process.exit(1);
    }

    // 4. Pre-execution Safety Backup
    console.log('🛡️  Initiating mandatory pre-update database backup before applying changes...');
    const backupRes = await runBackup();
    console.log(`✅ Pre-update backup created: ${backupRes.filename || 'successful'}\n`);

    // 5. Apply updates in a transaction
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      let updatedCount = 0;
      for (const item of changesToApply) {
        const setClauses = [];
        const params = [];

        for (const [col, diff] of Object.entries(item.updates)) {
          setClauses.push(`\`${col}\` = ?`);
          params.push(diff.proposed);
        }

        params.push(item.id);
        const query = `UPDATE \`products\` SET ${setClauses.join(', ')} WHERE \`id\` = ?`;
        await conn.query(query, params);
        updatedCount++;
        console.log(`   ✅ Updated formulation: ${item.id}`);
      }

      await conn.commit();
      console.log(`\n🎉 Successfully harmonized ${updatedCount} product(s) in the database!`);
    } catch (err) {
      await conn.rollback();
      console.error('❌ Transaction failed, rolled back all changes:', err.message);
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('❌ Harmonization error:', err.message || err);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  harmonizeProducts();
}

module.exports = { harmonizeProducts, harmonizeText, harmonizeValue };
