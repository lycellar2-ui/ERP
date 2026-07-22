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
    console.log('🔄 Updating database user records & roles...')

    // 1. Update Kế toán email: ketoan@lyscellars.com -> accounting@lyscellars.com
    const ketoanUser = await prisma.user.findFirst({
        where: { email: 'ketoan@lyscellars.com' }
    })

    if (ketoanUser) {
        await prisma.user.update({
            where: { id: ketoanUser.id },
            data: { email: 'accounting@lyscellars.com' }
        })
        console.log('✓ Updated Prisma User email: ketoan@lyscellars.com -> accounting@lyscellars.com')
    } else {
        console.log('ℹ️ User ketoan@lyscellars.com not found in Prisma (may already be updated)')
    }

    // Update in auth.users
    const client = new pg.Client({
        connectionString: connectionString.replace('?sslmode=require', ''),
        ssl: { rejectUnauthorized: false }
    })
    await client.connect()
    try {
        const res = await client.query(`UPDATE auth.users SET email = 'accounting@lyscellars.com' WHERE email = 'ketoan@lyscellars.com'`)
        console.log(`✓ Updated Supabase auth.users email: ${res.rowCount} row(s) updated`)
    } catch (e: any) {
        console.error('⚠️ Could not update auth.users table directly:', e.message)
    } finally {
        await client.end()
    }

    // 2. Update Jeremy's display name to Jeremy (CBO)
    const jeremyUser = await prisma.user.findFirst({
        where: { email: 'jeremie.courivault@lyscellars.com' }
    })

    if (jeremyUser) {
        await prisma.user.update({
            where: { id: jeremyUser.id },
            data: { name: 'Jeremy (CBO)' }
        })
        console.log('✓ Updated Jeremy display name -> Jeremy (CBO)')
    }

    // 3. Update or create Role CBO
    const salesMgrRole = await prisma.role.findFirst({
        where: { name: 'Sales Manager' }
    })

    if (salesMgrRole) {
        await prisma.role.update({
            where: { id: salesMgrRole.id },
            data: { name: 'CBO' }
        })
        console.log('✓ Renamed role "Sales Manager" -> "CBO"')
    } else {
        const cboRoleExists = await prisma.role.findFirst({ where: { name: 'CBO' } })
        if (!cboRoleExists) {
            await prisma.role.create({
                data: {
                    id: 'role-cbo',
                    name: 'CBO'
                }
            })
            console.log('✓ Created role "CBO"')
        }
    }

    // Print final users
    console.log('\n--- Updated DB Users ---')
    const finalUsers = await prisma.user.findMany({
        include: { roles: { include: { role: true } } },
        orderBy: { name: 'asc' }
    })
    finalUsers.forEach(u => {
        console.log(`- Email: ${u.email}, Name: ${u.name}, Roles: ${u.roles.map(r => r.role.name).join(', ')}`)
    })
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
