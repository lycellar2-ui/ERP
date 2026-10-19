const pg = require('pg');
require('dotenv').config({ path: '.env.local' });

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL).replace('?sslmode=require', '');
const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function main() {
    console.log('Cleaning invalid dummy customer records...');

    const res = await pool.query("SELECT id FROM public.customers WHERE code IN ('HR10103-01', 'HR10103')");
    const ids = res.rows.map(r => r.id);

    if (ids.length > 0) {
        await pool.query("DELETE FROM public.customer_addresses WHERE \"customerId\" = ANY($1)", [ids]);
        await pool.query("DELETE FROM public.customer_contacts WHERE \"customerId\" = ANY($1)", [ids]);
        await pool.query("DELETE FROM public.customers WHERE id = ANY($1)", [ids]);
        console.log('✓ Successfully deleted placeholder rows HR10103 and HR10103-01 and their associated addresses/contacts');
    }

    await pool.end();
}

main().catch(console.error);
