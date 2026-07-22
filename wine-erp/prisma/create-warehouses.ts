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
    console.log('🏗️ Creating 3 Warehouses in DB...')

    // Fetch Legal Entities
    const thangAnLE = await prisma.legalEntity.findFirst({ where: { code: 'TA' } })
    const lysCellarLE = await prisma.legalEntity.findFirst({ where: { code: 'LC' } })

    const warehousesToCreate = [
        {
            code: 'WH-TA-GVM',
            name: 'Kho Thắng Ân (Giang Văn Minh tầng 2)',
            address: 'Tầng 2, Giang Văn Minh, Ba Đình, Hà Nội',
            legalEntityId: thangAnLE?.id || null,
        },
        {
            code: 'WH-TA-TT',
            name: 'Kho Thường Tín',
            address: 'Thường Tín, Hà Nội',
            legalEntityId: thangAnLE?.id || null,
        },
        {
            code: 'WH-LYS-SR',
            name: 'Kho Showroom (Lys)',
            address: 'Showroom Ly\'s Cellar, Hà Nội',
            legalEntityId: lysCellarLE?.id || null,
        }
    ]

    for (const wh of warehousesToCreate) {
        const created = await prisma.warehouse.upsert({
            where: { code: wh.code },
            update: {
                name: wh.name,
                address: wh.address,
                legalEntityId: wh.legalEntityId
            },
            create: {
                code: wh.code,
                name: wh.name,
                address: wh.address,
                legalEntityId: wh.legalEntityId
            }
        })
        console.log(`✓ Created/Updated Warehouse: [${created.code}] ${created.name}`)
    }

    console.log('\n--- All Active Warehouses ---')
    const allWh = await prisma.warehouse.findMany({
        include: { legalEntity: true },
        orderBy: { code: 'asc' }
    })
    allWh.forEach(w => {
        console.log(`- Code: ${w.code} | Name: ${w.name} | LegalEntity: ${w.legalEntity?.name || 'N/A'}`)
    })
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
