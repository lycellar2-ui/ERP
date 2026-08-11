'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { logAudit } from '@/lib/audit'
import { cached, revalidateCache } from '@/lib/cache'
import { createNotification, triggerNotificationForRole } from '@/lib/notifications'

// ═══════════════════════════════════════════════════
// PRO — TỜ TRÌNH (Proposals / Submissions)
// ═══════════════════════════════════════════════════

// Category → Required approval levels
const CATEGORY_ROUTING: Record<string, number[]> = {
    TASTING: [1, 2, 3],               // TP Sales → Kế toán → CEO
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
    const proposals = await prisma.proposal.findMany({
        where: { proposalNo: { startsWith: prefix } },
        select: { proposalNo: true },
    })

    let maxSeq = 0
    for (const p of proposals) {
        const match = p.proposalNo.match(new RegExp(`^TT-${year}-(\\d+)$`))
        if (match && match[1]) {
            const num = parseInt(match[1], 10)
            if (!isNaN(num) && num > maxSeq) {
                maxSeq = num
            }
        }
    }

    let nextSeq = maxSeq + 1
    let proposalNo = `${prefix}${String(nextSeq).padStart(3, '0')}`

    while (await prisma.proposal.findUnique({ where: { proposalNo } })) {
        nextSeq++
        proposalNo = `${prefix}${String(nextSeq).padStart(3, '0')}`
    }

    return proposalNo
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
                customer: { select: { name: true } },
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
            customerName: p.customer?.name ?? null,
            scope: p.scope,
            discountPct: p.discountPct ? Number(p.discountPct) : null,
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
            customer: { select: { id: true, name: true, code: true } },
            priceItems: {
                include: {
                    product: { select: { id: true, skuCode: true, productName: true, country: true, marginPrice: { select: { wholesalePrice: true } } } }
                }
            },
            attachments: { orderBy: { uploadedAt: 'desc' } },
            comments: {
                orderBy: { createdAt: 'asc' },
                include: { author: { select: { name: true, email: true } } },
            },
            approvalLogs: {
                orderBy: { createdAt: 'asc' },
                include: { approver: { select: { name: true, email: true } } },
            },
            salesOrders: {
                select: {
                    id: true,
                    soNo: true,
                    orderType: true,
                    status: true,
                    totalAmount: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            },
        },
    })
    if (!p) return null

    return {
        ...p,
        estimatedAmount: p.estimatedAmount ? Number(p.estimatedAmount) : null,
        discountPct: p.discountPct ? Number(p.discountPct) : null,
        priceItems: p.priceItems?.map((item: any) => ({
            ...item,
            proposedPrice: Number(item.proposedPrice),
            quantity: item.quantity ? Number(item.quantity) : 1,
            product: {
                ...item.product,
                wholesalePrice: item.product.marginPrice ? Number(item.product.marginPrice.wholesalePrice) : 0
            }
        })) || [],
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
    customerId?: string
    scope?: string
    discountPct?: number
    priceItems?: { productId: string; proposedPrice: number; quantity?: number }[]
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
                customerId: input.customerId ?? null,
                scope: input.scope ?? null,
                discountPct: input.discountPct ?? null,
                priceItems: input.priceItems && input.priceItems.length > 0 ? {
                    createMany: {
                        data: input.priceItems.map(item => ({
                            productId: item.productId,
                            proposedPrice: item.proposedPrice,
                            quantity: item.quantity ?? 1
                        }))
                    }
                } : undefined
            },
        })

        revalidatePath('/dashboard/proposals')
        revalidateCache('proposals')
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
    customerId?: string
    scope?: string
    discountPct?: number
    priceItems?: { productId: string; proposedPrice: number; quantity?: number }[]
}): Promise<{ success: boolean; error?: string }> {
    try {
        const existing = await prisma.proposal.findUnique({ where: { id }, select: { status: true } })
        if (!existing) return { success: false, error: 'Tờ trình không tồn tại' }
        if (existing.status !== 'DRAFT' && existing.status !== 'RETURNED') {
            return { success: false, error: 'Chỉ có thể sửa tờ trình ở trạng thái Nháp hoặc Trả lại' }
        }

        await prisma.$transaction(async (tx) => {
            await tx.proposal.update({
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
                    ...(input.customerId !== undefined && { customerId: input.customerId }),
                    ...(input.scope !== undefined && { scope: input.scope }),
                    ...(input.discountPct !== undefined && { discountPct: input.discountPct }),
                },
            })

            if (input.priceItems !== undefined) {
                // Delete existing ones
                await tx.proposalPriceItem.deleteMany({
                    where: { proposalId: id }
                })
                // Insert new ones if any
                if (input.priceItems.length > 0) {
                    await tx.proposalPriceItem.createMany({
                        data: input.priceItems.map(item => ({
                            proposalId: id,
                            productId: item.productId,
                            proposedPrice: item.proposedPrice,
                            quantity: item.quantity ?? 1
                        }))
                    })
                }
            }
        })

        revalidatePath('/dashboard/proposals')
        revalidateCache('proposals')
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

        // Read dynamic routing configuration from database
        const config = await prisma.approvalConfig.findUnique({
            where: { configKey: `proposal.${proposal.category}` }
        })

        let steps: { level: number; role: string }[] = [
            { level: 1, role: 'SALES_MGR' },
            { level: 2, role: 'KE_TOAN' },
            { level: 3, role: 'CEO' }
        ]

        if (config?.value && typeof config.value === 'object') {
            const val = config.value as any
            if (Array.isArray(val.steps) && val.steps.length > 0) {
                steps = val.steps
            } else if (Array.isArray(val.levels) && val.levels.length > 0) {
                steps = (val.levels as number[]).map(l => ({
                    level: l,
                    role: l === 1 ? 'SALES_MGR' : l === 2 ? 'KE_TOAN' : 'CEO'
                }))
            }
        }

        const firstStep = steps[0] ?? { level: 1, role: 'SALES_MGR' }

        await prisma.proposal.update({
            where: { id },
            data: {
                status: 'SUBMITTED',
                currentLevel: firstStep.level,
                submittedAt: new Date(),
            },
        })

        await logAudit({
            userId,
            action: 'STATUS_CHANGE',
            entityType: 'Proposal',
            entityId: id,
            newValue: { status: 'SUBMITTED', level: firstStep.level },
        })

        await triggerNotificationForRole(firstStep.role, {
            title: `Tờ trình ${proposal.proposalNo} đang chờ phê duyệt`,
            content: `Tờ trình "${proposal.title}" đang chờ bạn phê duyệt ở Cấp ${firstStep.level}.`,
            type: 'info',
            link: `/dashboard/proposals?id=${proposal.id}`
        })

        revalidatePath('/dashboard/proposals')
        revalidatePath('/dashboard')
        revalidateCache('proposals')
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

        // Read dynamic steps
        const config = await prisma.approvalConfig.findUnique({
            where: { configKey: `proposal.${proposal.category}` }
        })

        let steps: { level: number; role: string }[] = [
            { level: 1, role: 'SALES_MGR' },
            { level: 2, role: 'KE_TOAN' },
            { level: 3, role: 'CEO' }
        ]

        if (config?.value && typeof config.value === 'object') {
            const val = config.value as any
            if (Array.isArray(val.steps) && val.steps.length > 0) {
                steps = val.steps
            } else if (Array.isArray(val.levels) && val.levels.length > 0) {
                steps = (val.levels as number[]).map(l => ({
                    level: l,
                    role: l === 1 ? 'SALES_MGR' : l === 2 ? 'KE_TOAN' : 'CEO'
                }))
            }
        }

        const currentLevel = proposal.currentLevel
        const currentIdx = steps.findIndex(s => s.level === currentLevel)

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
        let nextStep: { level: number; role: string } | null = null

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
            // APPROVE — find next step
            nextStep = (currentIdx >= 0 && currentIdx < steps.length - 1) ? steps[currentIdx + 1] : null

            if (nextStep === null) {
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
                try {
                    await syncProposalToCustomerPriceRules(input.proposalId)
                } catch (syncErr) {
                    console.error('[Proposal] Error auto-syncing price rules:', syncErr)
                }
            } else {
                // Move to next step level
                newStatus = `APPROVED_L${currentLevel}`
                await prisma.proposal.update({
                    where: { id: input.proposalId },
                    data: {
                        status: newStatus as any,
                        currentLevel: nextStep.level,
                    },
                })
            }
        }

        if (input.action === 'REJECT') {
            await createNotification({
                userId: proposal.createdBy,
                title: `Tờ trình ${proposal.proposalNo} đã bị từ chối`,
                content: `Tờ trình "${proposal.title}" của bạn đã bị từ chối phê duyệt.`,
                type: 'error',
                link: `/dashboard/proposals?id=${proposal.id}`
            })
        } else if (input.action === 'RETURN') {
            await createNotification({
                userId: proposal.createdBy,
                title: `Tờ trình ${proposal.proposalNo} bị trả lại`,
                content: `Tờ trình "${proposal.title}" của bạn bị trả lại để điều chỉnh thêm. Lý do: ${input.comment || 'Không có lý do chi tiết.'}`,
                type: 'warning',
                link: `/dashboard/proposals?id=${proposal.id}`
            })
        } else {
            if (nextStep === null) {
                await createNotification({
                    userId: proposal.createdBy,
                    title: `Tờ trình ${proposal.proposalNo} đã được phê duyệt!`,
                    content: `Tờ trình "${proposal.title}" của bạn đã được phê duyệt hoàn tất.`,
                    type: 'success',
                    link: `/dashboard/proposals?id=${proposal.id}`
                })
            } else {
                await triggerNotificationForRole(nextStep.role, {
                    title: `Tờ trình ${proposal.proposalNo} chờ phê duyệt`,
                    content: `Tờ trình "${proposal.title}" đã được duyệt ở Cấp ${currentLevel} và đang chờ bạn phê duyệt ở Cấp ${nextStep.level}.`,
                    type: 'info',
                    link: `/dashboard/proposals?id=${proposal.id}`
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
        revalidateCache('proposals')
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

        const proposal = await prisma.proposal.findUnique({ where: { id: input.proposalId }, select: { createdBy: true, proposalNo: true } })
        if (proposal && input.authorId !== proposal.createdBy) {
            await createNotification({
                userId: proposal.createdBy,
                title: `Có bình luận mới trên Tờ trình ${proposal.proposalNo}`,
                content: `Bình luận mới: "${input.content.substring(0, 50)}${input.content.length > 50 ? '...' : ''}"`,
                type: 'info',
                link: `/dashboard/proposals?id=${input.proposalId}`
            })
        }

        revalidatePath('/dashboard/proposals')
        revalidateCache('proposals')
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
                status: { in: ['SUBMITTED', 'REVIEWING', 'PENDING_APPROVAL', 'APPROVED_L1', 'APPROVED_L2'] },
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
        if (status === 'CLOSED') {
            try {
                await syncProposalToCustomerPriceRules(id)
            } catch (syncErr) {
                console.error('[Proposal] Error auto-syncing price rules on close:', syncErr)
            }
        }
        await logAudit({
            userId,
            action: 'STATUS_CHANGE',
            entityType: 'Proposal',
            entityId: id,
            newValue: { status },
        })
        revalidatePath('/dashboard/proposals')
        revalidateCache('proposals')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Auto Sync Proposal Price Items to CustomerPriceRules ────────
export async function syncProposalToCustomerPriceRules(proposalId: string) {
    const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
            priceItems: true,
            customer: true,
        },
    })

    if (!proposal || !proposal.customerId) {
        return { count: 0 }
    }

    const userId = proposal.createdBy ?? 'system'
    const startDate = proposal.resolvedAt ?? proposal.submittedAt ?? new Date()
    const endDate = new Date('2026-12-31T23:59:59.999Z')
    let createdCount = 0

    // 1. Specific product prices
    for (const item of proposal.priceItems) {
        const proposedPrice = Number(item.proposedPrice)
        if (!proposedPrice || proposedPrice <= 0) continue

        const existing = await prisma.customerPriceRule.findFirst({
            where: {
                customerId: proposal.customerId,
                productId: item.productId,
                status: 'APPROVED',
            },
        })

        const noteText = `Áp dụng từ Tờ trình ${proposal.proposalNo}: ${proposal.title}`

        if (existing) {
            await prisma.customerPriceRule.update({
                where: { id: existing.id },
                data: {
                    ruleType: 'SPECIAL_PRICE',
                    value: proposedPrice,
                    startDate,
                    endDate,
                    approvedBy: userId,
                    approvedAt: new Date(),
                    notes: noteText,
                },
            })
        } else {
            await prisma.customerPriceRule.create({
                data: {
                    customerId: proposal.customerId,
                    productId: item.productId,
                    ruleType: 'SPECIAL_PRICE',
                    value: proposedPrice,
                    startDate,
                    endDate,
                    status: 'APPROVED',
                    requestedBy: userId,
                    approvedBy: userId,
                    approvedAt: new Date(),
                    notes: noteText,
                },
            })
        }
        createdCount++
    }

    // 2. Portfolio discount percentage
    if (proposal.discountPct && Number(proposal.discountPct) > 0) {
        const discountVal = Number(proposal.discountPct)
        const products = await prisma.product.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true },
        })

        const explicitProductIds = new Set(proposal.priceItems.map(i => i.productId))
        const remainingProducts = products.filter(p => !explicitProductIds.has(p.id))

        for (const prod of remainingProducts) {
            const existing = await prisma.customerPriceRule.findFirst({
                where: {
                    customerId: proposal.customerId,
                    productId: prod.id,
                    status: 'APPROVED',
                },
            })

            const noteText = `Áp dụng chiết khấu ${discountVal}% từ Tờ trình ${proposal.proposalNo}: ${proposal.title}`

            if (existing) {
                if (existing.ruleType === 'FIXED_DISCOUNT') {
                    await prisma.customerPriceRule.update({
                        where: { id: existing.id },
                        data: {
                            ruleType: 'FIXED_DISCOUNT',
                            value: discountVal,
                            startDate,
                            endDate,
                            approvedBy: userId,
                            approvedAt: new Date(),
                            notes: noteText,
                        },
                    })
                }
            } else {
                await prisma.customerPriceRule.create({
                    data: {
                        customerId: proposal.customerId,
                        productId: prod.id,
                        ruleType: 'FIXED_DISCOUNT',
                        value: discountVal,
                        startDate,
                        endDate,
                        status: 'APPROVED',
                        requestedBy: userId,
                        approvedBy: userId,
                        approvedAt: new Date(),
                        notes: noteText,
                    },
                })
                createdCount++
            }
        }
    }

    revalidatePath('/dashboard/price-list')
    revalidateCache('pricing')
    return { count: createdCount }
}

