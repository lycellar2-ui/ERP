import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'
import * as dotenv from 'dotenv'

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

async function main() {
    console.log('🚀 Bắt đầu thiết lập vai trò "Trợ Lý" và gán cho camly1483@gmail.com...')

    // 1. Tạo hoặc cập nhật role "Trợ Lý"
    const roleId = 'role-tro-ly'
    const roleName = 'Trợ Lý'

    const troLyRole = await prisma.role.upsert({
        where: { id: roleId },
        update: { name: roleName },
        create: {
            id: roleId,
            name: roleName
        }
    })
    console.log(`✓ Đã tạo/cập nhật Role: ${troLyRole.name} (ID: ${troLyRole.id})`)

    // 2. Gán toàn bộ quyền hạn hệ thống cho vai trò Trợ Lý để hỗ trợ Ban Giám Đốc giám sát
    const allPerms = await prisma.permission.findMany()
    console.log(`  - Tìm thấy ${allPerms.length} quyền trong hệ thống. Đang gán cho vai trò ${roleName}...`)

    for (const perm of allPerms) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: troLyRole.id,
                    permissionId: perm.id
                }
            },
            update: {},
            create: {
                roleId: troLyRole.id,
                permissionId: perm.id
            }
        })
    }
    console.log(`✓ Đã cấp ${allPerms.length} quyền cho vai trò ${roleName}`)

    // 3. Tìm user camly1483@gmail.com
    const user = await prisma.user.findFirst({
        where: { email: { equals: 'camly1483@gmail.com', mode: 'insensitive' } }
    })

    if (!user) {
        console.error('❌ Không tìm thấy user camly1483@gmail.com trong public.users!')
        return
    }

    // 4. Xóa liên kết role-ceo cũ và gán role-tro-ly mới
    await prisma.userRole.deleteMany({
        where: { userId: user.id }
    })

    await prisma.userRole.create({
        data: {
            userId: user.id,
            roleId: troLyRole.id
        }
    })
    console.log(`✓ Đã cập nhật vai trò của ${user.email} sang: ${roleName}`)

    // 5. Cập nhật name cho đẹp: "Cẩm Ly"
    await prisma.user.update({
        where: { id: user.id },
        data: { name: 'Cẩm Ly' }
    })

    // 6. Kiểm tra lại user sau khi cập nhật
    const updatedUser = await prisma.user.findUnique({
        where: { id: user.id },
        include: {
            roles: {
                include: { role: true }
            }
        }
    })

    console.log('\n--- KẾT QUẢ XÁC NHẬN ---')
    console.log(`User: ${updatedUser?.name} (${updatedUser?.email})`)
    console.log(`Vai trò hiện tại: ${updatedUser?.roles.map(r => r.role.name).join(', ')}`)
    console.log('Không còn hiển thị CEO! 🎉')
}

main()
    .catch(console.error)
    .finally(async () => {
        await pool.end()
        await prisma.$disconnect()
    })
