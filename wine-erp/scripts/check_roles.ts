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
    const roles = await prisma.role.findMany({
        select: { id: true, name: true }
    });

    console.log("All Roles in DB:", roles);

    const usersWithRoles = await prisma.user.findMany({
        select: {
            email: true,
            name: true,
            roles: {
                select: { role: { select: { name: true } } }
            }
        }
    });

    console.log("Users and their Roles:", JSON.stringify(usersWithRoles, null, 2));
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
