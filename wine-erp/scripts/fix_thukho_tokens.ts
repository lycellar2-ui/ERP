import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

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
    const email = 'thukho@lyscellars.com'
    const password = '123456'
    const exactHash = '$2a$10$Q4/HKVzEm4OGqBFNuerNGeG4VNmjzaYQzdZkeOkIANRWjY6j1Bmim'

    console.log(`🛠️ Fixing auth.users tokens for ${email}...`);

    await prisma.$executeRawUnsafe(`
        UPDATE auth.users
        SET encrypted_password = $1,
            confirmation_token = '',
            recovery_token = '',
            email_change_token_new = '',
            email_change = '',
            reauthentication_token = '',
            phone_change = '',
            phone_change_token = '',
            email_change_token_current = '',
            updated_at = NOW(),
            email_confirmed_at = NOW()
        WHERE email = $2
    `, exactHash, email);

    console.log("✅ Updated auth.users tokens to empty string!");

    // Test sign in via Supabase client
    console.log("\n🧪 Testing signInWithPassword via Supabase Client...");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) {
        console.error("❌ Sign in test failed:", error.message, error);
    } else {
        console.log("🎉🎉🎉 BINGO! thukho@lyscellars.com AUTHENTICATED SUCCESSFULLY! User ID:", data.user.id);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
