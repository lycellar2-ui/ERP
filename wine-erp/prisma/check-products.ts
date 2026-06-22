import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 3,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    const products = await prisma.product.findMany({
        where: { deletedAt: null },
        select: {
            id: true,
            productName: true,
            country: true,
            wineType: true,
            classification: true,
        },
        orderBy: { country: 'asc' },
    })

    console.log('--- WINE PRODUCTS LIST ---')
    for (const p of products) {
        console.log(`[${p.id}] ${p.productName} | Country: ${p.country} | Type: ${p.wineType} | Class: ${p.classification}`)
    }
}

main().catch(console.error).finally(() => pool.end())
