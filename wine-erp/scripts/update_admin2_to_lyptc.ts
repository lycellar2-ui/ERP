import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL!).replace('?sslmode=require', '')

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const OLD_EMAIL = 'admin2@lyscellars.com'
const NEW_EMAIL = 'lyptc@lyscellars.com'
const NEW_PASSWORD = '123456'

async function main() {
    console.log(`🚀 Changing account from ${OLD_EMAIL} to ${NEW_EMAIL}...`)

    // 1. Check auth.users
    const oldAuthRes = await pool.query('SELECT id, email FROM auth.users WHERE email = $1', [OLD_EMAIL])
    const newAuthRes = await pool.query('SELECT id, email FROM auth.users WHERE email = $1', [NEW_EMAIL])

    if (oldAuthRes.rows.length > 0) {
        const userId = oldAuthRes.rows[0].id
        console.log(`Found old account in auth.users (ID: ${userId}). Updating email and password...`)
        await pool.query(
            `UPDATE auth.users 
             SET email = $1, 
                 encrypted_password = crypt($2, gen_salt('bf', 10)),
                 updated_at = NOW()
             WHERE id = $3`,
            [NEW_EMAIL, NEW_PASSWORD, userId]
        )
        console.log(`✓ Updated auth.users ID ${userId} to ${NEW_EMAIL} with new password.`)
    } else if (newAuthRes.rows.length > 0) {
        const userId = newAuthRes.rows[0].id
        console.log(`Account ${NEW_EMAIL} already exists in auth.users (ID: ${userId}). Updating password...`)
        await pool.query(
            `UPDATE auth.users 
             SET encrypted_password = crypt($1, gen_salt('bf', 10)),
                 updated_at = NOW()
             WHERE id = $2`,
            [NEW_PASSWORD, userId]
        )
        console.log(`✓ Updated auth.users password for ${NEW_EMAIL}.`)
    } else {
        console.log(`Neither ${OLD_EMAIL} nor ${NEW_EMAIL} found in auth.users. Creating new auth user...`)
        const authUserId = 'user-admin2'
        await pool.query(
            `INSERT INTO auth.users (
                id, instance_id, aud, role, email, encrypted_password,
                email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                is_anonymous, created_at, updated_at
            ) VALUES (
                $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2,
                crypt($3, gen_salt('bf', 10)), NOW(),
                '{"provider": "email", "providers": ["email"]}'::jsonb,
                '{"email_verified": true}'::jsonb,
                false, NOW(), NOW()
            )`,
            [authUserId, NEW_EMAIL, NEW_PASSWORD]
        )
        console.log(`✓ Created user ${NEW_EMAIL} in auth.users.`)
    }

    // 2. Check public.User
    const oldPublicUser = await prisma.user.findUnique({ where: { email: OLD_EMAIL } })
    const newPublicUser = await prisma.user.findUnique({ where: { email: NEW_EMAIL } })

    if (oldPublicUser) {
        console.log(`Updating public.User ${OLD_EMAIL} to ${NEW_EMAIL}...`)
        await prisma.user.update({
            where: { email: OLD_EMAIL },
            data: { email: NEW_EMAIL }
        })
        console.log(`✓ Updated public.User email to ${NEW_EMAIL}`)
    } else if (!newPublicUser) {
        console.log(`Creating public.User ${NEW_EMAIL}...`)
        const createdUser = await prisma.user.create({
            data: {
                id: 'user-admin2',
                email: NEW_EMAIL,
                name: 'CEO Secondary',
                passwordHash: 'supabase-managed',
                status: 'ACTIVE',
                roles: {
                    create: {
                        roleId: 'role-ceo'
                    }
                }
            }
        })
        console.log(`✓ Created public.User ${createdUser.email} with role-ceo`)
    } else {
        console.log(`public.User ${NEW_EMAIL} already exists.`)
    }

    console.log('\n🎉 Account update completed successfully!')
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
