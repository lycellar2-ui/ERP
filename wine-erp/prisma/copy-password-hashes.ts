import { Client } from 'pg'
import * as dotenv from 'dotenv'
import * as crypto from 'crypto'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

const SOURCE_EMAIL = 'huynd.lyscellars@gmail.com'

const TARGET_USERS = [
    {
        email: 'thoank.lyscellars@gmail.com',
        name: 'Thoa Kim',
        roleId: 'role-sales-admin',
        id: '0c77a036-454c-496e-b800-b0135a852127'
    },
    {
        email: 'sales@lyscellars.com',
        name: 'Sales Rep',
        roleId: 'role-sales-rep',
        id: '6565b0cc-6bd2-4db3-9bbd-33e85315cb49'
    }
]

async function main() {
    const client = new Client({
        connectionString: connectionString.replace('?sslmode=require', ''),
        ssl: { rejectUnauthorized: false }
    })
    await client.connect()

    console.log(`Fetching working password hash from ${SOURCE_EMAIL}...`)
    const hashRes = await client.query('SELECT encrypted_password FROM auth.users WHERE email = $1', [SOURCE_EMAIL])
    if (hashRes.rows.length === 0) {
        console.error(`Error: Source user ${SOURCE_EMAIL} not found.`)
        await client.end()
        return
    }

    const workingHash = hashRes.rows[0].encrypted_password
    console.log(`Found working hash: ${workingHash.substring(0, 15)}...`)

    for (const u of TARGET_USERS) {
        console.log(`\n-----------------------------------------------\nConfiguring: ${u.email}...`)

        // 1. Delete any existing database rows to ensure a clean state
        const userRow = await client.query('SELECT id FROM public.users WHERE email = $1', [u.email])
        if (userRow.rows.length > 0) {
            await client.query('DELETE FROM public.user_roles WHERE "userId" = $1', [userRow.rows[0].id])
        }
        await client.query('DELETE FROM public.users WHERE email = $1', [u.email])
        await client.query('DELETE FROM auth.identities WHERE email = $1', [u.email])
        await client.query('DELETE FROM auth.users WHERE email = $1', [u.email])
        console.log('  - Cleaned up old database entries.')

        // 2. Insert into auth.users using the working hash (omitting generated columns)
        console.log('  - Creating user in auth.users with working hash...')
        await client.query(`
            INSERT INTO auth.users (
                id, instance_id, aud, role, email, encrypted_password,
                email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
                is_anonymous, created_at, updated_at
            ) VALUES (
                $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, $3,
                NOW(), '{"provider": "email", "providers": ["email"]}'::jsonb, '{"email_verified": true}'::jsonb,
                false, NOW(), NOW()
            )
        `, [u.id, u.email, workingHash])

        // 3. Create identity in auth.identities (omitting generated email column)
        console.log('  - Creating identity in auth.identities...')
        const identityId = crypto.randomUUID()
        const identityData = {
            sub: u.id,
            email: u.email,
            email_verified: true,
            phone_verified: false
        }
        await client.query(`
            INSERT INTO auth.identities (
                id, user_id, provider_id, provider, identity_data,
                last_sign_in_at, created_at, updated_at
            ) VALUES (
                $1, $2::uuid, $3::text, 'email', $4::jsonb,
                NOW(), NOW(), NOW()
            )
        `, [identityId, u.id, u.id, JSON.stringify(identityData)])

        // 4. Create public profile and map role
        console.log('  - Creating public profile and mapping roles...')
        await client.query(`
            INSERT INTO public.users (
                id, email, name, "passwordHash", status, "createdAt", "updatedAt"
            ) VALUES (
                $1, $2, $3, 'supabase-managed', 'ACTIVE', NOW(), NOW()
            )
        `, [u.id, u.email, u.name])

        await client.query(`
            INSERT INTO public.user_roles (
                "userId", "roleId"
            ) VALUES (
                $1, $2
            )
        `, [u.id, u.roleId])
        console.log('     - User created and configured successfully.')
    }

    // 5. Test login for all users
    console.log('\n===============================================')
    console.log('Testing login for all reconstructed users:')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

    const ALL_USERS = [
        { email: SOURCE_EMAIL },
        ...TARGET_USERS
    ]

    for (const u of ALL_USERS) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: u.email,
            password: '123456'
        })

        if (error) {
            console.error(`- FAILED for ${u.email}: ${error.message} (status: ${error.status})`)
        } else {
            console.log(`- SUCCESS! ${u.email} authenticated. ID: ${data.user?.id}`)
        }
    }

    await client.end()
}

main().catch(console.error)
