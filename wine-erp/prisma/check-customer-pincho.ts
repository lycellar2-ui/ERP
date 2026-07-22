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
    console.log('🔍 Checking Customer Pincho configuration...')

    const customers = await prisma.customer.findMany({
        where: {
            OR: [
                { name: { contains: 'Pincho', mode: 'insensitive' } },
                { code: { contains: 'Pincho', mode: 'insensitive' } },
            ]
        },
        include: {
            parent: true,
            priceRules: true,
        }
    })

    console.log(`Found ${customers.length} customers matching 'Pincho':`)
    for (const c of customers) {
        console.log({
            id: c.id,
            code: c.code,
            name: c.name,
            channel: c.channel,
            entityType: c.entityType,
            allowDirectSO: c.allowDirectSO,
            creditLimit: c.creditLimit,
            creditHold: c.creditHold,
            parentId: c.parentId,
            parentName: c.parent?.name,
            priceRulesCount: c.priceRules.length,
        })
    }
}

main().catch(console.error).finally(() => pool.end())
