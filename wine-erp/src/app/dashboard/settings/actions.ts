'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cached, revalidateCache } from '@/lib/cache'

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
    return cached('settings:users', async () => {
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
    }) // end cached
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
        revalidateCache('settings')
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
        revalidateCache('settings')
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
        revalidateCache('settings')
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
        revalidateCache('settings')
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
        revalidateCache('settings')
        revalidatePath('/dashboard/settings')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── System Stats ─────────────────────────────────
export async function getSettingsStats() {
    return cached('settings:stats', async () => {
        const [users, roles, activeUsers, pendingApprovals] = await Promise.all([
            prisma.user.count(),
            prisma.role.count(),
            prisma.user.count({ where: { status: 'ACTIVE' } }),
            prisma.approvalRequest.count({ where: { status: 'PENDING' } }),
        ])
        return { users, roles, activeUsers, pendingApprovals }
    }) // end cached
}

// ═══════════════════════════════════════════════════
// APPROVAL WORKFLOW ENGINE
// ═══════════════════════════════════════════════════

// ── Get approval templates ────────────────────────
export async function getApprovalTemplates() {
    return prisma.approvalTemplate.findMany({
        include: {
            steps: { orderBy: { stepOrder: 'asc' } },
            _count: { select: { requests: true } },
        },
        orderBy: { name: 'asc' },
    })
}

// ── Create approval template with steps ───────────
export async function createApprovalTemplate(input: {
    name: string
    docType: 'PURCHASE_ORDER' | 'SALES_ORDER' | 'WRITE_OFF' | 'DISCOUNT_OVERRIDE' | 'TAX_DECLARATION' | 'CONSIGNMENT'
    steps: { approverRole: string; threshold?: number }[]
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const template = await prisma.approvalTemplate.create({
            data: {
                name: input.name,
                docType: input.docType,
                steps: {
                    create: input.steps.map((s, i) => ({
                        stepOrder: i + 1,
                        approverRole: s.approverRole,
                        threshold: s.threshold ?? null,
                    })),
                },
            },
        })
        revalidateCache('settings')
        revalidatePath('/dashboard/settings')
        return { success: true, id: template.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Submit document for approval ──────────────────
export async function submitForApproval(input: {
    docType: 'PURCHASE_ORDER' | 'SALES_ORDER' | 'WRITE_OFF' | 'DISCOUNT_OVERRIDE' | 'TAX_DECLARATION' | 'CONSIGNMENT'
    docId: string
    requestedBy: string
    docValue?: number // Optional: for threshold-based routing
}): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
        // Find matching template
        const template = await prisma.approvalTemplate.findFirst({
            where: { docType: input.docType },
            include: { steps: { orderBy: { stepOrder: 'asc' } } },
        })
        if (!template) return { success: false, error: 'Không tìm thấy template phê duyệt cho loại tài liệu này' }

        // Filter steps by threshold (only steps where threshold <= docValue, or no threshold)
        const applicableSteps = template.steps.filter(s =>
            !s.threshold || (input.docValue && input.docValue >= Number(s.threshold))
        )
        if (applicableSteps.length === 0) {
            return { success: false, error: 'Không có bước phê duyệt phù hợp' }
        }

        const request = await prisma.approvalRequest.create({
            data: {
                templateId: template.id,
                docType: input.docType,
                docId: input.docId,
                currentStep: 1,
                status: 'PENDING',
                requestedBy: input.requestedBy,
            },
        })

        revalidateCache('settings')
        revalidatePath('/dashboard/settings')
        return { success: true, requestId: request.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Approve a pending request ─────────────────────
export async function processApproval(input: {
    requestId: string
    action: 'APPROVE' | 'REJECT'
    approverId: string
    comment?: string
}): Promise<{ success: boolean; finalStatus?: string; error?: string }> {
    try {
        const request = await prisma.approvalRequest.findUnique({
            where: { id: input.requestId },
            include: {
                template: { include: { steps: { orderBy: { stepOrder: 'asc' } } } },
            },
        })
        if (!request) return { success: false, error: 'Yêu cầu phê duyệt không tồn tại' }
        if (request.status !== 'PENDING') return { success: false, error: 'Yêu cầu đã được xử lý' }

        // Verify approver has the correct role for this step
        const currentStepDef = request.template.steps.find(s => s.stepOrder === request.currentStep)
        if (!currentStepDef) return { success: false, error: 'Bước phê duyệt không tồn tại' }

        const approverRoles = await prisma.userRole.findMany({
            where: { userId: input.approverId },
            include: { role: true },
        })
        const hasRole = approverRoles.some(ur => ur.role.name === currentStepDef.approverRole)
        if (!hasRole) return { success: false, error: `Bạn không có quyền phê duyệt bước này (cần vai trò: ${currentStepDef.approverRole})` }

        // Log the action
        await prisma.approvalLog.create({
            data: {
                requestId: input.requestId,
                step: request.currentStep,
                action: input.action,
                approvedBy: input.approverId,
                comment: input.comment ?? null,
            },
        })

        if (input.action === 'REJECT') {
            await prisma.approvalRequest.update({
                where: { id: input.requestId },
                data: { status: 'REJECTED' },
            })
            revalidateCache('settings')
            revalidatePath('/dashboard/settings')
            return { success: true, finalStatus: 'REJECTED' }
        }

        // APPROVE: check if there are more steps
        const totalSteps = request.template.steps.length
        const nextStep = request.currentStep + 1

        if (nextStep > totalSteps) {
            // Final approval
            await prisma.approvalRequest.update({
                where: { id: input.requestId },
                data: { status: 'APPROVED', currentStep: request.currentStep },
            })
            revalidateCache('settings')
            revalidatePath('/dashboard/settings')
            return { success: true, finalStatus: 'APPROVED' }
        } else {
            // Move to next step
            await prisma.approvalRequest.update({
                where: { id: input.requestId },
                data: { currentStep: nextStep },
            })
            revalidateCache('settings')
            revalidatePath('/dashboard/settings')
            return { success: true, finalStatus: 'PENDING' }
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Get pending approvals for a user ──────────────
export async function getPendingApprovals(userId: string) {
    // Get user's roles
    const userRoles = await prisma.userRole.findMany({
        where: { userId },
        include: { role: true },
    })
    const roleNames = userRoles.map(ur => ur.role.name)

    // Find pending requests where current step matches user's role
    const pending = await prisma.approvalRequest.findMany({
        where: { status: 'PENDING' },
        include: {
            template: { include: { steps: true } },
            requester: { select: { name: true, email: true } },
            logs: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
    })

    // Filter: only items where currentStep's approverRole matches user's roles
    return pending.filter(req => {
        const step = req.template.steps.find(s => s.stepOrder === req.currentStep)
        return step && roleNames.includes(step.approverRole)
    }).map(req => ({
        id: req.id,
        docType: req.docType,
        docId: req.docId,
        templateName: req.template.name,
        currentStep: req.currentStep,
        totalSteps: req.template.steps.length,
        requesterName: req.requester.name ?? req.requester.email,
        createdAt: req.createdAt,
        logs: req.logs.map(l => ({
            step: l.step,
            action: l.action,
            comment: l.comment,
            createdAt: l.createdAt,
        })),
    }))
}

// ── Audit trail for a document ────────────────────
export async function getApprovalHistory(docType: string, docId: string) {
    const requests = await prisma.approvalRequest.findMany({
        where: { docType: docType as any, docId },
        include: {
            template: { select: { name: true } },
            requester: { select: { name: true, email: true } },
            logs: {
                orderBy: { createdAt: 'asc' },
                include: { approver: { select: { name: true, email: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
    })

    return requests.map(req => ({
        id: req.id,
        templateName: req.template.name,
        status: req.status,
        requesterName: req.requester.name ?? req.requester.email,
        createdAt: req.createdAt,
        logs: req.logs.map(l => ({
            step: l.step,
            action: l.action,
            approverName: l.approver.name ?? l.approver.email,
            comment: l.comment,
            createdAt: l.createdAt,
        })),
    }))
}
