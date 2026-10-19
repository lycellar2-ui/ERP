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
    console.log("🛠️ Fixing tokens & password hashes across all auth users...");

    const exactHash = '$2a$10$Q4/HKVzEm4OGqBFNuerNGeG4VNmjzaYQzdZkeOkIANRWjY6j1Bmim'

    await prisma.$executeRawUnsafe(`
        UPDATE auth.users
        SET encrypted_password = $1,
            confirmation_token = COALESCE(NULLIF(confirmation_token, ''), ''),
            recovery_token = COALESCE(NULLIF(recovery_token, ''), ''),
            email_change_token_new = COALESCE(NULLIF(email_change_token_new, ''), ''),
            email_change = COALESCE(NULLIF(email_change, ''), ''),
            reauthentication_token = COALESCE(NULLIF(reauthentication_token, ''), ''),
            phone_change = COALESCE(NULLIF(phone_change, ''), ''),
            phone_change_token = COALESCE(NULLIF(phone_change_token, ''), ''),
            email_change_token_current = COALESCE(NULLIF(email_change_token_current, ''), ''),
            updated_at = NOW(),
            email_confirmed_at = NOW()
    `, exactHash);

    console.log("✅ Fixed all users in auth.users!");
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
