import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL!).replace('?sslmode=require', '')

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    const qts = await prisma.salesQuotation.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            customer: { select: { name: true } }
        }
    })
    console.log('--- LATEST QUOTATIONS ---')
    qts.forEach(q => {
        console.log(`ID: ${q.id} | No: ${q.quotationNo} | Customer: ${q.customer.name} | Total: ${q.totalAmount}`)
    })
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
