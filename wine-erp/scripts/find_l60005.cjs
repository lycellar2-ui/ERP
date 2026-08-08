const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
    console.log('Searching for product L60005...');

    const res = await pool.query(`
        SELECT id, "skuCode", "productName", status, "wineType", "country", "producerId", "createdAt" 
        FROM public.products 
        WHERE "skuCode" ILIKE '%60005%' OR "productName" ILIKE '%60005%'
    `);

    console.log(`Found ${res.rows.length} product(s) matching L60005:`);
    console.log(JSON.stringify(res.rows, null, 2));

    console.log('\n--- 10 MOST RECENTLY CREATED PRODUCTS ---');
    const recent = await pool.query(`
        SELECT id, "skuCode", "productName", status, "wineType", "createdAt" 
        FROM public.products 
        ORDER BY "createdAt" DESC LIMIT 10
    `);
    console.log(JSON.stringify(recent.rows, null, 2));

    await pool.end();
}

main().catch(console.error);
