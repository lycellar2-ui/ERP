'use server'

import { prisma } from '@/lib/db'
import { logAudit } from '@/lib/audit'

type ApprovalDocType = 'PURCHASE_ORDER' | 'SALES_ORDER' | 'WRITE_OFF' | 'DISCOUNT_OVERRIDE' | 'TAX_DECLARATION' | 'CONSIGNMENT'

// ─── Submit Document for Approval ─────────────────
export async function submitForApproval(params: {
    docType: ApprovalDocType
    docId: string
    docValue: number
    requestedBy: string
    requestedByName?: string
}): Promise<{ success: boolean; requestId?: string; error?: string }> {
    try {
        // Find matching template
        const template = await prisma.approvalTemplate.findFirst({
            where: { docType: params.docType },
            include: {
                steps: { orderBy: { stepOrder: 'asc' } },
            },
        })

        if (!template) {
            return { success: false, error: `Không tìm thấy quy trình duyệt cho loại ${params.docType}` }
        }

        // Find first applicable step based on threshold
        const applicableStep = template.steps.find(
            s => !s.threshold || params.docValue >= Number(s.threshold)
        )

        if (!applicableStep) {
            // No approval needed — auto-approve
            return { success: true, requestId: undefined }
        }

        // Check for existing pending request
        const existing = await prisma.approvalRequest.findFirst({
            where: {
                docType: params.docType,
                docId: params.docId,
                status: 'PENDING',
            },
        })

        if (existing) {
            return { success: true, requestId: existing.id }
        }

        // Create approval request
        const request = await prisma.approvalRequest.create({
            data: {
                templateId: template.id,
                docType: params.docType,
                docId: params.docId,
                currentStep: applicableStep.stepOrder,
                status: 'PENDING',
                requestedBy: params.requestedBy,
            },
        })

        await logAudit({
            userId: params.requestedBy,
            userName: params.requestedByName,
            action: 'CREATE',
            entityType: 'ApprovalRequest',
            entityId: request.id,
            newValue: {
                docType: params.docType,
                docId: params.docId,
                step: applicableStep.stepOrder,
                approverRole: applicableStep.approverRole,
            },
        })

        return { success: true, requestId: request.id }
    } catch (err: any) {
        console.error('[Approval] Submit error:', err)
        return { success: false, error: err.message }
    }
}

// ─── Approve Request ──────────────────────────────
export async function approveRequest(params: {
    requestId: string
    approvedBy: string
    approverName?: string
    comment?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const request = await prisma.approvalRequest.findUnique({
            where: { id: params.requestId },
            include: {
                template: {
                    include: { steps: { orderBy: { stepOrder: 'asc' } } },
                },
            },
        })

        if (!request) return { success: false, error: 'Yêu cầu không tồn tại' }
        if (request.status !== 'PENDING') return { success: false, error: 'Yêu cầu đã được xử lý' }

        const currentStep = request.template.steps.find(s => s.stepOrder === request.currentStep)
        if (!currentStep) return { success: false, error: 'Step không hợp lệ' }

        // Log approval
        await prisma.approvalLog.create({
            data: {
                requestId: request.id,
                step: request.currentStep,
                action: 'APPROVE',
                approvedBy: params.approvedBy,
                comment: params.comment,
            },
        })

        // Check if there's a next step
        const nextStep = request.template.steps.find(s => s.stepOrder > request.currentStep)

        if (nextStep) {
            // Move to next step
            await prisma.approvalRequest.update({
                where: { id: request.id },
                data: { currentStep: nextStep.stepOrder },
            })
        } else {
            // Final approval — mark as approved
            await prisma.approvalRequest.update({
                where: { id: request.id },
                data: { status: 'APPROVED' },
            })
        }

        await logAudit({
            userId: params.approvedBy,
            userName: params.approverName,
            action: 'APPROVE',
            entityType: 'ApprovalRequest',
            entityId: request.id,
            newValue: {
                docType: request.docType,
                docId: request.docId,
                step: request.currentStep,
                nextStep: nextStep?.stepOrder,
                status: nextStep ? 'PENDING' : 'APPROVED',
            },
        })

        return { success: true }
    } catch (err: any) {
        console.error('[Approval] Approve error:', err)
        return { success: false, error: err.message }
    }
}

// ─── Reject Request ───────────────────────────────
export async function rejectRequest(params: {
    requestId: string
    rejectedBy: string
    rejectorName?: string
    reason: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const request = await prisma.approvalRequest.findUnique({
            where: { id: params.requestId },
        })

        if (!request) return { success: false, error: 'Yêu cầu không tồn tại' }
        if (request.status !== 'PENDING') return { success: false, error: 'Yêu cầu đã được xử lý' }

        await prisma.approvalLog.create({
            data: {
                requestId: request.id,
                step: request.currentStep,
                action: 'REJECT',
                approvedBy: params.rejectedBy,
                comment: params.reason,
            },
        })

        await prisma.approvalRequest.update({
            where: { id: request.id },
            data: { status: 'REJECTED' },
        })

        await logAudit({
            userId: params.rejectedBy,
            userName: params.rejectorName,
            action: 'REJECT',
            entityType: 'ApprovalRequest',
            entityId: request.id,
            newValue: {
                docType: request.docType,
                docId: request.docId,
                reason: params.reason,
            },
        })

        return { success: true }
    } catch (err: any) {
        console.error('[Approval] Reject error:', err)
        return { success: false, error: err.message }
    }
}

// ─── Get Pending Approvals for User ───────────────
export async function getPendingApprovals(userRoles: string[]) {
    const requests = await prisma.approvalRequest.findMany({
        where: { status: 'PENDING' },
        include: {
            template: {
                include: { steps: { orderBy: { stepOrder: 'asc' } } },
            },
            requester: { select: { name: true, email: true } },
            logs: { orderBy: { createdAt: 'desc' }, take: 5 },
        },
        orderBy: { createdAt: 'desc' },
    })

    // Filter to only show requests where current step approver matches user's roles
    return requests.filter(r => {
        const step = r.template.steps.find(s => s.stepOrder === r.currentStep)
        return step && userRoles.includes(step.approverRole)
    })
}

// ─── Get Approval Status for a Document ───────────
export async function getApprovalStatus(docType: ApprovalDocType, docId: string) {
    return prisma.approvalRequest.findFirst({
        where: { docType, docId },
        include: {
            logs: {
                orderBy: { createdAt: 'desc' },
                include: { approver: { select: { name: true } } },
            },
        },
        orderBy: { createdAt: 'desc' },
    })
}
