const { Client } = require('pg');
const dotenv = require('dotenv');
const fs = require('fs');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
dotenv.config({ path: '.env.local' });

async function main() {
    const client = new Client({
        connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();

    // 1. HR10109 check
    const hr10109 = await client.query(`
        SELECT id, code, name, "entityType", "allowDirectSO", "parentId", status
        FROM customers
        WHERE code LIKE '%HR10109%' OR id IN (SELECT "parentId" FROM customers WHERE code LIKE '%HR10109%')
    `);

    // 2. Self referencing
    const selfRef = await client.query(`
        SELECT id, code, name, "parentId"
        FROM customers
        WHERE "parentId" = id
    `);

    // 3. Orders on parent
    const orders = await client.query(`
        SELECT 
            so."soNo",
            so.status as so_status,
            so."totalAmount",
            so."createdAt",
            so.notes,
            u.name as sales_rep,
            c.code as customer_code,
            c.name as customer_name,
            c."entityType",
            c."allowDirectSO",
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id AND child.id != c.id) as child_count,
            (
                SELECT string_agg(child.code || ' (' || child.name || ')', '; ')
                FROM customers child 
                WHERE child."parentId" = c.id AND child.id != c.id
            ) as child_list
        FROM sales_orders so
        JOIN customers c ON so."customerId" = c.id
        LEFT JOIN users u ON so."salesRepId" = u.id
        WHERE 
            (SELECT COUNT(*) FROM customers child WHERE child."parentId" = c.id AND child.id != c.id) > 0
            OR (c."entityType" = 'COMPANY' AND c."allowDirectSO" = false)
        ORDER BY so."createdAt" DESC
    `);

    const result = {
        hr10109: hr10109.rows,
        selfRef: selfRef.rows,
        ordersOnParentCount: orders.rows.length,
        orders: orders.rows
    };

    fs.writeFileSync('parent_orders_result.json', JSON.stringify(result, null, 2), 'utf-8');
    console.log('Saved to parent_orders_result.json successfully!');
    await client.end();
}

main().catch(console.error);
