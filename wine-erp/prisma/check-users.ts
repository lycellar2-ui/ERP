/**
 * Check and cleanup duplicate sale rep
 * Run: npx tsx prisma/check-users.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
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
    console.log('👤 Checking all users + roles...\n')

    const users = await prisma.user.findMany({
        include: {
            roles: {
                include: { role: { select: { name: true } } }
            }
        },
        orderBy: { name: 'asc' },
    })

    for (const u of users) {
        const roleNames = u.roles.map(r => r.role.name).join(', ') || '(no role)'
        console.log(`  ${u.email} → ${u.name} [${roleNames}]`)
    }
}

main()
    .catch(e => { console.error('❌ Failed:', e.message); process.exit(1) })
    .finally(async () => { await pool.end(); await prisma.$disconnect() })
