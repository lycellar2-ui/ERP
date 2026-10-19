import { prisma } from '../src/lib/db'
import crypto from 'crypto'

function hashPassword(password: string): string {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.scryptSync(password, salt, 64).toString('hex')
    return `${salt}:${hash}`
}

async function main() {
    console.log('🚀 Starting Operation Manager role and user creation...')

    // 1. Find CEO role or Admin role
    const ceoRole = await prisma.role.findFirst({
        where: {
            OR: [
                { name: { contains: 'CEO', mode: 'insensitive' } },
                { name: { contains: 'Tổng Giám Đốc', mode: 'insensitive' } },
                { name: { contains: 'Admin', mode: 'insensitive' } },
            ]
        },
        include: {
            permissions: true,
        }
    })

    console.log(`Found CEO/Admin role: ${ceoRole?.name ?? 'None'} (ID: ${ceoRole?.id})`)

    // Get all permissions or CEO permissions
    let permissionIdsToAssign: string[] = []
    if (ceoRole && ceoRole.permissions.length > 0) {
        permissionIdsToAssign = ceoRole.permissions.map(p => p.permissionId)
        console.log(`Copying ${permissionIdsToAssign.length} permissions from role ${ceoRole.name}`)
    } else {
        const allPermissions = await prisma.permission.findMany({ select: { id: true } })
        permissionIdsToAssign = allPermissions.map(p => p.id)
        console.log(`Assigning ALL ${permissionIdsToAssign.length} system permissions`)
    }

    // 2. Create or find "Operation Manager" Role
    let opRole = await prisma.role.findFirst({
        where: {
            OR: [
                { name: { contains: 'Operation Manager', mode: 'insensitive' } },
                { name: { contains: 'Giám Đốc Vận Hành', mode: 'insensitive' } },
            ]
        }
    })

    if (!opRole) {
        opRole = await prisma.role.create({
            data: {
                name: 'Operation Manager (Giám Đốc Vận Hành)',
            }
        })
        console.log(`✅ Created Role: ${opRole.name} (ID: ${opRole.id})`)
    } else {
        console.log(`ℹ️ Role already exists: ${opRole.name} (ID: ${opRole.id})`)
    }

    // 3. Assign permissions to Operation Manager role
    for (const permId of permissionIdsToAssign) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: opRole.id,
                    permissionId: permId,
                }
            },
            create: {
                roleId: opRole.id,
                permissionId: permId,
            },
            update: {},
        })
    }
    console.log(`✅ Assigned ${permissionIdsToAssign.length} permissions to ${opRole.name}`)

    // 4. Create or find User operation@lyscellars.com
    const email = 'operation@lyscellars.com'
    let user = await prisma.user.findUnique({ where: { email } })

    if (!user) {
        const defaultPassword = 'LysCellars@2026'
        const passwordHash = hashPassword(defaultPassword)
        user = await prisma.user.create({
            data: {
                email,
                name: 'Operation Manager',
                passwordHash,
                status: 'ACTIVE',
            }
        })
        console.log(`✅ Created User: ${user.email} (Default password: ${defaultPassword})`)
    } else {
        console.log(`ℹ️ User already exists: ${user.email} (ID: ${user.id})`)
    }

    // 5. Assign Operation Manager role to User
    await prisma.userRole.upsert({
        where: {
            userId_roleId: {
                userId: user.id,
                roleId: opRole.id,
            }
        },
        create: {
            userId: user.id,
            roleId: opRole.id,
        },
        update: {},
    })

    // Also link CEO role if available for proposal workflow matching
    if (ceoRole) {
        await prisma.userRole.upsert({
            where: {
                userId_roleId: {
                    userId: user.id,
                    roleId: ceoRole.id,
                }
            },
            create: {
                userId: user.id,
                roleId: ceoRole.id,
            },
            update: {},
        })
    }

    console.log(`🎉 SUCCESS: User ${user.email} has been created and granted Operation Manager & CEO level permissions!`)
}

main()
    .catch((e) => {
        console.error('❌ Error creating Operation Manager:', e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
