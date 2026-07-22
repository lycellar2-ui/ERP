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
    console.log('Cleaning test warehouse E2E-WH-1...')
    try {
        const testWh = await prisma.warehouse.findUnique({ where: { code: 'E2E-WH-1' } })
        if (testWh) {
            await prisma.stockLot.deleteMany({
                where: { location: { warehouseId: testWh.id } }
            })
            await prisma.location.deleteMany({ where: { warehouseId: testWh.id } })
            await prisma.warehouse.delete({ where: { id: testWh.id } })
            console.log('✓ Successfully deleted test warehouse E2E-WH-1 & test stock lots')
        }
    } catch (e: any) {
        console.log('ℹ️ Warning:', e.message)
    }

    console.log('\n--- Final Warehouses in System ---')
    const warehouses = await prisma.warehouse.findMany({
        include: { legalEntity: true },
        orderBy: { code: 'asc' }
    })
    warehouses.forEach(w => {
        console.log(`- Code: ${w.code} | Name: ${w.name} | Address: ${w.address} | LegalEntity: ${w.legalEntity?.name || 'N/A'}`)
    })
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
