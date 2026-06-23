import { Client } from 'pg'
import * as dotenv from 'dotenv'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
    await client.connect()
    console.log('Connected to DB')

    console.time('Raw SQL: select orders')
    const ordersRes = await client.query(`
        SELECT so.id, so."soNo", so."totalAmount", so."createdAt", 
               c.name as customer_name, c.code as customer_code,
               u.name as sales_rep_name,
               le.name as legal_entity_name,
               (SELECT COUNT(*)::int FROM sales_order_lines sol WHERE sol."soId" = so.id) as line_count
        FROM sales_orders so
        JOIN customers c ON c.id = so."customerId"
        JOIN users u ON u.id = so."salesRepId"
        JOIN legal_entities le ON le.id = so."legalEntityId"
        ORDER BY so."createdAt" DESC
        LIMIT 20 OFFSET 0
    `)
    console.timeEnd('Raw SQL: select orders')
    console.log(`- Loaded ${ordersRes.rows.length} rows`)

    console.time('Raw SQL: count orders')
    const countRes = await client.query(`SELECT COUNT(*)::int FROM sales_orders`)
    console.timeEnd('Raw SQL: count orders')
    console.log(`- Total orders count: ${countRes.rows[0].count}`)

    console.time('Raw SQL: get sales stats')
    const statsRes = await client.query(`
        SELECT 
            SUM(CASE WHEN status IN ('CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID') AND "createdAt" >= date_trunc('month', current_date) THEN "totalAmount" ELSE 0 END) as month_revenue,
            COUNT(CASE WHEN status IN ('CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID') AND "createdAt" >= date_trunc('month', current_date) THEN 1 END) as month_orders,
            COUNT(CASE WHEN status = 'PENDING_APPROVAL' THEN 1 END) as pending_approval,
            COUNT(CASE WHEN status = 'DRAFT' THEN 1 END) as draft,
            COUNT(CASE WHEN status = 'CONFIRMED' THEN 1 END) as confirmed
        FROM sales_orders
    `)
    console.timeEnd('Raw SQL: get sales stats')
    console.log(`- Stats:`, statsRes.rows[0])

    await client.end()
}

main().catch(console.error)
