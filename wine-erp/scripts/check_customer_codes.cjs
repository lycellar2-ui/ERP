const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
    const res = await pool.query('SELECT id, code, name, channel, "taxId" FROM public.customers ORDER BY code ASC');
    console.log('Total customers:', res.rows.length);

    console.log('\n--- CODES WITH LETTERS/NAMES (Sample 50) ---');
    res.rows.forEach(r => {
        // Check if code contains non-digits
        if (!/^\d+$/.test(r.code)) {
            console.log(`ID: ${r.id.padEnd(25)} | Code: ${r.code.padEnd(15)} | Name: ${r.name}`);
        }
    });

    await pool.end();
}

main().catch(console.error);
