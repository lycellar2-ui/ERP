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
    console.log('🔄 Converting all FIXED_PRICE rules to SPECIAL_PRICE rules...')

    const beforeFixedCount = await prisma.customerPriceRule.count({
        where: { ruleType: 'FIXED_PRICE' }
    })
    const beforeSpecialCount = await prisma.customerPriceRule.count({
        where: { ruleType: 'SPECIAL_PRICE' }
    })

    console.log(`Before Update:`)
    console.log(`- FIXED_PRICE rules: ${beforeFixedCount}`)
    console.log(`- SPECIAL_PRICE rules: ${beforeSpecialCount}`)

    const result = await prisma.customerPriceRule.updateMany({
        where: { ruleType: 'FIXED_PRICE' },
        data: { ruleType: 'SPECIAL_PRICE' }
    })

    const afterFixedCount = await prisma.customerPriceRule.count({
        where: { ruleType: 'FIXED_PRICE' }
    })
    const afterSpecialCount = await prisma.customerPriceRule.count({
        where: { ruleType: 'SPECIAL_PRICE' }
    })

    console.log(`\nAfter Update:`)
    console.log(`- FIXED_PRICE rules remaining: ${afterFixedCount}`)
    console.log(`- SPECIAL_PRICE rules total: ${afterSpecialCount}`)
    console.log(`\n🎉 THÀNH CÔNG: Đã chuyển đổi ${result.count} quy tắc từ 'Giá Cố Định' (FIXED_PRICE) sang 'Giá Đặc Biệt' (SPECIAL_PRICE)!`)
}

main().catch(console.error).finally(() => pool.end())
