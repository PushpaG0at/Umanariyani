const fs = require('fs');
const path = require('path');
const db = require('../db');

async function exportSql() {
  const [rows] = await db.query('SELECT * FROM products ORDER BY id ASC');
  const dbName = process.env.DB_NAME || 'umanarayani';

  let sql = `-- =====================================================================\n`;
  sql += `-- UMANARAYANI AYURVEDIC SANCTUARY — PURE SQL CATALOG SEED SCRIPT\n`;
  sql += `-- Target Database: ${dbName}\n`;
  sql += `-- Total Formulations: ${rows.length}\n`;
  sql += `-- =====================================================================\n\n`;
  sql += `USE \`${dbName}\`;\n\n`;

  for (const p of rows) {
    const keys = Object.keys(p).filter(k => k !== 'created_at' && k !== 'updated_at');
    const cols = keys.map(k => `\`${k}\``).join(', ');

    const vals = keys.map(k => {
      const v = p[k];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return v;
      if (typeof v === 'boolean') return v ? '1' : '0';
      const strVal = typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `'${strVal.replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`;
    }).join(',\n    ');

    sql += `-- [Product: ${p.id} - ${p.name}]\n`;
    sql += `INSERT INTO \`products\` (\n  ${cols}\n) VALUES (\n    ${vals}\n)\n`;
    sql += `ON DUPLICATE KEY UPDATE\n`;
    sql += `  \`name\` = VALUES(\`name\`),\n`;
    sql += `  \`subtitle\` = VALUES(\`subtitle\`),\n`;
    sql += `  \`tagline\` = VALUES(\`tagline\`),\n`;
    sql += `  \`category\` = VALUES(\`category\`),\n`;
    sql += `  \`categorySlug\` = VALUES(\`categorySlug\`),\n`;
    sql += `  \`price\` = VALUES(\`price\`),\n`;
    sql += `  \`mrp\` = VALUES(\`mrp\`),\n`;
    sql += `  \`discountPercent\` = VALUES(\`discountPercent\`),\n`;
    sql += `  \`volume\` = VALUES(\`volume\`),\n`;
    sql += `  \`image\` = VALUES(\`image\`),\n`;
    sql += `  \`shortDescription\` = VALUES(\`shortDescription\`),\n`;
    sql += `  \`description\` = VALUES(\`description\`),\n`;
    sql += `  \`keyBenefits\` = VALUES(\`keyBenefits\`),\n`;
    sql += `  \`featuredIngredients\` = VALUES(\`featuredIngredients\`),\n`;
    sql += `  \`ingredientsDetails\` = VALUES(\`ingredientsDetails\`),\n`;
    sql += `  \`howToUse\` = VALUES(\`howToUse\`),\n`;
    sql += `  \`usageSteps\` = VALUES(\`usageSteps\`),\n`;
    sql += `  \`suitableFor\` = VALUES(\`suitableFor\`),\n`;
    sql += `  \`certifications\` = VALUES(\`certifications\`),\n`;
    sql += `  \`faqs\` = VALUES(\`faqs\`);\n\n`;
  }

  const outPath = path.join(__dirname, 'seed-products.sql');
  fs.writeFileSync(outPath, sql, 'utf8');
  console.log(`✅ Pure SQL dump exported successfully to: ${outPath} (${rows.length} products)`);
  process.exit(0);
}

exportSql().catch(err => {
  console.error('Export failed:', err);
  process.exit(1);
});

