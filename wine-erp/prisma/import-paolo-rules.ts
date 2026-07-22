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
    console.log('🍕 Importing Special Prices for Paolo & Chi...')

    const adminUser = await prisma.user.findFirst()
    if (!adminUser) throw new Error('No admin user found!')

    // Find all Paolo & Chi customer accounts (Parent + Subsidiaries)
    const paoloCustomers = await prisma.customer.findMany({
        where: {
            OR: [
                { code: 'HR-PAOLO' },
                { code: 'HR-PAOLO-CHUNG' },
                { code: 'HR-PAOLO-01' },
                { code: 'HR-PAOLO-NT' },
                { code: 'HR-PAOLO-03' },
            ]
        }
    })

    console.log(`Found ${paoloCustomers.length} Paolo & Chi customer accounts in Master Data.`)

    const paoloRules = [
        { sku: 'L10023', price: 360000 },
        { sku: 'L30001', price: 216000 },
        { sku: 'L30003', price: 216000 },
        { sku: 'L60001', price: 315000 },
        { sku: 'L60002', price: 315000 },
        { sku: 'L10025', price: 360000 },
        { sku: 'L10028', price: 390000 },
        { sku: 'L10029', price: 390000 },
        { sku: 'L10015', price: 579500 },
        { sku: 'L10017', price: 520000 },
        { sku: 'L20017', price: 399000 },
        { sku: 'L20016', price: 399000 },
    ]

    const startDate = new Date('2026-01-01T00:00:00.000Z')
    const endDate = new Date('2026-07-31T23:59:59.999Z')

    let count = 0

    for (const cust of paoloCustomers) {
        for (const item of paoloRules) {
            const product = await prisma.product.findUnique({
                where: { skuCode: item.sku }
            })

            if (!product) {
                console.warn(`  ⚠️ Product SKU not found: ${item.sku}`)
                continue
            }

            const existingRule = await prisma.customerPriceRule.findFirst({
                where: {
                    customerId: cust.id,
                    productId: product.id,
                }
            })

            if (existingRule) {
                await prisma.customerPriceRule.update({
                    where: { id: existingRule.id },
                    data: {
                        ruleType: 'FIXED_PRICE',
                        value: item.price,
                        startDate,
                        endDate,
                        status: 'APPROVED',
                        notes: 'Imported from Paolo&Chi proposal sheet - Expiry 31/07/2026',
                    }
                })
            } else {
                await prisma.customerPriceRule.create({
                    data: {
                        customerId: cust.id,
                        productId: product.id,
                        ruleType: 'FIXED_PRICE',
                        value: item.price,
                        startDate,
                        endDate,
                        status: 'APPROVED',
                        requestedBy: adminUser.id,
                        approvedBy: adminUser.id,
                        approvedAt: new Date(),
                        notes: 'Imported from Paolo&Chi proposal sheet - Expiry 31/07/2026',
                    }
                })
            }
            count++
        }
    }

    console.log(`\n🎉 THÀNH CÔNG: Đã nạp & kích hoạt ${count} quy tắc Giá Đặc Biệt cho Paolo & Chi!`)
}

main().catch(console.error).finally(() => pool.end())
