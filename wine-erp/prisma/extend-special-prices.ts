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
    console.log('📅 Extending all SPECIAL_PRICE rules to 31.08.2026...\n')

    const newEndDate = new Date('2026-08-31T23:59:59.999Z')

    // Count rules by ruleType before update
    const totalRules = await prisma.customerPriceRule.count()
    const specialPriceRulesCount = await prisma.customerPriceRule.count({
        where: { ruleType: 'SPECIAL_PRICE' }
    })

    console.log(`📊 BEFORE UPDATE:`)
    console.log(`- Total rules in DB: ${totalRules}`)
    console.log(`- SPECIAL_PRICE rules: ${specialPriceRulesCount}`)

    // Update all customer price rules (or SPECIAL_PRICE rules) to new endDate
    const updateResult = await prisma.customerPriceRule.updateMany({
        data: { endDate: newEndDate }
    })

    console.log(`\n✅ UPDATED: ${updateResult.count} price rules updated to endDate: ${newEndDate.toISOString()}`)

    // Verify after update
    const activeRulesCountAfter = await prisma.customerPriceRule.count({
        where: {
            status: 'APPROVED',
            startDate: { lte: new Date() },
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }]
        }
    })

    console.log(`\n🎉 VERIFICATION:`)
    console.log(`- Currently active approved price rules: ${activeRulesCountAfter}`)
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
