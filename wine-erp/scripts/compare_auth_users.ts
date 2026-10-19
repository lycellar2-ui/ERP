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
    console.log("🔍 Comparing auth.users & auth.identities between admin & accounting...");

    const users: any[] = await prisma.$queryRawUnsafe(`
        SELECT u.*, i.id as identity_id, i.provider, i.identity_data
        FROM auth.users u
        LEFT JOIN auth.identities i ON u.id = i.user_id
        WHERE u.email IN ('admin@lyscellars.com', 'accounting@lyscellars.com', 'sales1@lyscellars.com')
    `);

    console.log("User comparison:", JSON.stringify(users, null, 2));
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
