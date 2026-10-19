import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testLogin(email: string, pass: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: pass
    });
    if (error) {
        console.log(`❌ FAIL [${email}]: ${error.message}`);
    } else {
        console.log(`🎉 SUCCESS [${email}]: User ID ${data.user.id}`);
    }
}

async function main() {
    console.log("🧪 Testing logins with password '123456'...");
    const emails = [
        'admin@lyscellars.com',
        'accounting@lyscellars.com',
        'thukho@lyscellars.com',
        'thumua@lyscellars.com',
        'sales@lyscellars.com',
        'sales1@lyscellars.com'
    ];

    for (const email of emails) {
        await testLogin(email, '123456');
    }
}

main().catch(console.error);
