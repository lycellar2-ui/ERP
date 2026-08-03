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
    const authUsers: any[] = await prisma.$queryRawUnsafe(`
        SELECT email, encrypted_password FROM auth.users WHERE email IN ('sales1@lyscellars.com', 'accounting@lyscellars.com', 'admin@lyscellars.com')
    `);

    for (const u of authUsers) {
        console.log(`User: ${u.email}`);
        console.log(`Encrypted Hash: ${u.encrypted_password}`);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
