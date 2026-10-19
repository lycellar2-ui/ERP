import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const pool = new pg.Pool({
    connectionString: (process.env.DIRECT_URL || process.env.DATABASE_URL!).replace('?sslmode=require', ''),
    ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function check() {
    const roles = await prisma.role.findMany()
    const users = await prisma.user.findMany({
        include: {
            roles: {
                include: { role: true }
            }
        }
    })
    console.log('--- ROLES IN DATABASE ---')
    roles.forEach(r => console.log(`ID: ${r.id} | Name: ${r.name}`))
    
    console.log('\n--- USERS IN DATABASE ---')
    users.forEach(u => {
        console.log(`Email: ${u.email} | Name: ${u.name} | Roles: ${u.roles.map(ur => ur.role.name).join(', ')}`)
    })
    
    await pool.end()
    await prisma.$disconnect()
}

check().catch(console.error)
