import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
}

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 15000,
    allowExitOnIdle: true,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('--- Measuring DB performance for Sales queries via $queryRawUnsafe ---')

    const page = 1
    const pageSize = 20
    const skip = (page - 1) * pageSize
    
    // Test parameters
    const search = undefined
    const status = undefined
    const dateFrom = undefined
    const dateTo = undefined
    
    const params: any[] = []
    let paramIndex = 1
    const conditions: string[] = []

    if (status) {
        conditions.push(`so.status = $${paramIndex++}`)
        params.push(status)
    }

    if (search) {
        conditions.push(`(so."soNo" ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex} OR c.code ILIKE $${paramIndex})`)
        params.push(`%${search}%`)
        paramIndex++
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    
    const queryParams = [...params, pageSize, skip]
    const limitPlaceholder = `$${paramIndex++}`
    const offsetPlaceholder = `$${paramIndex++}`

    const query = `
        SELECT so.id, so."soNo", so."totalAmount", so.channel, so.status, so."paymentTerm", so."orderDiscount", NULL as notes, so."createdAt", 
               c.name as customer_name, c.code as customer_code,
               u.name as sales_rep_name,
               le.name as legal_entity_name, le.code as legal_entity_code,
               (SELECT COUNT(*)::int FROM sales_order_lines sol WHERE sol."soId" = so.id) as line_count
        FROM sales_orders so
        JOIN customers c ON c.id = so."customerId"
        JOIN users u ON u.id = so."salesRepId"
        JOIN legal_entities le ON le.id = so."legalEntityId"
        ${whereClause}
        ORDER BY so."createdAt" DESC
        LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}
    `

    const countQuery = `
        SELECT COUNT(*)::int as total
        FROM sales_orders so
        JOIN customers c ON c.id = so."customerId"
        JOIN users u ON u.id = so."salesRepId"
        JOIN legal_entities le ON le.id = so."legalEntityId"
        ${whereClause}
    `

    console.time('Raw SQL via Prisma $queryRawUnsafe (getSalesOrders)')
    const [orders, countResult] = await Promise.all([
        prisma.$queryRawUnsafe<any[]>(query, ...queryParams),
        prisma.$queryRawUnsafe<any[]>(countQuery, ...params),
    ])
    console.timeEnd('Raw SQL via Prisma $queryRawUnsafe (getSalesOrders)')
    
    const total = countResult[0]?.total ?? 0
    console.log(`- Loaded ${orders.length} orders, total in DB: ${total}`)
    if (orders.length > 0) {
        console.log(`- Sample row:`, {
            id: orders[0].id,
            soNo: orders[0].soNo,
            customerName: orders[0].customer_name,
            totalAmount: Number(orders[0].totalAmount),
            lineCount: orders[0].line_count
        })
    }

    await prisma.$disconnect()
    await pool.end()
}

main().catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    await pool.end()
})
