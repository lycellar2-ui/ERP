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
    const codes = ['L20033', 'L20034', 'L20035', 'L20036', 'L20037', 'L20038', 'L20064', 'L20065', 'L20066', 'L20067']
    
    console.log('================ PRODUCTS IN DB ================')
    const products = await prisma.product.findMany({
        where: { skuCode: { in: codes } },
        include: { marginPrice: true }
    })
    for (const p of products) {
        console.log(`SKU: ${p.skuCode.padEnd(8)} | Name: ${p.productName} | WS: ${p.marginPrice?.wholesalePrice} | Retail: ${p.marginPrice?.retailPrice} | VAT: ${p.vatRate}%`)
    }

    const customers = await prisma.customer.findMany({
        where: {
            OR: [
                { name: { contains: 'Ambrys', mode: 'insensitive' } },
                { code: { contains: 'AMBRYS', mode: 'insensitive' } },
                { code: { contains: '10064', mode: 'insensitive' } },
            ]
        }
    })

    const customerIds = customers.map(c => c.id)

    console.log('\n================ SPECIAL PRICE RULES FOR THESE CODES ================')
    const rules = await prisma.customerPriceRule.findMany({
        where: {
            customerId: { in: customerIds },
            product: { skuCode: { in: codes } }
        },
        include: {
            customer: true,
            product: true
        }
    })

    if (rules.length === 0) {
        console.log('No price rules found for these SKU codes on Ambrys!')
    } else {
        for (const r of rules) {
            console.log(`Cust: ${r.customer.code} (${r.customer.name}) | SKU: ${r.product.skuCode} (${r.product.productName}) | Rule: ${r.ruleType} | Value: ${r.value} | Status: ${r.status} | Dates: ${r.startDate?.toISOString().slice(0,10)} -> ${r.endDate?.toISOString().slice(0,10)}`)
        }
    }

    console.log('\n================ ALL RULES ON HR10064-01 (Ambrys) ================')
    const ambrysChild = customers.find(c => c.code === 'HR10064-01')
    if (ambrysChild) {
        const ambrysRules = await prisma.customerPriceRule.findMany({
            where: { customerId: ambrysChild.id },
            include: { product: true }
        })
        console.log(`Total rules on HR10064-01: ${ambrysRules.length}`)
        for (const r of ambrysRules) {
            console.log(`SKU: ${r.product.skuCode} | Value: ${r.value} | Rule: ${r.ruleType} | Status: ${r.status} | Dates: ${r.startDate?.toISOString().slice(0,10)} -> ${r.endDate?.toISOString().slice(0,10)}`)
        }
    }
}

main().catch(console.error).finally(() => pool.end())
