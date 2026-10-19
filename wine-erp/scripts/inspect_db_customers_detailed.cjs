const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
    const res = await pool.query(`
        SELECT c.id, c.code, c.name, c.channel, c."taxId", c."parentId", p.code as parent_code
        FROM public.customers c
        LEFT JOIN public.customers p ON c."parentId" = p.id
        ORDER BY c.code ASC
    `);

    console.log('Total customer records in DB:', res.rows.length);

    console.log('\n--- SUSPICIOUS / INVALID / MOCK CUSTOMER RECORDS ---');
    const suspicious = res.rows.filter(r => 
        r.name.includes('Tên công ty') || 
        r.name.includes('Tên nhà hàng') || 
        r.code.startsWith('KH') || 
        !r.code
    );
    console.log(JSON.stringify(suspicious, null, 2));

    console.log('\n--- ALL CUSTOMER CODES IN DB (Count by prefix) ---');
    const prefixCount = {};
    res.rows.forEach(r => {
        const prefix = r.code.replace(/[\d-]/g, '') || 'PURE_NUMERIC';
        prefixCount[prefix] = (prefixCount[prefix] || 0) + 1;
    });
    console.log(prefixCount);

    await pool.end();
}

main().catch(console.error);
