import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

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
    const newPassword = '123456'

    console.log(`🔍 Checking user in Supabase Auth via Admin API: ${email}...`);

    // List users in Supabase Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (listError) {
        console.error("❌ List users error:", listError);
        return;
    }

    const authUser = users.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (authUser) {
        console.log(`Found Auth User ID: ${authUser.id}. Updating password via Supabase Admin API...`);
        const { data, error } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
            password: newPassword,
            email_confirm: true
        });

        if (error) {
            console.error("❌ Supabase Admin update password error:", error);
        } else {
            console.log("✅ Supabase Auth password updated successfully!", data.user.id);
        }
    } else {
        console.log("User not found in Supabase Auth. Creating new Auth User...");
        const { data, error } = await supabaseAdmin.auth.admin.createUser({
            email: email,
            password: newPassword,
            email_confirm: true,
            user_metadata: { name: "Dinh (Kế toán)" }
        });

        if (error) {
            console.error("❌ Supabase Admin create user error:", error);
        } else {
            console.log("✅ Supabase Auth user created successfully!", data.user.id);

            // Update Prisma User ID to match Auth User ID
            const prismaUser = await prisma.user.findUnique({ where: { email } });
            if (prismaUser && prismaUser.id !== data.user.id) {
                console.log(`Syncing Prisma User ID (${prismaUser.id}) -> Auth ID (${data.user.id})...`);
                await prisma.$executeRawUnsafe(`
                    UPDATE "User" SET id = $1 WHERE email = $2
                `, data.user.id, email);
                await prisma.$executeRawUnsafe(`
                    UPDATE "UserRole" SET "userId" = $1 WHERE "userId" = $2
                `, data.user.id, prismaUser.id);
            }
        }
    }

    // Verify login with anon client
    console.log("🧪 Testing sign-in via Supabase Client...");
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const anonClient = createClient(supabaseUrl, anonKey)
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
        email,
        password: newPassword
    });

    if (signInError) {
        console.error("❌ Sign in test failed:", signInError.message);
    } else {
        console.log("🎉 SUCCESS! Sign-in test PASSED! User ID:", signInData.user.id);
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
