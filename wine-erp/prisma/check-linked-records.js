const { Client } = require('pg');
const dotenv = require('dotenv');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    const soList = [
        'SO-2608-0105', 'SO-2608-0104', 'SO-2608-0103', 'SO-2608-0102', 'SO-2608-0101',
        'SO-2608-0097', 'SO-2608-0096', 'SO-2608-0095', 'SO-2608-0094', 'SO-2608-0093',
        'SO-2608-0092', 'SO-2608-0091', 'SO-2608-0049', 'SO-2608-0008', 'SO-2608-0006',
        'SO-2608-0005', 'SO-2608-0004', 'SO-2608-0003', 'SO-2608-0001'
    ];

    for (const soNo of soList) {
        const so = (await client.query(`SELECT id, "soNo", "customerId" FROM sales_orders WHERE "soNo" = $1`, [soNo])).rows[0];
        const inv = (await client.query(`SELECT id, "invoiceNo", "customerId" FROM ar_invoices WHERE "soId" = $1`, [so.id])).rows;
        const doList = (await client.query(`SELECT id, "doNo", "soId" FROM delivery_orders WHERE "soId" = $1`, [so.id])).rows;

        console.log(`SO: ${so.soNo} -> Invoices: ${inv.map(i => i.invoiceNo).join(', ') || 'None'} | DOs: ${doList.map(d => d.doNo).join(', ') || 'None'}`);
    }

    await client.end();
}

main().catch(console.error);
