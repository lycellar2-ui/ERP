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
    console.log('📌 Linking Price Rules to ALL Pincho & Tinh Hoa Ẩm Thực Accounts...')

    const adminUser = await prisma.user.findFirst()
    if (!adminUser) throw new Error('No admin user found!')

    // All Pincho & Tinh Hoa customer accounts in database
    const pinchoCustomers = await prisma.customer.findMany({
        where: {
            OR: [
                { name: { contains: 'Pincho', mode: 'insensitive' } },
                { name: { contains: 'Tinh Hoa', mode: 'insensitive' } },
                { code: { contains: 'PINCHO', mode: 'insensitive' } },
            ]
        }
    })

    console.log(`Found ${pinchoCustomers.length} Pincho customer accounts in DB:`)
    pinchoCustomers.forEach(c => console.log(`  - [${c.code}] ${c.name} (ID: ${c.id})`))

    // 7 Special Price Rules for Tinh Hoa Ẩm Thực Group (Pincho)
    const pinchoRules = [
        { sku: 'L50001', price: 189000, note: 'Rượu rót ly (By glass)' },
        { sku: 'L20053', price: 359100, note: 'Chiết khấu 10%' },
        { sku: 'L20033', price: 400000, note: 'Giá đặc biệt HORECA' },
        { sku: 'L60003', price: 470000, note: 'Giá đặc biệt HORECA' },
        { sku: 'L60004', price: 470000, note: 'Giá đặc biệt HORECA' },
        { sku: 'L20002', price: 330000, note: 'Giá đặc biệt HORECA' },
        { sku: 'L20016', price: 530000, note: 'Giá đặc biệt HORECA' },
    ]

    const startDate = new Date('2026-01-01T00:00:00.000Z')
    const endDate = new Date('2026-07-31T23:59:59.999Z')

    let count = 0

    for (const cust of pinchoCustomers) {
        for (const item of pinchoRules) {
            const product = await prisma.product.findUnique({
                where: { skuCode: item.sku }
            })

            if (!product) continue

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
                        notes: `Linked to [${cust.code}] ${cust.name} - ${item.note}`,
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
                        notes: `Linked to [${cust.code}] ${cust.name} - ${item.note}`,
                    }
                })
            }
            count++
        }
    }

    console.log(`\n🎉 HOÀN TẤT: Đã gán thành công ${count} quy tắc Giá Đặc Biệt cho tất cả ${pinchoCustomers.length} tài khoản Pincho/Tinh Hoa Ẩm Thực!`)
}

main().catch(console.error).finally(() => pool.end())
