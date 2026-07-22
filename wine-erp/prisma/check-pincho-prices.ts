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
    console.log('🔍 Checking why Pincho gets retail prices...')

    const pincho = await prisma.customer.findFirst({
        where: { name: { contains: 'Pincho', mode: 'insensitive' } }
    })

    if (!pincho) {
        console.log('Pincho not found!')
        return
    }

    console.log('Pincho Customer:', {
        id: pincho.id,
        code: pincho.code,
        name: pincho.name,
        channel: pincho.channel,
    })

    // Check Price Lists in database
    const priceLists = await prisma.priceList.findMany({
        include: {
            _count: { select: { lines: true } }
        }
    })

    console.log('\nPrice Lists in DB:')
    for (const pl of priceLists) {
        console.log(`- [${pl.id}] ${pl.name} | Channel: ${pl.channel} | Lines: ${pl._count.lines}`)
    }

    // Check Customer Price Rules for Pincho
    const rules = await prisma.customerPriceRule.findMany({
        where: { customerId: pincho.id }
    })
    console.log(`\nCustomer Price Rules for Pincho: ${rules.length}`)
}

main().catch(console.error).finally(() => pool.end())
