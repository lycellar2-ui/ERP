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
    console.log('--- Measuring DB performance for Sales queries ---')

    // 1. getSalesOrders
    console.time('Prisma findMany + count (getSalesOrders)')
    const [orders, total] = await Promise.all([
        prisma.salesOrder.findMany({
            skip: 0,
            take: 20,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: { select: { name: true, code: true } },
                salesRep: { select: { name: true } },
                legalEntity: { select: { name: true, code: true } },
                _count: { select: { lines: true } },
            },
        }),
        prisma.salesOrder.count(),
    ])
    console.timeEnd('Prisma findMany + count (getSalesOrders)')
    console.log(`- Loaded ${orders.length} orders, total in DB: ${total}`)

    // 2. getSalesStats
    console.time('Prisma aggregate + groupBy (getSalesStats)')
    const [totals, byStatus] = await Promise.all([
        prisma.salesOrder.aggregate({
            where: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
            },
            _sum: { totalAmount: true },
            _count: true,
        }),
        prisma.salesOrder.groupBy({
            by: ['status'],
            _count: true
        }),
    ])
    console.timeEnd('Prisma aggregate + groupBy (getSalesStats)')
    console.log(`- Monthly sum: ${totals._sum.totalAmount ?? 0}, Monthly count: ${totals._count}`)
    console.log(`- Group by status count: ${byStatus.length}`)

    // 3. getSOStatusCounts
    console.time('Prisma groupBy status (getSOStatusCounts)')
    const counts = await prisma.salesOrder.groupBy({
        by: ['status'],
        _count: { _all: true },
    })
    console.timeEnd('Prisma groupBy status (getSOStatusCounts)')
    console.log(`- Status counts tabs:`, counts)

    await prisma.$disconnect()
    await pool.end()
}

main().catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    await pool.end()
})
