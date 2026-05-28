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
    const prodCount = await prisma.product.count()
    const supCount = await prisma.supplier.count()
    const custCount = await prisma.customer.count()
    const poCount = await prisma.purchaseOrder.count()
    const soCount = await prisma.salesOrder.count()
    const contractCount = await prisma.contract.count()

    console.log('--- DATABASE COUNT RESULTS ---')
    console.log(`Products: ${prodCount}`)
    console.log(`Suppliers: ${supCount}`)
    console.log(`Customers: ${custCount}`)
    console.log(`Purchase Orders: ${poCount}`)
    console.log(`Sales Orders: ${soCount}`)
    console.log(`Contracts: ${contractCount}`)
}

main().catch(console.error).finally(() => pool.end())
