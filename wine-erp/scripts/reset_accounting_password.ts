import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import crypto from 'crypto'

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
    const newPassword = '123456' // Hoặc mật khẩu mong muốn

    console.log(`🔍 Checking user ${email}...`);

    const user = await prisma.user.findUnique({
        where: { email }
    });

    if (!user) {
        console.error(`❌ User ${email} not found in DB!`);
        return;
    }

    console.log(`Found user ID: ${user.id}`);

    // Check if auth.users entry exists in Supabase DB
    const authUsers: any[] = await prisma.$queryRawUnsafe(`
        SELECT id, email FROM auth.users WHERE email = $1 OR id = $2::uuid
    `, email, user.id);

    console.log("Supabase auth.users entry:", authUsers);

    if (authUsers.length === 0) {
        console.log("⚠️ Creating auth.users record for accounting@lyscellars.com...");
        await prisma.$executeRawUnsafe(`
            INSERT INTO auth.users (id, instance_id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud)
            VALUES ($1::uuid, '00000000-0000-0000-0000-000000000000', $2, crypt($3, gen_salt('bf')), NOW(), '{"provider":"email","providers":["email"]}', '{"name":"Dinh (Kế toán)"}', NOW(), NOW(), 'authenticated', 'authenticated')
        `, user.id, email, newPassword);
        console.log("✅ Created auth.users record successfully!");
    } else {
        console.log("🔄 Resetting password in auth.users...");
        await prisma.$executeRawUnsafe(`
            UPDATE auth.users
            SET encrypted_password = crypt($1, gen_salt('bf')), updated_at = NOW(), email_confirmed_at = NOW()
            WHERE id = $2::uuid
        `, newPassword, user.id);
        console.log("✅ Updated password in auth.users successfully!");
    }

    // Also update public.User passwordHash
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.scryptSync(newPassword, salt, 64).toString('hex')
    const securePasswordHash = `${salt}:${hash}`

    await prisma.user.update({
        where: { id: user.id },
        data: {
            status: 'ACTIVE',
            passwordHash: securePasswordHash
        }
    });

    console.log(`🎉 SUCCESS! Account ${email} has been reset and activated with password: ${newPassword}`);
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end();
    });
