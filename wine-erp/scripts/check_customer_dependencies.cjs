const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
    const invalidCodes = ['HR10103', 'HR10103-01', 'KH0001', 'KH0001-M', 'KH1', 'KH1-M'];

    for (const code of invalidCodes) {
        const custRes = await pool.query('SELECT id, name FROM public.customers WHERE code = $1', [code]);
        if (custRes.rows.length === 0) continue;
        const custId = custRes.rows[0].id;
        const custName = custRes.rows[0].name;

        const soCount = await pool.query('SELECT COUNT(*) FROM public.sales_orders WHERE "customerId" = $1', [custId]);
        const rulesCount = await pool.query('SELECT COUNT(*) FROM public.customer_price_rules WHERE "customerId" = $1', [custId]);
        
        console.log(`Code: ${code} (${custName}) -> SalesOrders: ${soCount.rows[0].count}, PriceRules: ${rulesCount.rows[0].count}`);
    }

    await pool.end();
}

main().catch(console.error);
