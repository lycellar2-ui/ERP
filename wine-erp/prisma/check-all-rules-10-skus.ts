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
    const targetCodes = ['L20033', 'L20034', 'L20035', 'L20036', 'L20037', 'L20038', 'L20064', 'L20065', 'L20066', 'L20067']

    console.log('=== TẤT CẢ KHÁCH CÓ GIÁ ĐẶC BIỆT CHO 10 MÃ NÀY ===')
    const allRules = await prisma.customerPriceRule.findMany({
        where: {
            product: { skuCode: { in: targetCodes } }
        },
        include: {
            customer: true,
            product: true
        }
    })
    console.log(`Tìm thấy tổng cộng ${allRules.length} rules trên toàn hệ thống:`)
    for (const r of allRules) {
        console.log(`- Cust: ${r.customer.code} (${r.customer.name}) | SKU: ${r.product.skuCode} | Rule: ${r.ruleType} | Giá: ${r.value}`)
    }
}

main().catch(console.error).finally(() => pool.end())
