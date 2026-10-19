import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as crypto from 'crypto'

dotenv.config({ path: '.env.local' })

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL!).replace('?sslmode=require', '')

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const USERS_TO_CREATE = [
    {
        email: 'Huynd.lyscellars@gmail.com',
        name: 'Huy Nguyễn',
        roleId: 'role-sales-rep'
    },
    {
        email: 'Thoank.lyscellars@gmail.com',
        name: 'Thoa Kim',
        roleId: 'role-sales-admin'
    },
    {
        email: 'Sales@lyscellars.com',
        name: 'Sales Rep',
        roleId: 'role-sales-rep'
    }
]

const PASSWORD = '123456'

async function main() {
    console.log('🚀 Starting user creation process...')

    for (const u of USERS_TO_CREATE) {
        const email = u.email.toLowerCase()
        console.log(`\nProcessing user: ${email} (${u.name})...`)

        // 1. Check if user already exists in auth.users
        const authCheck = await pool.query('SELECT id FROM auth.users WHERE email = $1', [email])
        let authUserId: string

        if (authCheck.rows.length > 0) {
            authUserId = authCheck.rows[0].id
            console.log(`  - User already exists in auth.users with ID: ${authUserId}`)
        } else {
            authUserId = crypto.randomUUID()
            // Insert into auth.users using pg client directly, omitting confirmed_at (which is generated)
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
                [authUserId, email, PASSWORD]
            )
            console.log(`  - Created user in auth.users with ID: ${authUserId}`)
        }

        // 2. Check if user exists in public.users
        const publicUser = await prisma.user.findUnique({
            where: { email }
        })

        if (publicUser) {
            console.log(`  - User already exists in public.users with ID: ${publicUser.id}`)
            
            // Check role
            const userRole = await prisma.userRole.findUnique({
                where: {
                    userId_roleId: {
                        userId: publicUser.id,
                        roleId: u.roleId
                    }
                }
            })
            if (!userRole) {
                await prisma.userRole.create({
                    data: {
                        userId: publicUser.id,
                        roleId: u.roleId
                    }
                })
                console.log(`  - Assigned role ${u.roleId} to existing user`)
            } else {
                console.log(`  - User already has role ${u.roleId}`)
            }
        } else {
            // Create user and role in a single operation
            await prisma.user.create({
                data: {
                    id: authUserId, // Use same ID for consistency
                    email,
                    name: u.name,
                    passwordHash: 'supabase-managed',
                    status: 'ACTIVE',
                    roles: {
                        create: {
                            roleId: u.roleId
                        }
                    }
                }
            })
            console.log(`  - Created user in public.users and assigned role ${u.roleId}`)
        }
    }

    console.log('\n🎉 Finished user creation successfully!')
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
