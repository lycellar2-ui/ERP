import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const connectionString = (process.env.DIRECT_URL || process.env.DATABASE_URL!).replace('?sslmode=require', '')

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
})

const anonClient = createClient(supabaseUrl, anonKey)

const pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 2,
    allowExitOnIdle: true,
})
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

const USERS_TO_CREATE = [
    {
        email: 'trieuthithamqucb@gmail.com',
        name: 'Triệu Thị Thắm',
        roleId: 'role-sales-rep',
        roleName: 'Sales Rep'
    },
    {
        email: 'khanhtran299999@gmail.com',
        name: 'Khánh Trần',
        roleId: 'role-sales-rep',
        roleName: 'Sales Rep'
    },
    {
        email: 'maikhanh2234@gmail.com',
        name: 'Mai Khánh',
        roleId: 'role-sales-admin',
        roleName: 'Sales Admin'
    }
]

const PASSWORD = '123456'

async function main() {
    console.log('🚀 Bắt đầu tạo/cập nhật tài khoản Sales & Sales Admin qua Supabase Admin API...')

    // 1. Lấy danh sách users hiện tại từ Supabase Auth
    const { data: { users: authUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000
    })

    if (listError) {
        console.error('❌ Lỗi liệt kê user từ Supabase Auth Admin:', listError)
        return
    }

    for (const u of USERS_TO_CREATE) {
        const email = u.email.toLowerCase().trim()
        console.log(`\n==================================================`)
        console.log(`👤 Đang xử lý: ${email} (${u.name} - ${u.roleName})`)

        let authUserId: string
        const foundAuth = authUsers.find(au => au.email?.toLowerCase() === email)

        if (foundAuth) {
            authUserId = foundAuth.id
            console.log(`  - Đã có trên Supabase Auth (ID: ${authUserId}). Đang cập nhật mật khẩu...`)
            const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUserId, {
                password: PASSWORD,
                email_confirm: true,
                user_metadata: { name: u.name }
            })
            if (updateError) {
                console.error(`  ❌ Lỗi cập nhật mật khẩu:`, updateError.message)
            } else {
                console.log(`  ✓ Cập nhật mật khẩu thành công`)
            }
        } else {
            console.log(`  - Chưa có trên Supabase Auth. Đang tạo mới qua Admin API...`)
            // Xóa bản ghi rác nếu trước đó chèn raw SQL lỗi
            try {
                await pool.query('DELETE FROM auth.identities WHERE email = $1', [email])
                await pool.query('DELETE FROM auth.users WHERE email = $1', [email])
            } catch (e) {}

            const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password: PASSWORD,
                email_confirm: true,
                user_metadata: { name: u.name }
            })

            if (createError) {
                console.error(`  ❌ Lỗi tạo user trên Supabase Admin:`, createError.message)
                continue
            }
            authUserId = createData.user.id
            console.log(`  ✓ Tạo mới trên Supabase Auth thành công (ID: ${authUserId})`)
        }

        // 2. Tạo hoặc cập nhật trong public.users
        const existingPublic = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        })

        let finalPublicUserId = authUserId

        if (existingPublic) {
            finalPublicUserId = existingPublic.id
            console.log(`  - User đã tồn tại trong public.users (ID: ${existingPublic.id})`)
            await prisma.user.update({
                where: { id: existingPublic.id },
                data: {
                    name: u.name,
                    status: 'ACTIVE'
                }
            })
        } else {
            const createdUser = await prisma.user.create({
                data: {
                    id: authUserId,
                    email,
                    name: u.name,
                    passwordHash: 'supabase-managed',
                    status: 'ACTIVE'
                }
            })
            finalPublicUserId = createdUser.id
            console.log(`  ✓ Tạo mới trong public.users thành công (ID: ${createdUser.id})`)
        }

        // 3. Đảm bảo role được gán đúng
        const role = await prisma.role.findUnique({
            where: { id: u.roleId }
        })
        if (!role) {
            console.error(`  ❌ Không tìm thấy role ${u.roleId} trong DB!`)
            continue
        }

        const existingRoleLink = await prisma.userRole.findUnique({
            where: {
                userId_roleId: {
                    userId: finalPublicUserId,
                    roleId: u.roleId
                }
            }
        })

        if (!existingRoleLink) {
            await prisma.userRole.create({
                data: {
                    userId: finalPublicUserId,
                    roleId: u.roleId
                }
            })
            console.log(`  ✓ Đã gán vai trò: ${u.roleName} (${u.roleId})`)
        } else {
            console.log(`  ✓ Đã có vai trò: ${u.roleName} (${u.roleId})`)
        }

        // 4. Test đăng nhập thực tế bằng Anon Client
        console.log(`  🧪 Kiểm tra đăng nhập với ${email} / ${PASSWORD}...`)
        const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
            email,
            password: PASSWORD
        })

        if (signInError) {
            console.error(`  ❌ Đăng nhập thất bại:`, signInError.message)
        } else {
            console.log(`  🎉 ĐĂNG NHẬP THÀNH CÔNG! Auth User ID: ${signInData.user.id}`)
        }
    }

    console.log('\n==================================================')
    console.log('🎉 TẤT CẢ TÀI KHOẢN ĐÃ ĐƯỢC THIẾT LẬP HOÀN TẤT!')
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
