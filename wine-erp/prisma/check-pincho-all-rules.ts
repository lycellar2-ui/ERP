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
    console.log('🔍 Deep Inspection of Pincho / Tinh Hoa Ẩm Thực Customer Records & Price Rules...')

    const customers = await prisma.customer.findMany({
        where: {
            OR: [
                { name: { contains: 'Pincho', mode: 'insensitive' } },
                { name: { contains: 'Tinh Hoa', mode: 'insensitive' } },
                { code: { contains: 'PINCHO', mode: 'insensitive' } },
            ]
        }
    })

    console.log(`Found ${customers.length} Pincho / Tinh Hoa customer records:`)
    for (const c of customers) {
        const rules = await prisma.customerPriceRule.findMany({
            where: { customerId: c.id },
            include: { product: { select: { skuCode: true, productName: true } } }
        })
        console.log({
            id: c.id,
            code: c.code,
            name: c.name,
            parentId: c.parentId,
            rulesCount: rules.length,
            rules: rules.map(r => ({ sku: r.product.skuCode, val: Number(r.value), status: r.status, endDate: r.endDate }))
        })
    }
}

main().catch(console.error).finally(() => pool.end())
