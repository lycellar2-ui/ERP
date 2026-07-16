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
    const media = await prisma.productMedia.findMany({
        take: 20,
        select: {
            id: true,
            url: true,
            productId: true
        }
    })

    console.log('--- MEDIA LIST ---')
    for (const m of media) {
        console.log(`[${m.id}] ProductId: ${m.productId} | URL: ${m.url}`)
    }
}

main().catch(console.error).finally(() => pool.end())
