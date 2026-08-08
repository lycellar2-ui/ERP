import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function main() {
    console.log('Testing login for lyptc@lyscellars.com...')
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'lyptc@lyscellars.com',
        password: '123456',
    })

    if (error) {
        console.error('❌ Login failed:', error.message)
    } else {
        console.log('🎉 SUCCESS! Authenticated user:', data.user?.email, 'User ID:', data.user?.id)
    }
}

main()
