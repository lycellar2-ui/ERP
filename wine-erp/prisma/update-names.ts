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
    console.log('🔄 Updating user names...')

    // 1. admin@lyscellars.com -> Admin Hệ Thống
    await prisma.user.updateMany({
        where: { email: 'admin@lyscellars.com' },
        data: { name: 'Admin Hệ Thống' }
    })
    console.log('✓ Updated admin@lyscellars.com -> Admin Hệ Thống')

    // 2. lyptc@lyscellars.com -> CEO
    await prisma.user.updateMany({
        where: { email: 'lyptc@lyscellars.com' },
        data: { name: 'CEO' }
    })
    console.log('✓ Updated lyptc@lyscellars.com -> CEO')

    console.log('\n--- Final User List ---')
    const users = await prisma.user.findMany({
        include: { roles: { include: { role: true } } },
        orderBy: { name: 'asc' }
    })
    users.forEach(u => {
        console.log(`- Email: ${u.email}, Name: ${u.name}, Roles: ${u.roles.map(r => r.role.name).join(', ')}`)
    })
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
