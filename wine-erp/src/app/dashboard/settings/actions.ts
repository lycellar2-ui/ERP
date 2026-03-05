'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ═══════════════════════════════════════════════════
// SETTINGS — RBAC, Users, System Config
// ═══════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────
export type UserRow = {
    id: string
    email: string
    name: string | null
    status: string
    roles: string[]
    createdAt: Date
}

export type RoleRow = {
    id: string
    name: string
    deptId: string | null
    permissionCount: number
    userCount: number
}

// ─── List Users ───────────────────────────────────
export async function getUsers(): Promise<UserRow[]> {
    const users = await prisma.user.findMany({
        include: {
            roles: {
                include: { role: { select: { name: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
    })

    return users.map(u => ({
        id: u.id,
        email: u.email,
        name: u.name,
        status: u.status,
        roles: u.roles.map(r => r.role.name),
        createdAt: u.createdAt,
    }))
}

// ─── Create User ──────────────────────────────────
const userSchema = z.object({
    email: z.string().email('Email không hợp lệ'),
    name: z.string().min(2, 'Tên bắt buộc'),
    passwordHash: z.string().min(6, 'Mật khẩu tối thiểu 6 ký tự'),
    roleIds: z.array(z.string()).min(1, 'Chọn ít nhất 1 vai trò'),
})

export type UserInput = z.infer<typeof userSchema>

export async function createUser(input: UserInput): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const data = userSchema.parse(input)

        // Check email unique
        const existing = await prisma.user.findUnique({ where: { email: data.email } })
        if (existing) return { success: false, error: 'Email đã tồn tại' }

        const user = await prisma.user.create({
            data: {
                email: data.email,
                name: data.name,
                passwordHash: data.passwordHash, // In production: hash with bcrypt
                roles: {
                    create: data.roleIds.map(roleId => ({ roleId })),
                },
            },
        })
        revalidatePath('/dashboard/settings')
        return { success: true, id: user.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Update User ──────────────────────────────────
export async function updateUser(
    id: string,
    input: { name?: string; status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' }
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.user.update({
            where: { id },
            data: {
                ...(input.name && { name: input.name }),
                ...(input.status && { status: input.status }),
            },
        })
        revalidatePath('/dashboard/settings')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Assign roles to user ─────────────────────────
export async function updateUserRoles(
    userId: string,
    roleIds: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.$transaction([
            prisma.userRole.deleteMany({ where: { userId } }),
            ...roleIds.map(roleId =>
                prisma.userRole.create({ data: { userId, roleId } })
            ),
        ])
        revalidatePath('/dashboard/settings')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── List Roles ───────────────────────────────────
export async function getRoles(): Promise<RoleRow[]> {
    const roles = await prisma.role.findMany({
        orderBy: { name: 'asc' },
    })

    const result: RoleRow[] = []
    for (const r of roles) {
        const [permCount, userCount] = await Promise.all([
            prisma.rolePermission.count({ where: { roleId: r.id } }),
            prisma.userRole.count({ where: { roleId: r.id } }),
        ])
        result.push({
            id: r.id,
            name: r.name,
            deptId: r.deptId,
            permissionCount: permCount,
            userCount: userCount,
        })
    }
    return result
}

// ─── Create Role ──────────────────────────────────
export async function createRole(input: {
    name: string
    deptId?: string
    permissionIds?: string[]
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const role = await prisma.role.create({
            data: {
                name: input.name,
                deptId: input.deptId ?? null,
                permissions: input.permissionIds?.length
                    ? { create: input.permissionIds.map(permissionId => ({ permissionId })) }
                    : undefined,
            },
        })
        revalidatePath('/dashboard/settings')
        return { success: true, id: role.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── List Permissions ─────────────────────────────
export async function getPermissions() {
    return prisma.permission.findMany({
        orderBy: [{ module: 'asc' }, { action: 'asc' }],
    })
}

// ─── Update Role Permissions ──────────────────────
export async function updateRolePermissions(
    roleId: string,
    permissionIds: string[]
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.$transaction([
            prisma.rolePermission.deleteMany({ where: { roleId } }),
            ...permissionIds.map(permissionId =>
                prisma.rolePermission.create({ data: { roleId, permissionId } })
            ),
        ])
        revalidatePath('/dashboard/settings')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── System Stats ─────────────────────────────────
export async function getSettingsStats() {
    const [users, roles, activeUsers, pendingApprovals] = await Promise.all([
        prisma.user.count(),
        prisma.role.count(),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
        prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
    ])
    return { users, roles, activeUsers, pendingApprovals }
}
