import * as dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseAnonKey)

const passwordsToTest = [
    '123456',
    '12345678',
    'admin123',
    'Admin123',
    'Admin@123',
    'Salecellar123654=',
    'Salecellar123654',
    'lyscellars123',
    'ketoan123',
    'accounting123'
]

async function main() {
    console.log("🔍 Testing passwords for admin@lyscellars.com...");
    for (const pass of passwordsToTest) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: 'admin@lyscellars.com',
            password: pass
        });
        if (!error) {
            console.log(`🎉 MATCH FOUND FOR admin@lyscellars.com! Password: "${pass}"`);
            return;
        } else {
            console.log(`- "${pass}": ${error.message}`);
        }
    }

    console.log("\n🔍 Testing passwords for sales1@lyscellars.com...");
    for (const pass of passwordsToTest) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: 'sales1@lyscellars.com',
            password: pass
        });
        if (!error) {
            console.log(`🎉 MATCH FOUND FOR sales1@lyscellars.com! Password: "${pass}"`);
            return;
        }
    }
}

main().catch(console.error);
