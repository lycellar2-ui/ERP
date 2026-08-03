import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

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
    // Working bcrypt hash for '123456' in Supabase Auth
    const workingHash = '$2a$10$7BCklu26yGx29RISLC96NOHPXtPTh9tozLaprP0zt1QUck8SEDWAa'

    console.log(`🔍 Checking user ${email} in auth.users & auth.identities...`);

    const users: any[] = await prisma.$queryRawUnsafe(`
        SELECT u.id, u.email, u.encrypted_password, i.id as identity_id
        FROM auth.users u
        LEFT JOIN auth.identities i ON u.id = i.user_id
        WHERE u.email = $1
    `, email);

    console.log("User & Identity Status:", users);

    if (users.length === 0) {
        console.error(`❌ User ${email} not found in auth.users!`);
        return;
    }

    const userId = users[0].id;

    // Check if missing identity
    if (!users[0].identity_id) {
        console.log("⚠️ Identity missing for thukho@lyscellars.com! Creating auth.identities entry...");
        const identityId = crypto.randomUUID();
        const identityData = JSON.stringify({
            sub: userId,
            email: email,
            email_verified: true,
            phone_verified: false
        });

        await prisma.$executeRawUnsafe(`
            INSERT INTO auth.identities (
                id, user_id, provider_id, provider, identity_data,
                last_sign_in_at, created_at, updated_at
            ) VALUES (
                $1, $2, $3, 'email', $4::jsonb,
                NOW(), NOW(), NOW()
            )
        `, identityId, userId, userId, identityData);
        console.log("✅ Successfully created auth.identities entry!");
    } else {
        console.log("✅ Identity record exists.");
    }

    // Set working password hash
    await prisma.$executeRawUnsafe(`
        UPDATE auth.users
        SET encrypted_password = $1,
            updated_at = NOW(),
            email_confirmed_at = NOW()
        WHERE email = $2
    `, workingHash, email);
    console.log("✅ Updated password hash in auth.users.");

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
        console.log("🎉🎉🎉 SUCCESS! thukho@lyscellars.com AUTHENTICATED SUCCESSFULLY! User ID:", data.user.id);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
