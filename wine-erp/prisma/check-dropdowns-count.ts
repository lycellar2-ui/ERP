import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
dotenv.config({ path: '.env.local' })

const connectionString = process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    const [producersCount, vintagesCount, countriesCount, productsCount] = await Promise.all([
        prisma.producer.count(),
        prisma.stockLot.groupBy({
            by: ['vintage'],
            where: { vintage: { not: null } },
        }),
        prisma.product.groupBy({
            by: ['country'],
            where: { deletedAt: null },
        }),
        prisma.product.count({ where: { deletedAt: null } }),
    ])

    console.log(`Producers Count: ${producersCount}`)
    console.log(`Vintages Count: ${vintagesCount.length}`)
    console.log(`Countries Count: ${countriesCount.length}`)
    console.log(`Products Count: ${productsCount}`)
}

main().catch(console.error).finally(() => pool.end())
