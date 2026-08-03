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
    const email = 'accounting@lyscellars.com'
    const workingHash = '$2a$10$7BCklu26yGx29RISLC96NOHPXtPTh9tozLaprP0zt1QUck8SEDWAa'

    console.log("🔄 Copying standard working password hash to accounting@lyscellars.com...");

    await prisma.$executeRawUnsafe(`
        UPDATE auth.users
        SET encrypted_password = $1,
            updated_at = NOW(),
            email_confirmed_at = NOW()
        WHERE email = $2
    `, workingHash, email);

    console.log("✅ Updated auth.users with exact working hash from default accounts!");
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
