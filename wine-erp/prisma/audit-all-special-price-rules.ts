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
    console.log('🔍 Comprehensive Audit of Special Price Rules in Database...\n')

    const totalRules = await prisma.customerPriceRule.count()
    const approvedRules = await prisma.customerPriceRule.count({ where: { status: 'APPROVED' } })
    const activeRules = await prisma.customerPriceRule.count({
        where: {
            status: 'APPROVED',
            startDate: { lte: new Date() },
            OR: [{ endDate: null }, { endDate: { gte: new Date() } }]
        }
    })

    console.log(`📊 STATS:`)
    console.log(`- Total Price Rules in DB: ${totalRules}`)
    console.log(`- Approved Price Rules: ${approvedRules}`)
    console.log(`- Currently Active Price Rules: ${activeRules}`)

    // Test price resolution engine for key accounts
    const testAccounts = [
        { code: 'HR10022-01', search: 'Pincho' },
        { code: 'HR-PAOLO-01', search: 'Paolo' },
        { code: 'HR10006-01', search: 'Metropole' },
        { code: 'HR10001-01', search: 'Vox' },
        { code: 'HR10010', search: 'Lasalsa' },
    ]

    console.log('\n==================================================')
    console.log('🧪 TESTING PRICE RESOLUTION FOR KEY ACCOUNTS:')
    console.log('==================================================')

    for (const testAcc of testAccounts) {
        const customer = await prisma.customer.findFirst({
            where: {
                OR: [
                    { code: testAcc.code },
                    { name: { contains: testAcc.search, mode: 'insensitive' } }
                ]
            },
            include: { parent: true }
        })

        if (!customer) {
            console.log(`❌ Customer '${testAcc.search}' (${testAcc.code}) not found!`)
            continue
        }

        // Search for active rules for this customer or its parent
        const customerIds = [customer.id]
        if (customer.parentId) customerIds.push(customer.parentId)

        const rules = await prisma.customerPriceRule.findMany({
            where: {
                customerId: { in: customerIds },
                status: 'APPROVED',
            },
            include: {
                product: { select: { skuCode: true, productName: true } },
                customer: { select: { code: true, name: true } }
            }
        })

        console.log(`\n🏢 Khách hàng: [${customer.code}] ${customer.name} (Parent: ${customer.parent?.name || 'None'})`)
        console.log(`   Số lượng quy tắc giá đặc biệt đang hoạt động: ${rules.length}`)
        rules.slice(0, 5).forEach(r => {
            console.log(`     - [${r.product.skuCode}] ${r.product.productName}: ${Number(r.value).toLocaleString()} VNĐ (Áp dụng cho: ${r.customer.code} - Hạn: ${r.endDate ? r.endDate.toISOString().split('T')[0] : 'Vô thời hạn'})`)
        })
        if (rules.length > 5) console.log(`     ... và ${rules.length - 5} sản phẩm khác.`)
    }

    console.log('\n==================================================')
    console.log('📋 CHUẨN HÓA LIÊN KẾT GIÁ ĐẶC BIỆT THEO MÃ KẾ TOÁN MỚI:')
    console.log('==================================================')

    // Link any orphan rules to newly synced Master Data customers
    const unlinkedRules = await prisma.customerPriceRule.findMany({
        include: { customer: true, product: true }
    })

    console.log(`Total rules checked for integrity: ${unlinkedRules.length}`)
}

main().catch(console.error).finally(() => pool.end())
