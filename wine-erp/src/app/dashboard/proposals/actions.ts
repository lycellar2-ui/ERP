'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { cached, revalidateCache } from '@/lib/cache'

// ═══════════════════════════════════════════════════
// PRO — TỜ TRÌNH (Proposals / Submissions)
// ═══════════════════════════════════════════════════

// Category → Required approval levels
const CATEGORY_ROUTING: Record<string, number[]> = {
    BUDGET_REQUEST: [1, 2, 3],        // TP → KT Trưởng → CEO
    CAPITAL_EXPENDITURE: [1, 2, 3],
    PRICE_ADJUSTMENT: [1, 2, 3],
    NEW_SUPPLIER: [1, 3],             // TP Mua hàng → CEO
    NEW_PRODUCT: [1, 3],
    POLICY_CHANGE: [3],               // Trực tiếp CEO
    STAFF_REQUISITION: [1, 3],
    PAYMENT_SCHEDULE: [2, 3],         // KT Trưởng → CEO
    PROMOTION_CAMPAIGN: [1, 2, 3],
    SPECIAL_EVENT: [1, 2, 3],
    LICENSE_RENEWAL: [2, 3],
    CONTRACT_SIGNING: [2, 3],
    DEBT_WRITE_OFF: [2, 3],
    OTHER: [1, 3],
}

// ─── Generate proposal number ────────────────────
async function generateProposalNo(): Promise<string> {
    const year = new Date().getFullYear()
    const prefix = `TT-${year}-`
    const last = await prisma.proposal.findFirst({
        where: { proposalNo: { startsWith: prefix } },
        orderBy: { proposalNo: 'desc' },
        select: { proposalNo: true },
    })
    const seq = last ? parseInt(last.proposalNo.split('-').pop() ?? '0', 10) + 1 : 1
    return `${prefix}${String(seq).padStart(3, '0')}`
}

// ─── List proposals ──────────────────────────────
export async function getProposals(filters?: {
    status?: string
    category?: string
    createdBy?: string
}) {
    const cacheKey = `proposals:list:${filters?.status ?? ''}:${filters?.category ?? ''}:${filters?.createdBy ?? ''}`
    return cached(cacheKey, async () => {
        const where: any = {}
        if (filters?.status) where.status = filters.status
        if (filters?.category) where.category = filters.category
        if (filters?.createdBy) where.createdBy = filters.createdBy

        const proposals = await prisma.proposal.findMany({
            where,
            include: {
                creator: { select: { name: true, email: true } },
                department: { select: { name: true } },
                _count: { select: { attachments: true, comments: true } },
            },
            orderBy: [
                { priority: 'desc' },
                { createdAt: 'desc' },
            ],
        })

        return proposals.map(p => ({
            id: p.id,
            proposalNo: p.proposalNo,
            category: p.category,
            priority: p.priority,
            title: p.title,
            estimatedAmount: p.estimatedAmount ? Number(p.estimatedAmount) : null,
            currency: p.currency,
            deadline: p.deadline,
            status: p.status,
            currentLevel: p.currentLevel,
            creatorName: p.creator.name ?? p.creator.email,
            departmentName: p.department?.name ?? null,
            attachmentCount: p._count.attachments,
            commentCount: p._count.comments,
            submittedAt: p.submittedAt,
            resolvedAt: p.resolvedAt,
            createdAt: p.createdAt,
        }))
    }, 30_000) // 30s cache
}

// ─── Get proposal detail ─────────────────────────
export async function getProposalDetail(id: string) {
    const p = await prisma.proposal.findUnique({
        where: { id },
        include: {
            creator: { select: { id: true, name: true, email: true } },
            department: { select: { name: true } },
            attachments: { orderBy: { uploadedAt: 'desc' } },
            comments: {
                orderBy: { createdAt: 'asc' },
                include: { author: { select: { name: true, email: true } } },
            },
            approvalLogs: {
                orderBy: { createdAt: 'asc' },
                include: { approver: { select: { name: true, email: true } } },
            },
        },
    })
    if (!p) return null

    return {
        ...p,
        estimatedAmount: p.estimatedAmount ? Number(p.estimatedAmount) : null,
        requiredLevels: CATEGORY_ROUTING[p.category] ?? [1, 3],
    }
}

// ─── Create proposal ─────────────────────────────
export async function createProposal(input: {
    category: string
    priority?: string
    title: string
    content: string
    justification?: string
    expectedOutcome?: string
    estimatedAmount?: number
    currency?: string
    deadline?: string
    createdBy: string
    departmentId?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const proposalNo = await generateProposalNo()
        const proposal = await prisma.proposal.create({
            data: {
                proposalNo,
                category: input.category as any,
                priority: (input.priority as any) ?? 'NORMAL',
                title: input.title,
                content: input.content,
                justification: input.justification ?? null,
                expectedOutcome: input.expectedOutcome ?? null,
                estimatedAmount: input.estimatedAmount ?? null,
                currency: input.currency ?? 'VND',
                deadline: input.deadline ? new Date(input.deadline) : null,
                createdBy: input.createdBy,
                departmentId: input.departmentId ?? null,
                status: 'DRAFT',
                currentLevel: 0,
            },
        })

        revalidatePath('/dashboard/proposals')
        return { success: true, id: proposal.id }
    } catch (err: any) {
        console.error('[Proposal] Create error:', err)
        return { success: false, error: err.message }
    }
}

// ─── Update proposal (draft only) ────────────────
export async function updateProposal(id: string, input: {
    title?: string
    content?: string
    justification?: string
    expectedOutcome?: string
    estimatedAmount?: number
    category?: string
    priority?: string
    deadline?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const existing = await prisma.proposal.findUnique({ where: { id }, select: { status: true } })
        if (!existing) return { success: false, error: 'Tờ trình không tồn tại' }
        if (existing.status !== 'DRAFT' && existing.status !== 'RETURNED') {
            return { success: false, error: 'Chỉ có thể sửa tờ trình ở trạng thái Nháp hoặc Trả lại' }
        }

        await prisma.proposal.update({
            where: { id },
            data: {
                ...(input.title && { title: input.title }),
                ...(input.content && { content: input.content }),
                ...(input.justification !== undefined && { justification: input.justification }),
                ...(input.expectedOutcome !== undefined && { expectedOutcome: input.expectedOutcome }),
                ...(input.estimatedAmount !== undefined && { estimatedAmount: input.estimatedAmount }),
                ...(input.category && { category: input.category as any }),
                ...(input.priority && { priority: input.priority as any }),
                ...(input.deadline && { deadline: new Date(input.deadline) }),
            },
        })

        revalidatePath('/dashboard/proposals')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Submit proposal for approval ────────────────
export async function submitProposal(id: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const proposal = await prisma.proposal.findUnique({ where: { id } })
        if (!proposal) return { success: false, error: 'Tờ trình không tồn tại' }
        if (proposal.status !== 'DRAFT' && proposal.status !== 'RETURNED') {
            return { success: false, error: 'Chỉ có thể trình tờ trình ở trạng thái Nháp hoặc Trả lại' }
        }

        const levels = CATEGORY_ROUTING[proposal.category] ?? [1, 3]
        const firstLevel = levels[0]

        await prisma.proposal.update({
            where: { id },
            data: {
                status: 'SUBMITTED',
                currentLevel: firstLevel,
                submittedAt: new Date(),
            },
        })

        await logAudit({
            userId,
            action: 'STATUS_CHANGE',
            entityType: 'Proposal',
            entityId: id,
            newValue: { status: 'SUBMITTED', level: firstLevel },
        })

        revalidatePath('/dashboard/proposals')
        revalidatePath('/dashboard')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Process approval (approve/reject/return) ────
export async function processProposalApproval(input: {
    proposalId: string
    action: 'APPROVE' | 'REJECT' | 'RETURN'
    approverId: string
    comment?: string
}): Promise<{ success: boolean; newStatus?: string; error?: string }> {
    try {
        const proposal = await prisma.proposal.findUnique({ where: { id: input.proposalId } })
        if (!proposal) return { success: false, error: 'Tờ trình không tồn tại' }
        if (!['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'].includes(proposal.status)) {
            return { success: false, error: 'Tờ trình không ở trạng thái chờ duyệt' }
        }

        const levels = CATEGORY_ROUTING[proposal.category] ?? [1, 3]
        const currentLevel = proposal.currentLevel

        // Log the action
        await prisma.proposalApprovalLog.create({
            data: {
                proposalId: input.proposalId,
                level: currentLevel,
                action: input.action === 'RETURN' ? 'REJECT' : input.action,
                approvedBy: input.approverId,
                comment: input.comment ?? null,
            },
        })

        let newStatus: string

        if (input.action === 'REJECT') {
            newStatus = 'REJECTED'
            await prisma.proposal.update({
                where: { id: input.proposalId },
                data: { status: 'REJECTED', resolvedAt: new Date() },
            })
        } else if (input.action === 'RETURN') {
            newStatus = 'RETURNED'
            await prisma.proposal.update({
                where: { id: input.proposalId },
                data: { status: 'RETURNED' },
            })
        } else {
            // APPROVE — find next level
            const currentIdx = levels.indexOf(currentLevel)
            const nextLevel = currentIdx < levels.length - 1 ? levels[currentIdx + 1] : null

            if (nextLevel === null) {
                // Final approval
                newStatus = 'APPROVED'
                await prisma.proposal.update({
                    where: { id: input.proposalId },
                    data: {
                        status: 'APPROVED',
                        currentLevel: currentLevel,
                        resolvedAt: new Date(),
                    },
                })
            } else {
                // Move to next level
                newStatus = currentLevel === 1 ? 'APPROVED_L1'
                    : currentLevel === 2 ? 'APPROVED_L2'
                        : 'REVIEWING'
                await prisma.proposal.update({
                    where: { id: input.proposalId },
                    data: {
                        status: newStatus as any,
                        currentLevel: nextLevel,
                    },
                })
            }
        }

        await logAudit({
            userId: input.approverId,
            action: input.action,
            entityType: 'Proposal',
            entityId: input.proposalId,
            newValue: { status: newStatus, level: currentLevel, comment: input.comment },
        })

        revalidatePath('/dashboard/proposals')
        revalidatePath('/dashboard')
        return { success: true, newStatus }
    } catch (err: any) {
        console.error('[Proposal] Approval error:', err)
        return { success: false, error: err.message }
    }
}

// ─── Add comment ─────────────────────────────────
export async function addProposalComment(input: {
    proposalId: string
    authorId: string
    content: string
    isInternal?: boolean
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.proposalComment.create({
            data: {
                proposalId: input.proposalId,
                authorId: input.authorId,
                content: input.content,
                isInternal: input.isInternal ?? false,
            },
        })
        revalidatePath('/dashboard/proposals')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Stats for proposals page ────────────────────
export async function getProposalStats() {
    return cached('proposals:stats', async () => {
        const [total, pending, approved, rejected, draft] = await Promise.all([
            prisma.proposal.count(),
            prisma.proposal.count({ where: { status: { in: ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'] } } }),
            prisma.proposal.count({ where: { status: 'APPROVED' } }),
            prisma.proposal.count({ where: { status: 'REJECTED' } }),
            prisma.proposal.count({ where: { status: 'DRAFT' } }),
        ])
        return { total, pending, approved, rejected, draft }
    }, 30_000) // 30s cache
}

// ─── Pending proposals for CEO dashboard ─────────
export async function getPendingProposalsForCEO() {
    return cached('proposals:pendingCEO', async () => {
        const proposals = await prisma.proposal.findMany({
            where: {
                status: { in: ['SUBMITTED', 'REVIEWING', 'APPROVED_L1', 'APPROVED_L2'] },
                currentLevel: 3, // CEO level
            },
            include: {
                creator: { select: { name: true, email: true } },
                department: { select: { name: true } },
                _count: { select: { attachments: true, comments: true } },
                approvalLogs: {
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                    include: { approver: { select: { name: true } } },
                },
            },
            orderBy: [
                { priority: 'desc' },
                { submittedAt: 'asc' },
            ],
        })

        return proposals.map(p => ({
            id: p.id,
            proposalNo: p.proposalNo,
            category: p.category,
            priority: p.priority,
            title: p.title,
            estimatedAmount: p.estimatedAmount ? Number(p.estimatedAmount) : null,
            currency: p.currency,
            deadline: p.deadline,
            status: p.status,
            currentLevel: p.currentLevel,
            creatorName: p.creator.name ?? p.creator.email,
            departmentName: p.department?.name ?? null,
            attachmentCount: p._count.attachments,
            commentCount: p._count.comments,
            submittedAt: p.submittedAt,
            previousApprovals: p.approvalLogs.map(l => ({
                level: l.level,
                action: l.action,
                approverName: l.approver.name,
                createdAt: l.createdAt,
            })),
        }))
    }, 15_000) // 15s cache — realtime-ish
}

// ─── Mark as in-progress / closed ────────────────
export async function updateProposalStatus(
    id: string,
    status: 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED',
    userId: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.proposal.update({
            where: { id },
            data: {
                status: status as any,
                ...(status === 'CLOSED' && { resolvedAt: new Date() }),
            },
        })
        await logAudit({
            userId,
            action: 'STATUS_CHANGE',
            entityType: 'Proposal',
            entityId: id,
            newValue: { status },
        })
        revalidatePath('/dashboard/proposals')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
