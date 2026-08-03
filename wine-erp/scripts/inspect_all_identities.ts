import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL!).replace('?sslmode=require', '')

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 1,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
    console.log("🔍 Inspecting auth.users and auth.identities...");

    const users: any[] = await prisma.$queryRawUnsafe(`
        SELECT u.id, u.email, i.id as identity_id, i.provider, i.provider_id, i.identity_data
        FROM auth.users u
        LEFT JOIN auth.identities i ON u.id = i.user_id
    `);

    console.dir(users, { depth: null });
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
