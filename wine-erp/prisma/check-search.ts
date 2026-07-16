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
    allowExitOnIdle: true,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    // Fetch first 5 orders sorted by createdAt desc
    const query = `
        SELECT so.id, so."soNo", so."totalAmount", so.channel, so.status, 
               c.name as customer_name, c.code as customer_code
        FROM sales_orders so
        JOIN customers c ON c.id = so."customerId"
        ORDER BY so."createdAt" desc
        LIMIT 5
    `

    const rows = await prisma.$queryRawUnsafe<any[]>(query)
    console.log('Top 5 rows:')
    console.log(rows.map((r: any) => ({ soNo: r.soNo, customer: r.customer_name })))
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
    })
