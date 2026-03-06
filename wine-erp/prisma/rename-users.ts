/**
 * Quick script to rename users
 * Run: npx tsx prisma/rename-users.ts
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
    console.log('🔄 Đổi tên nhân viên...\n')

    const renames = [
        { email: 'thumua@lyscellars.com', newName: 'Nga (Mua Hàng)' },
        { email: 'ketoan@lyscellars.com', newName: 'Trà (Kế toán)' },
        { email: 'sales01@lyscellars.com', newName: 'Khánh (Sale rep)' },
        { email: 'sales.mgr@lyscellars.com', newName: 'Jeremy (Sale Manager)' },
    ]

    for (const r of renames) {
        const result = await prisma.user.updateMany({
            where: { email: r.email },
            data: { name: r.newName },
        })
        console.log(`  ${result.count > 0 ? '✅' : '⚠️'} ${r.email} → ${r.newName}`)
    }

    // Verify
    const all = await prisma.user.findMany({
        select: { email: true, name: true },
        orderBy: { name: 'asc' },
    })
    console.log('\n👤 Danh sách nhân viên hiện tại:')
    all.forEach(u => console.log(`   ${u.email}: ${u.name}`))
}

main()
    .catch(e => { console.error('❌ Failed:', e.message); process.exit(1) })
    .finally(async () => { await pool.end(); await prisma.$disconnect() })
