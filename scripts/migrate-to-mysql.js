/**
 * ==============================================================================
 * UMANARAYNI AYURVEDA — MIGRATION WRAPPER (DEPRECATION WRAPPER)
 * ==============================================================================
 * Note: Database schema creation and initial data seeding have been separated
 * to protect live production data from being overwritten on deployments.
 *
 * - Use 'npm run migrate' (scripts/migrate-schema.js) for safe schema migrations.
 * - Use 'npm run seed' (scripts/seed-initial-data.js) for initial data bootstrap.
 * ==============================================================================
 */

const { migrateSchema } = require('./migrate-schema');
const { seedData } = require('./seed-initial-data');

async function runAll() {
  console.log('ℹ️  Running safe schema migration first...');
  await migrateSchema();

  console.log('\nℹ️  Running data seeding (with overwrite guards)...');
  await seedData();
}

if (require.main === module) {
  runAll()
    .then(() => {
      console.log('✅ Combined migration process completed.');
      process.exit(0);
    })
    .catch(err => {
      console.error('❌ Migration error:', err);
      process.exit(1);
    });
}

module.exports = { runAll };
