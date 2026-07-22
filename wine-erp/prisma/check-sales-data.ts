import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const pool = new pg.Pool({
    connectionString: connectionString.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 1,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('--- 1. Sales Quotations ---')
    const quotations = await prisma.salesQuotation.groupBy({
        by: ['status'],
        _count: { id: true }
    })
    console.log('Sales Quotations by status:', quotations)

    console.log('\n--- 2. Proposals ---')
    const proposals = await prisma.proposal.groupBy({
        by: ['status'],
        _count: { id: true }
    })
    console.log('Proposals by status:', proposals)

    console.log('\n--- 3. Sales Orders ---')
    const salesOrders = await prisma.salesOrder.groupBy({
        by: ['status'],
        _count: { id: true }
    })
    console.log('Sales Orders by status:', salesOrders)

    console.log('\n--- 4. Invoices / Delivery / Payments ---')
    const invoices = await prisma.aRInvoice.count()
    const deliveryOrders = await prisma.deliveryOrder.count()
    const arPayments = await prisma.aRPayment.count()
    console.log(`ARInvoices: ${invoices}, DeliveryOrders: ${deliveryOrders}, ARPayments: ${arPayments}`)
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
