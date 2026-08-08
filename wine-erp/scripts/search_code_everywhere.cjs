const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
    console.log('Searching for 60005 across database tables...');

    // 1. Check products
    const prodRes = await pool.query('SELECT * FROM public.products WHERE "skuCode" ILIKE \'%60005%\' OR "productName" ILIKE \'%60005%\'');
    console.log('products table matches:', prodRes.rows.length);

    // 2. Check inventory_lots
    const lotRes = await pool.query('SELECT * FROM public.inventory_lots WHERE "lotNumber" ILIKE \'%60005%\'');
    console.log('inventory_lots table matches:', lotRes.rows.length);

    // 3. Check audit_logs
    const auditRes = await pool.query('SELECT * FROM public.audit_logs WHERE details::text ILIKE \'%60005%\' LIMIT 10');
    console.log('audit_logs matches:', auditRes.rows.length);
    if (auditRes.rows.length > 0) {
        console.log(JSON.stringify(auditRes.rows, null, 2));
    }

    // 4. Check all product SKU codes starting with L6
    const l6Res = await pool.query('SELECT "skuCode", "productName", status, "createdAt" FROM public.products WHERE "skuCode" ILIKE \'L6%\'');
    console.log('\n--- Products starting with L6 ---');
    console.log(JSON.stringify(l6Res.rows, null, 2));

    await pool.end();
}

main().catch(console.error);
