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
    console.log('--- DB Users ---')
    const users = await prisma.user.findMany({
        include: {
            roles: {
                include: {
                    role: true
                }
            }
        }
    })
    console.log('Total users:', users.length)
    users.forEach(u => {
        console.log(`- Email: ${u.email}, Name: ${u.name}, Status: ${u.status}`)
        console.log(`  Roles: ${u.roles.map(r => r.role.name).join(', ')}`)
    })
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
