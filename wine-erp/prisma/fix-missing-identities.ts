import { Client } from 'pg'
import * as dotenv from 'dotenv'
import * as crypto from 'crypto'

dotenv.config({ path: '.env.local' })

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL!

async function main() {
    const client = new Client({
        connectionString: connectionString.replace('?sslmode=require', ''),
        ssl: { rejectUnauthorized: false }
    })
    await client.connect()

    // 1. Describe auth.identities columns
    console.log('Describing auth.identities columns...')
    const cols = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'identities' AND table_schema = 'auth'
    `)
    cols.rows.forEach(c => {
        console.log(`- Column: ${c.column_name} (${c.data_type}), Nullable: ${c.is_nullable}`)
    })

    // 2. Find users in auth.users missing in auth.identities
    console.log('\nFinding users missing identities...')
    const missing = await client.query(`
        SELECT u.id, u.email
        FROM auth.users u
        LEFT JOIN auth.identities i ON u.id = i.user_id
        WHERE i.id IS NULL
    `)

    console.log(`Found ${missing.rows.length} users missing identities.`)

    // 3. Insert missing identities
    for (const r of missing.rows) {
        console.log(`Inserting identity for: ${r.email} (ID: ${r.id})...`)
        const identityId = crypto.randomUUID()
        const identityData = {
            sub: r.id,
            email: r.email,
            email_verified: true,
            phone_verified: false
        }

        // Supabase schema has provider_id in newer versions of GoTrue.
        // Let's check if provider_id exists in columns.
        const hasProviderId = cols.rows.some(c => c.column_name === 'provider_id')
        
        let queryStr = ''
        let params = []

        if (hasProviderId) {
            // provider_id is usually the user's email or user id in newer Supabase schemas
            queryStr = `
                INSERT INTO auth.identities (
                    id, user_id, provider_id, provider, identity_data,
                    last_sign_in_at, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, 'email', $4::jsonb,
                    NOW(), NOW(), NOW()
                )
            `
            params = [identityId, r.id, r.id, JSON.stringify(identityData)]
        } else {
            queryStr = `
                INSERT INTO auth.identities (
                    id, user_id, provider, identity_data,
                    last_sign_in_at, created_at, updated_at
                ) VALUES (
                    $1, $2, 'email', $3::jsonb,
                    NOW(), NOW(), NOW()
                )
            `
            params = [identityId, r.id, JSON.stringify(identityData)]
        }

        await client.query(queryStr, params)
        console.log(`  - Successfully created identity.`)
    }

    // 4. Test login locally for sales@lyscellars.com
    console.log('\nTesting login with supabase client...')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js')
    const supabase = createSupabaseClient(supabaseUrl, supabaseAnonKey)

    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'sales@lyscellars.com',
        password: '123456'
    })

    if (error) {
        console.error(`- FAILED: ${error.message} (status: ${error.status})`)
    } else {
        console.log(`- SUCCESS! sales@lyscellars.com authenticated. ID: ${data.user?.id}`)
    }

    await client.end()
}

main().catch(console.error)
