import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
import * as crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL!).replace('?sslmode=require', '')

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 2,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const email = 'camly1483@gmail.com'
const name = 'Cẩm Ly'
const roleId = 'role-ceo'
const roleName = 'CEO'
const password = '123456'
const exactHash = '$2a$10$Q4/HKVzEm4OGqBFNuerNGeG4VNmjzaYQzdZkeOkIANRWjY6j1Bmim'

async function main() {
    console.log(`🚀 Bắt đầu tạo tài khoản Admin cho ${email}...`)

    // 1. Kiểm tra hoặc tạo trong auth.users
    const authCheck = await pool.query('SELECT id FROM auth.users WHERE LOWER(email) = LOWER($1)', [email])
    let authUserId: string

    if (authCheck.rows.length > 0) {
        authUserId = authCheck.rows[0].id
        console.log(`  - Đã có trong auth.users với ID: ${authUserId}. Cập nhật hash & tokens...`)
        await pool.query(`
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
            WHERE id = $2
        `, [exactHash, authUserId])
    } else {
        authUserId = crypto.randomUUID()
        console.log(`  - Tạo mới trong auth.users với ID: ${authUserId}...`)
        await pool.query(`
            INSERT INTO auth.users (
                id, instance_id, aud, role, email, encrypted_password,
                email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                is_anonymous, created_at, updated_at,
                confirmation_token, recovery_token, email_change_token_new,
                email_change, reauthentication_token, phone_change,
                phone_change_token, email_change_token_current
            ) VALUES (
                $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2,
                $3, NOW(),
                '{"provider": "email", "providers": ["email"]}'::jsonb,
                '{"email_verified": true}'::jsonb,
                false, NOW(), NOW(),
                '', '', '', '', '', '', '', ''
            )
        `, [authUserId, email, exactHash])
    }

    // 2. Kiểm tra hoặc tạo auth.identities
    const identityCheck = await pool.query('SELECT id FROM auth.identities WHERE user_id = $1', [authUserId])
    if (identityCheck.rows.length === 0) {
        const identityId = crypto.randomUUID()
        const identityData = JSON.stringify({
            sub: authUserId,
            email: email,
            email_verified: true,
            phone_verified: false
        })
        await pool.query(`
            INSERT INTO auth.identities (
                id, user_id, provider_id, provider, identity_data,
                last_sign_in_at, created_at, updated_at
            ) VALUES (
                $1, $2, $3, 'email', $4::jsonb,
                NOW(), NOW(), NOW()
            )
        `, [identityId, authUserId, authUserId, identityData])
        console.log(`  ✓ Đã tạo bản ghi auth.identities`)
    } else {
        console.log(`  ✓ auth.identities đã tồn tại`)
    }

    // 3. Tạo hoặc cập nhật public.users
    const existingPublic = await prisma.user.findFirst({
        where: { email: { equals: email, mode: 'insensitive' } }
    })

    let finalUserId = authUserId
    if (existingPublic) {
        finalUserId = existingPublic.id
        console.log(`  - Cập nhật user public (ID: ${existingPublic.id})...`)
        await prisma.user.update({
            where: { id: existingPublic.id },
            data: {
                name,
                status: 'ACTIVE'
            }
        })
    } else {
        console.log(`  - Tạo mới user trong public.users...`)
        const created = await prisma.user.create({
            data: {
                id: authUserId,
                email,
                name,
                passwordHash: 'supabase-managed',
                status: 'ACTIVE'
            }
        })
        finalUserId = created.id
        console.log(`  ✓ Đã tạo public.users (ID: ${created.id})`)
    }

    // 4. Gán vai trò CEO (Admin cao nhất)
    const existingRoleLink = await prisma.userRole.findUnique({
        where: {
            userId_roleId: {
                userId: finalUserId,
                roleId: roleId
            }
        }
    })

    if (!existingRoleLink) {
        await prisma.userRole.create({
            data: {
                userId: finalUserId,
                roleId: roleId
            }
        })
        console.log(`  ✓ Đã gán vai trò: ${roleName} (${roleId})`)
    } else {
        console.log(`  ✓ Đã có vai trò: ${roleName} (${roleId})`)
    }

    // 5. Kiểm tra đăng nhập qua Supabase Client
    console.log(`\n🧪 Kiểm tra signInWithPassword với ${email} / ${password}...`)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
    })

    if (signInError) {
        console.error(`  ❌ Đăng nhập thất bại:`, signInError.message)
    } else {
        console.log(`  🎉 ĐĂNG NHẬP THÀNH CÔNG! Auth User ID: ${signInData.user.id}`)
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
