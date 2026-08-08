import { prisma } from '../src/lib/db'

async function main() {
    console.log('🔄 Updating Role name to "Operation Manager"...')

    // Find role containing Operation Manager
    const opRole = await prisma.role.findFirst({
        where: {
            OR: [
                { name: { contains: 'Operation Manager', mode: 'insensitive' } },
                { name: { contains: 'Giám Đốc Vận Hành', mode: 'insensitive' } },
            ]
        }
    })

    if (opRole) {
        await prisma.role.update({
            where: { id: opRole.id },
            data: { name: 'Operation Manager' },
        })
        console.log(`✅ Updated Role ID ${opRole.id} name to "Operation Manager"`)
    } else {
        console.log('⚠️ Role not found, creating "Operation Manager"...')
        await prisma.role.create({
            data: { name: 'Operation Manager' }
        })
    }
}

main()
    .catch((e) => {
        console.error('❌ Error updating role name:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
