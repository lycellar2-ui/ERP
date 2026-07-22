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
    console.log('🔍 Checking Price Rules for Tinh Hoa Âm Thực & Pincho...')

    const customers = await prisma.customer.findMany({
        where: {
            OR: [
                { name: { contains: 'Tinh Hoa', mode: 'insensitive' } },
                { name: { contains: 'Pincho', mode: 'insensitive' } },
                { code: { contains: 'PINCHO', mode: 'insensitive' } },
            ]
        }
    })

    const customerIds = customers.map(c => c.id)
    console.log('Found Customers:', customers.map(c => ({ id: c.id, code: c.code, name: c.name, parentId: c.parentId })))

    const rules = await prisma.customerPriceRule.findMany({
        where: {
            customerId: { in: customerIds }
        },
        include: {
            customer: { select: { code: true, name: true } },
            product: { select: { skuCode: true, productName: true } },
        }
    })

    console.log(`\nFound ${rules.length} CustomerPriceRules:`)
    for (const r of rules) {
        console.log({
            id: r.id,
            customerCode: r.customer.code,
            customerName: r.customer.name,
            productSku: r.product.skuCode,
            productName: r.product.productName,
            ruleType: r.ruleType,
            value: Number(r.value),
            startDate: r.startDate,
            endDate: r.endDate,
            status: r.status,
        })
    }

    // Also check if there are price rules with ANY customer whose name contains Tinh Hoa or Pincho
    const allRules = await prisma.customerPriceRule.findMany({
        include: {
            customer: { select: { code: true, name: true } },
            product: { select: { skuCode: true, productName: true } }
        }
    })

    console.log(`\nTotal Price Rules in entire DB: ${allRules.length}`)
    for (const r of allRules) {
        console.log(`- Rule ID ${r.id}: Customer [${r.customer.code}] ${r.customer.name} | Product [${r.product.skuCode}] | Status: ${r.status} | Value: ${r.value}`)
    }
}

main().catch(console.error).finally(() => pool.end())
