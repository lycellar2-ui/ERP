const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
    console.log('Searching all SKUs in database starting with L...');

    const res = await pool.query(`
        SELECT "skuCode", "productName", status, "createdAt" 
        FROM public.products 
        WHERE "skuCode" ILIKE 'L%'
        ORDER BY "skuCode" ASC
    `);

    console.log(`Total L-prefix products: ${res.rows.length}`);
    res.rows.forEach(r => {
        console.log(`SKU: ${r.skuCode.padEnd(12)} | Name: ${r.productName.padEnd(45)} | Status: ${r.status} | Created: ${r.createdAt}`);
    });

    await pool.end();
}

main().catch(console.error);
