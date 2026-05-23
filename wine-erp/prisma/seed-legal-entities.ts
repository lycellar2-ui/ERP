/**
 * Seed Legal Entities — Thắng Ân + Ly's Cellar
 * Run: npx tsx prisma/seed-legal-entities.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 3,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🏢 Seeding Legal Entities...')

    // Check if already exists
    const existing = await prisma.legalEntity.findMany()
    if (existing.length > 0) {
        console.log(`  ⚠ Already ${existing.length} entities exist:`, existing.map(e => `${e.code} (${e.name})`).join(', '))
        console.log('  Skipping seed.')
        return
    }

    await prisma.legalEntity.create({
        data: {
            code: 'TA',
            name: 'Thắng Ân',
            taxId: '0316123456',
            address: 'TPHCM',
        },
    })

    await prisma.legalEntity.create({
        data: {
            code: 'LC',
            name: "Ly's Cellar",
            taxId: '0316789012',
            address: 'TPHCM',
        },
    })

    console.log('  ✓ Created: Thắng Ân (TA - Import) + Ly\'s Cellar (LC - Distribution)')
}

main()
    .catch(e => {
        console.error('❌ Seed failed:', e)
        process.exit(1)
    })
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
