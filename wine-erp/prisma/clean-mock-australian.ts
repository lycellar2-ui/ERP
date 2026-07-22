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
    console.log('🧹 Removing mock Australian wines...')
    const mockSkus = [
        'PENFOLDS-GRANGE-2018-750',
        'HENSCHKE-HILL-GRACE-2017-750',
        'LEEUWIN-ART-CHARD-2020-750',
        'PENFOLDS-BIN389-2021-750',
        'TORBRECK-RUNRIG-2019-750'
    ]

    for (const sku of mockSkus) {
        const prod = await prisma.product.findUnique({ where: { skuCode: sku } })
        if (prod) {
            // Delete related StockLot, MarketPrice, ProductProfile, Product
            await prisma.stockLot.deleteMany({ where: { productId: prod.id } })
            await prisma.marketPrice.deleteMany({ where: { productId: prod.id } })
            await prisma.productProfile.deleteMany({ where: { productId: prod.id } })
            await prisma.product.delete({ where: { id: prod.id } })
            console.log(`  ❌ Deleted mock product: ${prod.productName} (${sku})`)
        }
    }
    console.log('✅ Cleanup complete!')
}

main()
    .catch(console.error)
    .finally(() => pool.end())
