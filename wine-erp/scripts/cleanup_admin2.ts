import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL!).replace('?sslmode=require', '')

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log('Checking for old admin2@lyscellars.com record...')

    // Check if admin2@lyscellars.com is present in auth.users
    const authRes = await pool.query("SELECT id FROM auth.users WHERE email = 'admin2@lyscellars.com'")
    if (authRes.rows.length > 0) {
        const id = authRes.rows[0].id
        console.log(`Removing admin2@lyscellars.com (ID: ${id}) from auth.users...`)
        await pool.query("DELETE FROM auth.users WHERE email = 'admin2@lyscellars.com'")
    }

    // Check if admin2@lyscellars.com is present in public.User
    const publicUser = await prisma.user.findUnique({ where: { email: 'admin2@lyscellars.com' } })
    if (publicUser) {
        console.log('Removing admin2@lyscellars.com from public.User...')
        await prisma.userRole.deleteMany({ where: { userId: publicUser.id } })
        await prisma.user.delete({ where: { id: publicUser.id } })
    }

    // Ensure lyptc@lyscellars.com has role-ceo in public.User
    const lyptcUser = await prisma.user.findUnique({ where: { email: 'lyptc@lyscellars.com' } })
    if (lyptcUser) {
        const role = await prisma.userRole.findUnique({
            where: { userId_roleId: { userId: lyptcUser.id, roleId: 'role-ceo' } }
        })
        if (!role) {
            await prisma.userRole.create({
                data: { userId: lyptcUser.id, roleId: 'role-ceo' }
            })
            console.log('Assigned role-ceo to lyptc@lyscellars.com')
        }
    }

    console.log('Cleanup and role check complete!')
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
