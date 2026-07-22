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
    console.log('🔍 Searching for Paolo in Customer Master Data...')

    const customers = await prisma.customer.findMany({
        where: {
            OR: [
                { name: { contains: 'Paolo', mode: 'insensitive' } },
                { name: { contains: 'Chi', mode: 'insensitive' } },
                { code: { contains: 'PAOLO', mode: 'insensitive' } },
            ]
        }
    })

    console.log(`Found ${customers.length} matching customers:`)
    for (const c of customers) {
        console.log({ id: c.id, code: c.code, name: c.name, channel: c.channel, parentId: c.parentId })
    }
}

main().catch(console.error).finally(() => pool.end())
