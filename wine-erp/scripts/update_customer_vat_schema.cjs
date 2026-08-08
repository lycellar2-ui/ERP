const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS "vatCompanyName" TEXT;');
  await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS "vatAddress" TEXT;');
  await pool.query('ALTER TABLE customers ADD COLUMN IF NOT EXISTS "vatEmail" TEXT;');
  console.log('✅ Successfully added VAT columns to customers table in database.');
  pool.end();
}
run();
