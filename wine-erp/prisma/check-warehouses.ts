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
    console.log('--- Current Warehouses ---')
    const warehouses = await prisma.warehouse.findMany({
        include: { legalEntity: true }
    })
    console.log(`Total warehouses: ${warehouses.length}`)
    warehouses.forEach(w => {
        console.log(`- ID: ${w.id} | Code: ${w.code} | Name: ${w.name} | Address: ${w.address || 'N/A'} | LegalEntity: ${w.legalEntity?.name || 'N/A'}`)
    })
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
