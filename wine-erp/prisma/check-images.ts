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
    const products = await prisma.product.findMany({
        where: { deletedAt: null },
        include: {
            media: true
        }
    })

    console.log(`Products Count: ${products.length}`)
    const images = products.flatMap(p => p.media.map(m => ({
        productName: p.productName,
        url: m.url
    })))
    
    console.log(`Images Count: ${images.length}`)
    for (const img of images.slice(0, 15)) {
        console.log(`Product: ${img.productName} | Image URL: ${img.url}`)
    }
}

main().catch(console.error).finally(() => pool.end())
