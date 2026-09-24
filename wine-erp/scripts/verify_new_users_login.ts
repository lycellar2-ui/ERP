import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'
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

const exactHash = '$2a$10$Q4/HKVzEm4OGqBFNuerNGeG4VNmjzaYQzdZkeOkIANRWjY6j1Bmim' // bcrypt hash for '123456'

const emails = [
    'trieuthithamqucb@gmail.com',
    'khanhtran299999@gmail.com',
    'maikhanh2234@gmail.com'
]

async function main() {
    console.log('🛠️ Cập nhật tokens rỗng và password hash chuẩn cho 3 tài khoản...')

    for (const email of emails) {
        await prisma.$executeRawUnsafe(`
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
            WHERE LOWER(email) = LOWER($2)
        `, exactHash, email)
        console.log(`  ✓ Đã cập nhật auth.users cho: ${email}`)
    }

    // Kiểm tra đăng nhập
    console.log('\n🧪 Bắt đầu kiểm tra signInWithPassword với mật khẩu 123456...')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    for (const email of emails) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password: '123456'
        })

        if (error) {
            console.error(`  ❌ Thất bại [${email}]:`, error.message)
        } else {
            console.log(`  🎉 THÀNH CÔNG [${email}]! User ID: ${data.user.id}`)
        }
    }
}

main()
    .catch(console.error)
    .finally(async () => {
        await prisma.$disconnect()
        await pool.end()
    })
