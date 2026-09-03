import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
dotenv.config()

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
    console.log('📅 Extending all Special Price Rules and Price Mechanisms to 31.12.2026...\n')

    const newEndDate = new Date('2026-12-31T23:59:59.999Z')

    // 1. CustomerPriceRule (Cơ chế giá đặc biệt theo khách hàng)
    const totalRules = await prisma.customerPriceRule.count()
    const specialPriceRulesCount = await prisma.customerPriceRule.count({
        where: { ruleType: 'SPECIAL_PRICE' }
    })
    const approvedRulesCount = await prisma.customerPriceRule.count({
        where: { status: 'APPROVED' }
    })

    console.log(`📊 BEFORE UPDATE:`)
    console.log(`- Total rules in DB: ${totalRules}`)
    console.log(`- SPECIAL_PRICE rules: ${specialPriceRulesCount}`)
    console.log(`- APPROVED rules: ${approvedRulesCount}`)

    // Update all customer price rules to new endDate (31/12/2026)
    const updateResult = await prisma.customerPriceRule.updateMany({
        data: { endDate: newEndDate }
    })

    console.log(`\n✅ UPDATED: ${updateResult.count} CustomerPriceRules updated to endDate: ${newEndDate.toISOString()}`)

    // 2. PriceLists (Bảng giá kênh / đối tác)
    const priceLists = await prisma.priceList.findMany()
    console.log(`\n📊 Checking PriceLists (Total: ${priceLists.length})...`)
    let updatedPriceLists = 0
    for (const pl of priceLists) {
        if (pl.expiryDate && pl.expiryDate < newEndDate) {
            await prisma.priceList.update({
                where: { id: pl.id },
                data: { expiryDate: newEndDate }
            })
            updatedPriceLists++
            console.log(`  - Extended PriceList "${pl.name}" (${pl.channel}) to ${newEndDate.toISOString()}`)
        }
    }
    console.log(`✅ Extended ${updatedPriceLists} PriceLists.`)

    // 3. Contracts (Hợp đồng nguyên tắc / phụ lục giá đặc biệt)
    const contracts = await prisma.contract.findMany({
        where: { status: 'ACTIVE' }
    })
    console.log(`\n📊 Checking Active Contracts (Total: ${contracts.length})...`)
    let updatedContracts = 0
    for (const c of contracts) {
        if (c.endDate && c.endDate < newEndDate) {
            await prisma.contract.update({
                where: { id: c.id },
                data: { endDate: newEndDate }
            })
            updatedContracts++
            console.log(`  - Extended Contract "${c.contractNo}" to ${newEndDate.toISOString()}`)
        }
    }
    console.log(`✅ Extended ${updatedContracts} Contracts.`)

    // 4. Verify Active Rules
    const now = new Date()
    const activeRulesCountAfter = await prisma.customerPriceRule.count({
        where: {
            status: 'APPROVED',
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }]
        }
    })

    const sampleActive = await prisma.customerPriceRule.findMany({
        where: {
            status: 'APPROVED',
            startDate: { lte: now },
            OR: [{ endDate: null }, { endDate: { gte: now } }]
        },
        take: 5,
        include: {
            customer: { select: { code: true, name: true } },
            product: { select: { skuCode: true, productName: true } }
        }
    })

    console.log(`\n🎉 VERIFICATION AT ${now.toISOString()}:`)
    console.log(`- Currently ACTIVE & APPROVED price rules: ${activeRulesCountAfter} / ${totalRules}`)
    console.log(`\nSample active price rules:`)
    for (const r of sampleActive) {
        console.log(`  • [${r.customer?.code}] ${r.customer?.name} -> [${r.product?.skuCode}] ${r.product?.productName}: ${Number(r.value).toLocaleString()} đ (${r.ruleType}) [Hiệu lực đến: ${r.endDate?.toISOString().split('T')[0]}]`)
    }
}

main()
    .catch((e) => {
        console.error('❌ Error updating price rules:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
