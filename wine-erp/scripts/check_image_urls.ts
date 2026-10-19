import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!
const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 1,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('Querying product L40009 media...')
    const product = await prisma.product.findFirst({
        where: { skuCode: 'L40009' },
        include: { media: true }
    })
    
    if (!product) {
        console.error('Product L40009 not found!')
        return
    }
    
    console.log(`Product found: ${product.productName}`)
    const primaryMedia = product.media.find(m => m.isPrimary) || product.media[0]
    if (!primaryMedia) {
        console.error('No media records found for this product!')
        return
    }
    
    console.log(`Updating media ID: ${primaryMedia.id}`)
    console.log(`Old URL: ${primaryMedia.url}`)
    
    const targetUrl = 'https://i.ibb.co/XNHvDxc/L40009.png'
    const updated = await prisma.productMedia.update({
        where: { id: primaryMedia.id },
        data: {
            url: targetUrl,
            thumbnailUrl: targetUrl,
            mediumUrl: targetUrl
        }
    })
    
    console.log('Update successful!')
    console.log(`New URL: ${updated.url}`)
}

main()
    .catch(console.error)
    .finally(async () => { await pool.end(); await prisma.$disconnect(); })
