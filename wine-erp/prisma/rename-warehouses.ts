/**
 * Quick script to rename warehouses
 * Run: npx tsx prisma/rename-warehouses.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

// Supabase pooler uses self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!.replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
    max: 2,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('🔄 Đổi tên kho...\n')

    const renames = [
        { code: 'KHO-HCM-01', newName: 'Kho Cửa hàng' },
        { code: 'KHO-HNI-01', newName: 'Kho Thường Tín' },
        { code: 'SHOWROOM-HCM', newName: 'Showroom Giang Văn Minh' },
    ]

    for (const r of renames) {
        const result = await prisma.warehouse.updateMany({
            where: { code: r.code },
            data: { name: r.newName },
        })
        console.log(`  ${result.count > 0 ? '✅' : '⚠️'} ${r.code} → ${r.newName}`)
    }

    // Verify
    const all = await prisma.warehouse.findMany({ select: { code: true, name: true } })
    console.log('\n📦 Danh sách kho hiện tại:')
    all.forEach(w => console.log(`   ${w.code}: ${w.name}`))
}

main()
    .catch(e => { console.error('❌ Failed:', e.message); process.exit(1) })
    .finally(async () => { await pool.end(); await prisma.$disconnect() })
