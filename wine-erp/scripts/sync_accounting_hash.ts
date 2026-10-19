import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

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
    const adminHash = '$2a$10$Q4/HKVzEm4OGqBFNuerNGeG4VNmjzaYQzdZkeOkIANRWjY6j1Bmim' // bcrypt hash for 123456

    console.log(`Setting admin hash for ${email}...`);

    await prisma.$executeRawUnsafe(`
        UPDATE auth.users
        SET encrypted_password = $1,
            confirmation_token = '',
            recovery_token = '',
            email_change_token_new = '',
            email_change = '',
            email_change_token_current = '',
            reauthentication_token = '',
            updated_at = NOW()
        WHERE email = $2
    `, adminHash, email);

    console.log("✅ Updated auth.users with admin hash!");

    console.log("\n🧪 Testing signInWithPassword via Supabase Client for accounting@lyscellars.com...");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: '123456'
    });

    if (error) {
        console.error("❌ Sign in failed:", error.message);
    } else {
        console.log("🎉🎉🎉 BINGO! accounting@lyscellars.com SUCCESSFULLY AUTHENTICATED! User ID:", data.user.id);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
