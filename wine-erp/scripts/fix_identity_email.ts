import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

async function main() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    console.log("🧪 Testing sales1@lyscellars.com...");
    const res1 = await supabase.auth.signInWithPassword({
        email: 'sales1@lyscellars.com',
        password: '123456'
    });
    console.log("sales1 result:", res1.error ? res1.error.message : "SUCCESS!");

    console.log("🧪 Testing accounting@lyscellars.com...");
    const res2 = await supabase.auth.signInWithPassword({
        email: 'accounting@lyscellars.com',
        password: '123456'
    });
    console.log("accounting result:", res2.error ? res2.error.message : "SUCCESS!");
}

main().catch(console.error);
