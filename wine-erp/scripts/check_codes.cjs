const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
  console.log('--- PRODUCT SKU SAMPLE ---');
  const skus = await pool.query(`SELECT "skuCode", "productName" FROM public.products WHERE "skuCode" LIKE 'L%' ORDER BY "skuCode" ASC LIMIT 50`);
  console.log(skus.rows);

  console.log('\n--- HIGHEST L-SKUS ---');
  const highSkus = await pool.query(`SELECT "skuCode", "productName", "createdAt" FROM public.products WHERE "skuCode" LIKE 'L%' ORDER BY "skuCode" DESC LIMIT 20`);
  console.log(highSkus.rows);

  console.log('\n--- CUSTOMER CODES ---');
  const custs = await pool.query(`SELECT code, name FROM public.customers WHERE code LIKE 'L%' ORDER BY code ASC LIMIT 20`);
  console.log(custs.rows);

  console.log('\n--- SUPPLIER CODES ---');
  const supps = await pool.query(`SELECT code, name FROM public.suppliers WHERE code LIKE 'L%' ORDER BY code ASC LIMIT 20`);
  console.log(supps.rows);

  await pool.end();
}
main().catch(console.error);
