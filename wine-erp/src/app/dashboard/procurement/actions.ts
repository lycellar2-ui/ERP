'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cached, revalidateCache } from '@/lib/cache'
import { requireAuth } from '@/lib/session'
import { findHierarchicalTaxRate } from '@/lib/tax-utils'

import { DEFAULT_PO_ROUTING, type PORouteConfig } from '@/app/dashboard/settings/approval-matrix/constants'
import {
    type POShipmentSummary,
    type POApprovalLog,
    type POStepConfig,
    type PORow,
    type PODetail,
    type CreatePOInput,
    type POCurrencyBreakdown,
    createPOSchema,
} from './types'
import { formatVND } from '@/lib/utils'

// ─── POStatus enum ────────────────────────────────
// DRAFT | PENDING_APPROVAL | APPROVED | IN_TRANSIT | PARTIALLY_RECEIVED | RECEIVED | CANCELLED

// ─── Seed system user if needed ──────────────────
async function getOrCreateSystemUser(): Promise<string> {
    const existing = await prisma.user.findFirst({
        where: { email: 'system@wine-erp.vn' },
        select: { id: true },
    })
    if (existing) return existing.id

    // Need a department first
    let dept = await prisma.department.findFirst({ select: { id: true } })
    if (!dept) {
        dept = await prisma.department.create({ data: { name: 'System' } })
    }

    const user = await prisma.user.create({
        data: {
            email: 'system@wine-erp.vn',
            name: 'System Admin',
            passwordHash: 'not-used',
            deptId: dept.id,
            status: 'ACTIVE',
        },
    })
    return user.id
}

// ─── List POs ─────────────────────────────────────
export async function getPurchaseOrders(filters: {
    search?: string
    status?: string
    supplierId?: string
    legalEntityId?: string
    currency?: string
    incoterms?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: PORow[]; total: number; statusCounts: Record<string, number> }> {
    const { 
        search, status, supplierId, legalEntityId, currency, incoterms, 
        dateFrom, dateTo, page = 1, pageSize = 20 
    } = filters
    const cacheKey = `procurement:list:${page}:${pageSize}:${search ?? ''}:${status ?? ''}:${supplierId ?? ''}:${legalEntityId ?? ''}:${currency ?? ''}:${incoterms ?? ''}:${dateFrom ?? ''}:${dateTo ?? ''}`
    return cached(cacheKey, async () => {

        const where: any = {}
        if (search) {
            where.OR = [
                { poNo: { contains: search, mode: 'insensitive' } },
                { supplier: { name: { contains: search, mode: 'insensitive' } } },
                { supplier: { code: { contains: search, mode: 'insensitive' } } },
                { shipments: { some: { billOfLading: { contains: search, mode: 'insensitive' } } } },
                { shipments: { some: { vesselName: { contains: search, mode: 'insensitive' } } } },
                { shipments: { some: { containerNo: { contains: search, mode: 'insensitive' } } } },
            ]
        }
        if (status) where.status = status
        if (supplierId) where.supplierId = supplierId
        if (legalEntityId) where.legalEntityId = legalEntityId
        if (currency) where.currency = currency
        if (incoterms) where.incoterms = incoterms
        if (dateFrom) {
            where.createdAt = { ...(where.createdAt || {}), gte: new Date(dateFrom) }
        }
        if (dateTo) {
            where.createdAt = { ...(where.createdAt || {}), lte: new Date(dateTo + 'T23:59:59.999Z') }
        }

        const [items, total, countGroupBy] = await Promise.all([
            prisma.purchaseOrder.findMany({
                where,
                include: {
                    legalEntity: { select: { id: true, code: true, name: true } },
                    supplier: { select: { id: true, name: true, code: true, country: true, paymentTerm: true, incoterms: true } },
                    creator: { select: { id: true, name: true } },
                    documents: { select: { id: true, name: true, fileUrl: true, uploadedAt: true } },
                    lines: { select: { qtyOrdered: true, unitPrice: true } },
                    shipments: {
                        select: {
                            id: true,
                            billOfLading: true,
                            vesselName: true,
                            voyageNo: true,
                            containerNo: true,
                            containerType: true,
                            eta: true,
                            etd: true,
                            portOfLoading: true,
                            portOfDischarge: true,
                            status: true,
                            milestones: { select: { completedAt: true } },
                        },
                        orderBy: { createdAt: 'desc' },
                    },
                    goodsReceipts: {
                        where: { status: 'CONFIRMED' },
                        select: {
                            lines: { select: { qtyReceived: true } },
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.purchaseOrder.count({ where }),
            prisma.purchaseOrder.groupBy({
                by: ['status'],
                _count: { id: true },
            }),
        ])

        const statusCounts: Record<string, number> = { ALL: 0 }
        for (const item of countGroupBy) {
            statusCounts[item.status] = item._count.id
            statusCounts.ALL += item._count.id
        }

        const rows: PORow[] = items.map((po: any) => {
            const totalAmount = po.lines.reduce((s: number, l: any) => s + Number(l.qtyOrdered) * Number(l.unitPrice), 0)
            const totalQty = po.lines.reduce((s: number, l: any) => s + Number(l.qtyOrdered), 0)
            const totalQtyReceived = po.goodsReceipts.reduce(
                (sum: number, gr: any) => sum + gr.lines.reduce((lsum: number, l: any) => lsum + Number(l.qtyReceived || 0), 0),
                0
            )
            const receivedPercentage = totalQty > 0 ? Math.min(100, Math.round((totalQtyReceived / totalQty) * 100)) : 0

            const shipments: POShipmentSummary[] = po.shipments.map((s: any) => {
                const totalM = s.milestones.length
                const completedM = s.milestones.filter((m: any) => !!m.completedAt).length
                const milestoneProgress = totalM > 0 ? Math.round((completedM / totalM) * 100) : 0
                return {
                    id: s.id,
                    billOfLading: s.billOfLading,
                    vesselName: s.vesselName,
                    voyageNo: s.voyageNo,
                    containerNo: s.containerNo,
                    containerType: s.containerType,
                    eta: s.eta,
                    etd: s.etd,
                    portOfLoading: s.portOfLoading,
                    portOfDischarge: s.portOfDischarge,
                    status: s.status,
                    milestoneProgress,
                }
            })

            return {
                id: po.id,
                poNo: po.poNo,
                legalEntityId: po.legalEntityId,
                legalEntityCode: po.legalEntity?.code ?? null,
                legalEntityName: po.legalEntity?.name ?? null,
                supplierName: po.supplier.name,
                supplierId: po.supplierId,
                supplierCode: po.supplier.code ?? null,
                supplierCountry: po.supplier.country ?? null,
                incoterms: po.incoterms || po.supplier.incoterms || null,
                paymentTerm: po.paymentTerm || po.supplier.paymentTerm || null,
                currency: po.currency,
                exchangeRate: Number(po.exchangeRate),
                status: po.status,
                totalAmount,
                lineCount: po.lines.length,
                totalQty,
                totalQtyReceived,
                receivedPercentage,
                estimatedDelivery: po.estimatedDelivery,
                creatorName: po.creator?.name ?? null,
                docCount: po.documents.length,
                documents: po.documents,
                shipments,
                latestShipment: shipments[0] ?? null,
                createdAt: po.createdAt,
            }
        })

        return { rows, total, statusCounts }
    }) // end cached
}

// ─── Get single PO with lines & approval history ──
export async function getPODetail(id: string): Promise<PODetail | null> {
    const [po, approvalRequest, auditLogs, routeConfig] = await Promise.all([
        prisma.purchaseOrder.findUnique({
            where: { id },
            include: {
                legalEntity: { select: { id: true, code: true, name: true } },
                supplier: { select: { id: true, name: true, code: true, country: true, paymentTerm: true, incoterms: true } },
                creator: { select: { id: true, name: true } },
                lines: {
                    include: {
                        product: { select: { productName: true, skuCode: true } },
                    },
                },
                documents: { orderBy: { uploadedAt: 'desc' } },
                shipments: {
                    select: {
                        id: true,
                        billOfLading: true,
                        vesselName: true,
                        voyageNo: true,
                        containerNo: true,
                        containerType: true,
                        eta: true,
                        etd: true,
                        portOfLoading: true,
                        portOfDischarge: true,
                        status: true,
                        milestones: { select: { completedAt: true } },
                    },
                    orderBy: { createdAt: 'desc' },
                },
                goodsReceipts: {
                    where: { status: 'CONFIRMED' },
                    select: {
                        lines: { select: { qtyReceived: true } },
                    },
                },
            },
        }),
        prisma.approvalRequest.findFirst({
            where: { docType: 'PURCHASE_ORDER', docId: id },
            include: {
                logs: {
                    orderBy: { createdAt: 'desc' },
                    include: { approver: { select: { name: true } } },
                },
            },
            orderBy: { createdAt: 'desc' },
        }).catch(() => null),
        prisma.auditLog.findMany({
            where: { entityType: 'PurchaseOrder', entityId: id },
            orderBy: { createdAt: 'desc' },
            take: 20,
        }).catch(() => []),
        getPORouteConfig(),
    ])

    if (!po) return null

    const lines = po.lines.map((l: any) => ({
        id: l.id,
        productId: l.productId,
        productName: l.product.productName,
        skuCode: l.product.skuCode,
        qtyOrdered: Number(l.qtyOrdered),
        unitPrice: Number(l.unitPrice),
        uom: l.uom,
        lineTotal: Number(l.qtyOrdered) * Number(l.unitPrice),
    }))

    const totalAmount = lines.reduce((s: number, l: any) => s + l.lineTotal, 0)
    const totalQty = lines.reduce((s: number, l: any) => s + l.qtyOrdered, 0)
    const totalQtyReceived = po.goodsReceipts.reduce(
        (sum: number, gr: any) => sum + gr.lines.reduce((lsum: number, l: any) => lsum + Number(l.qtyReceived || 0), 0),
        0
    )
    const receivedPercentage = totalQty > 0 ? Math.min(100, Math.round((totalQtyReceived / totalQty) * 100)) : 0

    const shipments: POShipmentSummary[] = po.shipments.map((s: any) => {
        const totalM = s.milestones.length
        const completedM = s.milestones.filter((m: any) => !!m.completedAt).length
        const milestoneProgress = totalM > 0 ? Math.round((completedM / totalM) * 100) : 0
        return {
            id: s.id,
            billOfLading: s.billOfLading,
            vesselName: s.vesselName,
            voyageNo: s.voyageNo,
            containerNo: s.containerNo,
            containerType: s.containerType,
            eta: s.eta,
            etd: s.etd,
            portOfLoading: s.portOfLoading,
            portOfDischarge: s.portOfDischarge,
            status: s.status,
            milestoneProgress,
        }
    })

    // Combine approvalRequest logs and audit status change logs
    const approvalHistory: POApprovalLog[] = []
    if (approvalRequest && approvalRequest.logs.length > 0) {
        for (const l of approvalRequest.logs) {
            approvalHistory.push({
                id: l.id,
                step: l.step,
                action: l.action,
                actorName: l.approver?.name || 'Cấp Quản Lý',
                comment: l.comment,
                createdAt: l.createdAt,
            })
        }
    } else {
        for (const al of auditLogs) {
            const desc = (al.newValue as any)?.description || (al.newValue as any)?.reason || (al.newValue as any)?.comment || null
            approvalHistory.push({
                id: al.id,
                action: al.action,
                actorName: al.userName || 'System',
                comment: desc,
                createdAt: al.createdAt,
            })
        }
    }

    const currentApprovalStep = approvalRequest?.currentStep || 1
    const totalApprovalSteps = routeConfig.steps.length

    return {
        id: po.id,
        poNo: po.poNo,
        legalEntityId: po.legalEntityId,
        legalEntityCode: po.legalEntity?.code ?? null,
        legalEntityName: po.legalEntity?.name ?? null,
        supplierName: po.supplier.name,
        supplierId: po.supplierId,
        supplierCode: po.supplier.code ?? null,
        supplierCountry: po.supplier.country ?? null,
        incoterms: po.incoterms || po.supplier.incoterms || null,
        paymentTerm: po.paymentTerm || po.supplier.paymentTerm || null,
        currency: po.currency,
        exchangeRate: Number(po.exchangeRate),
        status: po.status,
        currentApprovalStep,
        totalApprovalSteps,
        approvalSteps: routeConfig.steps,
        totalAmount,
        lineCount: lines.length,
        totalQty,
        totalQtyReceived,
        receivedPercentage,
        estimatedDelivery: po.estimatedDelivery,
        creatorName: po.creator?.name ?? null,
        docCount: po.documents.length,
        documents: po.documents,
        shipments,
        latestShipment: shipments[0] ?? null,
        lines,
        approvalHistory,
        createdAt: po.createdAt,
    }
}

// ─── Helper to load PO Route Config ──────────────
async function getPORouteConfig(): Promise<PORouteConfig> {
    try {
        const config = await prisma.approvalConfig.findUnique({
            where: { configKey: 'procurement.purchase_order' }
        })
        if (config?.value && typeof config.value === 'object') {
            const val = config.value as any
            const creatorRoles = Array.isArray(val.creatorRoles) ? val.creatorRoles : DEFAULT_PO_ROUTING.creatorRoles
            const steps = Array.isArray(val.steps) && val.steps.length > 0 ? val.steps : DEFAULT_PO_ROUTING.steps
            return { creatorRoles, steps }
        }
    } catch { /* fallback */ }
    return DEFAULT_PO_ROUTING
}

// ─── Create PO ────────────────────────────────────
export async function createPurchaseOrder(input: CreatePOInput) {
    await requireAuth()
    const data = createPOSchema.parse(input)
    const userId = await getOrCreateSystemUser()

    const supplier = await prisma.supplier.findUnique({
        where: { id: data.supplierId },
        select: { defaultCurrency: true }
    })
    if (!supplier) {
        return { success: false, error: "Không tìm thấy nhà cung cấp" }
    }
    if (supplier.defaultCurrency && supplier.defaultCurrency !== data.currency) {
        return { success: false, error: `Tiền tệ đơn hàng (${data.currency}) không khớp với tiền tệ mặc định của nhà cung cấp (${supplier.defaultCurrency})` }
    }

    const defaultEntity = await prisma.legalEntity.findFirst({
        where: { code: 'TA' },
        select: { id: true },
    })
    if (!defaultEntity) {
        return { success: false, error: "Không tìm thấy pháp nhân mặc định Thắng Ân (TA)" }
    }
    const legalEntityId = defaultEntity.id

    // Generate PO number: PO-YYMM-NNNN (concurrency-safe transaction)
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const prefix = `PO-${yy}${mm}-`

    const po = await prisma.$transaction(async (tx) => {
        // Lock matching POs for this month to serialize concurrent creations
        await tx.$executeRaw`SELECT id FROM purchase_orders WHERE "poNo" LIKE ${prefix + '%'} FOR UPDATE`

        const lastPO = await tx.purchaseOrder.findFirst({
            where: { poNo: { startsWith: prefix } },
            orderBy: { poNo: 'desc' },
            select: { poNo: true },
        })
        const nextSeq = lastPO ? parseInt(lastPO.poNo.slice(-4)) + 1 : 1
        const poNo = `${prefix}${String(nextSeq).padStart(4, '0')}`

        return await tx.purchaseOrder.create({
            data: {
                poNo,
                supplierId: data.supplierId,
                currency: data.currency,
                exchangeRate: data.exchangeRate,
                status: 'DRAFT',
                createdBy: userId,
                legalEntityId,
                lines: {
                    create: data.lines.map(l => ({
                        productId: l.productId,
                        qtyOrdered: l.qtyOrdered,
                        unitPrice: l.unitPrice,
                        uom: l.uom,
                    })),
                },
            },
        })
    })

    revalidateCache('procurement')
    revalidatePath('/dashboard/procurement')
    return { success: true, id: po.id, poNo: po.poNo }
}

// ─── PO Approval Workflow Actions ─────────────────

// 1. Submit PO for Approval
export async function submitPOForApproval(id: string) {
    const user = await requireAuth()
    const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { lines: true, supplier: { select: { name: true } } }
    })
    if (!po) return { success: false, error: 'PO không tồn tại' }
    if (po.status !== 'DRAFT') {
        return { success: false, error: `Chỉ có thể gửi duyệt PO đang ở trạng thái Nháp (DRAFT)` }
    }

    const routeConfig = await getPORouteConfig()
    const firstStep = routeConfig.steps[0] ?? { level: 1, role: 'THU_MUA', label: 'Trưởng Phòng Mua Hàng' }
    const totalVND = po.lines.reduce((s, l) => s + Number(l.qtyOrdered) * Number(l.unitPrice) * Number(po.exchangeRate), 0)

    // Create or update ApprovalRequest
    let req = await prisma.approvalRequest.findFirst({
        where: { docType: 'PURCHASE_ORDER', docId: id }
    })

    if (req) {
        await prisma.approvalRequest.update({
            where: { id: req.id },
            data: { currentStep: firstStep.level, status: 'PENDING', requestedBy: user.id }
        })
    } else {
        let template = await prisma.approvalTemplate.findFirst({
            where: { docType: 'PURCHASE_ORDER' }
        })
        if (!template) {
            template = await prisma.approvalTemplate.create({
                data: {
                    name: 'Quy Trình Phê Duyệt PO',
                    docType: 'PURCHASE_ORDER',
                    steps: {
                        create: routeConfig.steps.map(s => ({
                            stepOrder: s.level,
                            approverRole: s.role,
                            name: s.label || `Cấp ${s.level}`
                        }))
                    }
                }
            })
        }

        req = await prisma.approvalRequest.create({
            data: {
                templateId: template.id,
                docType: 'PURCHASE_ORDER',
                docId: id,
                currentStep: firstStep.level,
                status: 'PENDING',
                requestedBy: user.id
            }
        })
    }

    await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'PENDING_APPROVAL' },
    })

    try {
        const { logAudit } = await import('@/lib/audit')
        await logAudit({
            action: 'STATUS_CHANGE',
            entityType: 'PurchaseOrder',
            entityId: id,
            description: `Gửi phê duyệt đơn mua hàng ${po.poNo} (Cấp 1: ${firstStep.label || firstStep.role})`,
            newValue: { status: 'PENDING_APPROVAL', step: firstStep.level, role: firstStep.role },
        })
    } catch { /* silent */ }

    // Send In-App Notification to first step role
    try {
        const { triggerNotificationForRole } = await import('@/lib/notifications')
        await triggerNotificationForRole(firstStep.role, {
            title: `Đơn mua hàng ${po.poNo} chờ phê duyệt (Cấp 1)`,
            content: `PO ${po.poNo} từ NCC ${po.supplier.name} (Trị giá ≈ ${formatVND(totalVND)}) đang chờ bạn phê duyệt ở Cấp 1 (${firstStep.label || firstStep.role}).`,
            type: 'info',
            link: `/dashboard/procurement?id=${po.id}`
        })
    } catch (notiErr) {
        console.error('[PO Approval] Notification error:', notiErr)
    }

    revalidateCache('procurement')
    revalidatePath('/dashboard/procurement')
    return { success: true }
}

// 2. Approve PO (Phê Duyệt Đơn Hàng Theo Cấp)
export async function approvePO(id: string, comment?: string) {
    const user = await requireAuth()
    const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { lines: true, supplier: { select: { name: true } } }
    })
    if (!po) return { success: false, error: 'PO không tồn tại' }
    if (po.status !== 'PENDING_APPROVAL') {
        return { success: false, error: 'Chỉ có thể phê duyệt PO đang ở trạng thái Chờ duyệt (PENDING_APPROVAL)' }
    }

    const routeConfig = await getPORouteConfig()
    const req = await prisma.approvalRequest.findFirst({
        where: { docType: 'PURCHASE_ORDER', docId: id, status: 'PENDING' },
    })

    const currentStepLevel = req ? req.currentStep : 1
    const currentIdx = routeConfig.steps.findIndex(s => s.level === currentStepLevel)
    const nextStep = (currentIdx >= 0 && currentIdx < routeConfig.steps.length - 1) ? routeConfig.steps[currentIdx + 1] : null
    const totalVND = po.lines.reduce((s, l) => s + Number(l.qtyOrdered) * Number(l.unitPrice) * Number(po.exchangeRate), 0)

    if (req) {
        await prisma.approvalLog.create({
            data: {
                requestId: req.id,
                step: currentStepLevel,
                action: 'APPROVE',
                approvedBy: user.id,
                comment: comment || `Đã phê duyệt Cấp ${currentStepLevel}`,
            }
        })
    }

    if (nextStep) {
        // Move to next step
        if (req) {
            await prisma.approvalRequest.update({
                where: { id: req.id },
                data: { currentStep: nextStep.level }
            })
        }

        try {
            const { logAudit } = await import('@/lib/audit')
            await logAudit({
                action: 'APPROVE',
                entityType: 'PurchaseOrder',
                entityId: id,
                description: `Phê duyệt Cấp ${currentStepLevel}. Chuyển lên Cấp ${nextStep.level} (${nextStep.label || nextStep.role})`,
                newValue: { step: nextStep.level, approver: user.name, comment }
            })
        } catch { /* silent */ }

        // Send Notification to Next Step Role
        try {
            const { triggerNotificationForRole } = await import('@/lib/notifications')
            await triggerNotificationForRole(nextStep.role, {
                title: `Đơn mua hàng ${po.poNo} chờ phê duyệt (Cấp ${nextStep.level})`,
                content: `Cấp ${currentStepLevel} đã duyệt. Đơn PO ${po.poNo} (Trị giá ≈ ${formatVND(totalVND)}) đang chờ bạn phê duyệt ở Cấp ${nextStep.level} (${nextStep.label || nextStep.role}).`,
                type: 'info',
                link: `/dashboard/procurement?id=${po.id}`
            })
        } catch (notiErr) {
            console.error('[PO Approval] Noti error:', notiErr)
        }

    } else {
        // Final approval step completed!
        if (req) {
            await prisma.approvalRequest.update({
                where: { id: req.id },
                data: { status: 'APPROVED' }
            })
        }

        await prisma.purchaseOrder.update({
            where: { id },
            data: { status: 'APPROVED' },
        })

        try {
            const { logAudit } = await import('@/lib/audit')
            await logAudit({
                action: 'APPROVE',
                entityType: 'PurchaseOrder',
                entityId: id,
                description: `Phê duyệt hoàn tất PO ${po.poNo}${comment ? `: ${comment}` : ''}`,
                newValue: { status: 'APPROVED', comment },
            })
        } catch { /* silent */ }

        // Send Success Notification to Creator
        try {
            const { createNotification } = await import('@/lib/notifications')
            await createNotification({
                userId: po.createdBy,
                title: `Đơn mua hàng ${po.poNo} đã được Phê Duyệt hoàn tất!`,
                content: `Đơn hàng ${po.poNo} từ NCC ${po.supplier.name} đã được duyệt đầy đủ qua tất cả các cấp. Bạn có thể khởi tạo Lô Vận Tải hoặc Nhập Kho.`,
                type: 'success',
                link: `/dashboard/procurement?id=${po.id}`
            })
        } catch (notiErr) {
            console.error('[PO Approval] Creator noti error:', notiErr)
        }
    }

    revalidateCache('procurement')
    revalidatePath('/dashboard/procurement')
    return { success: true }
}

// 3. Reject PO (Từ Chối Phê Duyệt PO)
export async function rejectPO(id: string, reason: string) {
    const user = await requireAuth()
    if (!reason || !reason.trim()) {
        return { success: false, error: 'Vui lòng nhập lý do từ chối phê duyệt' }
    }

    const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: { supplier: { select: { name: true } } }
    })
    if (!po) return { success: false, error: 'PO không tồn tại' }
    if (po.status !== 'PENDING_APPROVAL') {
        return { success: false, error: 'Chỉ có thể từ chối PO đang ở trạng thái Chờ duyệt' }
    }

    const req = await prisma.approvalRequest.findFirst({
        where: { docType: 'PURCHASE_ORDER', docId: id, status: 'PENDING' },
    })

    if (req) {
        await prisma.approvalLog.create({
            data: {
                requestId: req.id,
                step: req.currentStep,
                action: 'REJECT',
                approvedBy: user.id,
                comment: reason,
            }
        })
        await prisma.approvalRequest.update({
            where: { id: req.id },
            data: { status: 'REJECTED' },
        })
    }

    // Revert PO back to DRAFT so purchaser can make edits
    await prisma.purchaseOrder.update({
        where: { id },
        data: { status: 'DRAFT' },
    })

    try {
        const { logAudit } = await import('@/lib/audit')
        await logAudit({
            action: 'REJECT',
            entityType: 'PurchaseOrder',
            entityId: id,
            description: `Từ chối PO ${po.poNo}. Lý do: ${reason}`,
            newValue: { status: 'DRAFT', reason },
        })
    } catch { /* silent */ }

    // Send Warning Notification to Creator
    try {
        const { createNotification } = await import('@/lib/notifications')
        await createNotification({
            userId: po.createdBy,
            title: `Đơn mua hàng ${po.poNo} bị Từ Chối phê duyệt`,
            content: `Đơn hàng ${po.poNo} đã bị từ chối duyệt. Lý do: "${reason}". Vui lòng điều chỉnh lại đơn hàng.`,
            type: 'warning',
            link: `/dashboard/procurement?id=${po.id}`
        })
    } catch (notiErr) {
        console.error('[PO Approval] Creator noti error:', notiErr)
    }

    revalidateCache('procurement')
    revalidatePath('/dashboard/procurement')
    return { success: true }
}

// ─── Update PO status (with validation + audit) ───
export async function updatePOStatus(id: string, status: string) {
    await requireAuth()
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
        DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
        PENDING_APPROVAL: ['APPROVED', 'CANCELLED', 'DRAFT'],
        APPROVED: ['IN_TRANSIT', 'CANCELLED'],
        IN_TRANSIT: ['PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'],
        PARTIALLY_RECEIVED: ['RECEIVED', 'CANCELLED'],
    }

    const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        select: { status: true, poNo: true },
    })
    if (!po) return { success: false, error: 'PO không tồn tại' }

    const allowed = ALLOWED_TRANSITIONS[po.status]
    if (!allowed || !allowed.includes(status)) {
        return { success: false, error: `Không thể chuyển PO từ ${po.status} → ${status}` }
    }

    await prisma.purchaseOrder.update({
        where: { id },
        data: { status: status as any },
    })

    try {
        const { logAudit } = await import('@/lib/audit')
        await logAudit({
            action: 'STATUS_CHANGE',
            entityType: 'PurchaseOrder',
            entityId: id,
            description: `PO ${po.poNo}: ${po.status} → ${status}`,
            newValue: { from: po.status, to: status },
        })
    } catch { /* silent */ }

    revalidateCache('procurement')
    revalidatePath('/dashboard/procurement')
    return { success: true }
}

// ─── Stats for dashboard ──────────────────────────
export async function getPOStats() {
    return cached('procurement:stats', async () => {
        const [total, draft, approved, inTransit] = await Promise.all([
            prisma.purchaseOrder.count(),
            prisma.purchaseOrder.count({ where: { status: 'DRAFT' } }),
            prisma.purchaseOrder.count({ where: { status: 'APPROVED' } }),
            prisma.purchaseOrder.count({ where: { status: 'IN_TRANSIT' } }),
        ])
        return { total, draft, approved, inTransit }
    }) // end cached
}

// ─── Upload Documents ──────────────────────────────
import { uploadFile } from '@/lib/storage'

export async function uploadPODocument(poId: string, formData: FormData) {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: 'Chưa chọn file PO' }

        const uploadRes = await uploadFile(formData, 'po')
        if (!uploadRes.success || !uploadRes.url) {
            return { success: false, error: uploadRes.error ?? 'Upload failed' }
        }

        const doc = await prisma.pODocument.create({
            data: {
                poId,
                name: file.name,
                fileUrl: uploadRes.url,
            }
        })

        revalidateCache('procurement')
        revalidatePath('/dashboard/procurement')
        return { success: true, document: doc }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── PO Variance Report (PO vs Actual Received) ────
export async function getPOVarianceReport(filters: {
    supplierId?: string
    dateFrom?: string
    dateTo?: string
} = {}) {
    const where: any = { status: { in: ['RECEIVED', 'PARTIALLY_RECEIVED'] } }
    if (filters.supplierId) where.supplierId = filters.supplierId
    if (filters.dateFrom || filters.dateTo) {
        where.createdAt = {}
        if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom)
        if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo)
    }

    const pos = await prisma.purchaseOrder.findMany({
        where,
        include: {
            supplier: { select: { name: true } },
            lines: {
                include: {
                    product: { select: { skuCode: true, productName: true } },
                },
            },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
    })

    // Get goods receipts for these POs
    const poIds = pos.map(p => p.id)
    const grs = await prisma.goodsReceipt.findMany({
        where: { poId: { in: poIds }, status: 'CONFIRMED' },
        include: {
            lines: { select: { productId: true, qtyReceived: true } },
        },
    })

    // Aggregate actual received qty per PO×product
    const actualMap = new Map<string, number>()
    for (const gr of grs) {
        for (const line of gr.lines) {
            const key = `${gr.poId}::${line.productId}`
            actualMap.set(key, (actualMap.get(key) ?? 0) + Number(line.qtyReceived))
        }
    }

    const rows = []
    let totalOrdered = 0
    let totalReceived = 0

    for (const po of pos) {
        for (const line of po.lines) {
            const key = `${po.id}::${line.productId}`
            const ordered = Number(line.qtyOrdered)
            const received = actualMap.get(key) ?? 0
            const variance = received - ordered
            const variancePct = ordered > 0 ? ((variance / ordered) * 100) : 0

            totalOrdered += ordered
            totalReceived += received

            rows.push({
                poNo: po.poNo,
                supplierName: po.supplier.name,
                skuCode: line.product.skuCode,
                productName: line.product.productName,
                ordered,
                received,
                variance,
                variancePct: Math.round(variancePct * 10) / 10,
                unitPrice: Number(line.unitPrice),
                valueDiff: Math.round(variance * Number(line.unitPrice) * 100) / 100,
            })
        }
    }

    return {
        rows,
        summary: {
            totalOrdered,
            totalReceived,
            overallVariance: totalReceived - totalOrdered,
            overallVariancePct: totalOrdered > 0 ? Math.round(((totalReceived - totalOrdered) / totalOrdered) * 1000) / 10 : 0,
            poCount: pos.length,
        },
    }
}

// ─── PO Tax Engine: CIF → NK → TTĐB → VAT ────────
export async function calculatePOTax(poId: string) {
    const po = await prisma.purchaseOrder.findUnique({
        where: { id: poId },
        include: {
            supplier: { select: { country: true } },
            lines: {
                include: {
                    product: { select: { hsCode: true, country: true, abvPercent: true, skuCode: true, productName: true } },
                },
            },
        },
    })
    if (!po) return null

    // Get applicable tax rates
    const taxRates = await prisma.taxRate.findMany({
        where: { effectiveDate: { lte: new Date() } },
        orderBy: { effectiveDate: 'desc' },
    })

    const lines = po.lines.map(line => {
        const hsCode = line.product.hsCode ?? ''
        const country = line.product.country ?? po.supplier.country ?? ''

        const rate = findHierarchicalTaxRate(taxRates, hsCode, country)

        const qty = Number(line.qtyOrdered)
        const cifValue = qty * Number(line.unitPrice) * Number(po.exchangeRate)

        const importTaxRate = rate ? Number(rate.importTaxRate) / 100 : 0
        const sctRate = rate ? Number(rate.sctRate) / 100 : 0.35
        const vatRate = rate ? Number(rate.vatRate) / 100 : 0.10

        const importDuty = cifValue * importTaxRate
        const sctBase = cifValue + importDuty
        const sct = sctBase * sctRate
        const vatBase = sctBase + sct
        const vat = vatBase * vatRate

        return {
            skuCode: line.product.skuCode,
            productName: line.product.productName,
            qty,
            unitPrice: Number(line.unitPrice),
            cifValue: Math.round(cifValue),
            importTaxRate: importTaxRate * 100,
            importDuty: Math.round(importDuty),
            sctRate: sctRate * 100,
            sct: Math.round(sct),
            vatRate: vatRate * 100,
            vat: Math.round(vat),
            totalTax: Math.round(importDuty + sct + vat),
            landedPerUnit: Math.round((cifValue + importDuty + sct) / qty),
        }
    })

    return {
        poNo: po.poNo,
        exchangeRate: Number(po.exchangeRate),
        currency: po.currency,
        lines,
        totals: {
            cifValue: lines.reduce((s, l) => s + l.cifValue, 0),
            importDuty: lines.reduce((s, l) => s + l.importDuty, 0),
            sct: lines.reduce((s, l) => s + l.sct, 0),
            vat: lines.reduce((s, l) => s + l.vat, 0),
            totalTax: lines.reduce((s, l) => s + l.totalTax, 0),
        },
    }
}

// ─── Import PO from parsed Excel data ─────────────
export async function importPOFromExcel(data: {
    supplierId: string
    currency: string
    exchangeRate: number
    contractId?: string
    lines: { productId: string; qtyOrdered: number; unitPrice: number }[]
}): Promise<{ success: boolean; poId?: string; error?: string }> {
    try {
        if (!data.lines.length) return { success: false, error: 'Không có dòng sản phẩm' }

        const supplier = await prisma.supplier.findUnique({ where: { id: data.supplierId } })
        if (!supplier) return { success: false, error: 'Nhà cung cấp không tồn tại' }
        if (supplier.defaultCurrency && supplier.defaultCurrency !== data.currency) {
            return { success: false, error: `Tiền tệ nhập vào (${data.currency}) không khớp với tiền tệ mặc định của nhà cung cấp (${supplier.defaultCurrency})` }
        }

        // Validate contract if provided
        if (data.contractId) {
            const contract = await prisma.contract.findUnique({ where: { id: data.contractId } })
            if (!contract) return { success: false, error: 'Hợp đồng không tồn tại' }
            if (contract.status !== 'ACTIVE') return { success: false, error: 'Hợp đồng không active' }
        }

        const userId = await getOrCreateSystemUser()
        const defaultEntity = await prisma.legalEntity.findFirst({
            where: { code: 'TA' },
            select: { id: true },
        })
        if (!defaultEntity) {
            return { success: false, error: "Không tìm thấy pháp nhân mặc định Thắng Ân (TA)" }
        }
        const legalEntityId = defaultEntity.id

        const count = await prisma.purchaseOrder.count()
        const poNo = `PO-${String(count + 1).padStart(6, '0')}`

        const po = await prisma.purchaseOrder.create({
            data: {
                poNo,
                supplierId: data.supplierId,
                contractId: data.contractId ?? null,
                currency: data.currency,
                exchangeRate: data.exchangeRate,
                status: 'DRAFT',
                createdBy: userId,
                legalEntityId,
                lines: {
                    create: data.lines.map(l => ({
                        productId: l.productId,
                        qtyOrdered: l.qtyOrdered,
                        unitPrice: l.unitPrice,
                    })),
                },
            },
        })

        revalidateCache('procurement')
        revalidatePath('/dashboard/procurement')
        return { success: true, poId: po.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// MULTI-CURRENCY VND CONVERSION
// ═══════════════════════════════════════════════════

// Convert a specific PO to VND breakdown
export async function convertPOToVND(poId: string): Promise<{ success: boolean; data?: POCurrencyBreakdown; error?: string }> {
    try {
        const po = await prisma.purchaseOrder.findUnique({
            where: { id: poId },
            include: {
                supplier: { select: { name: true } },
                lines: {
                    include: { product: { select: { skuCode: true, productName: true } } },
                },
            },
        })
        if (!po) return { success: false, error: 'PO không tồn tại' }

        const rate = Number(po.exchangeRate)
        const lines = po.lines.map(l => {
            const qty = Number(l.qtyOrdered)
            const unitPriceForeign = Number(l.unitPrice)
            return {
                skuCode: l.product.skuCode,
                productName: l.product.productName,
                qty,
                unitPriceForeign,
                unitPriceVND: Math.round(unitPriceForeign * rate),
                lineTotalForeign: qty * unitPriceForeign,
                lineTotalVND: Math.round(qty * unitPriceForeign * rate),
            }
        })

        return {
            success: true,
            data: {
                poId: po.id,
                poNo: po.poNo,
                currency: po.currency,
                exchangeRate: rate,
                totalForeign: lines.reduce((s, l) => s + l.lineTotalForeign, 0),
                totalVND: lines.reduce((s, l) => s + l.lineTotalVND, 0),
                lines,
            },
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Exchange Rate Summary across all POs
export async function getExchangeRateSummary(): Promise<{
    currencies: { currency: string; avgRate: number; minRate: number; maxRate: number; poCount: number; totalForeignValue: number; totalVNDValue: number }[]
}> {
    const result = await cached('procurement:fx-summary', async () => {
        const pos = await prisma.purchaseOrder.findMany({
            where: { status: { not: 'CANCELLED' } },
            select: {
                currency: true,
                exchangeRate: true,
                lines: { select: { qtyOrdered: true, unitPrice: true } },
            },
        })

        const map = new Map<string, { rates: number[]; totalForeign: number; count: number }>()
        for (const po of pos) {
            const rate = Number(po.exchangeRate)
            const totalFg = po.lines.reduce((s, l) => s + Number(l.qtyOrdered) * Number(l.unitPrice), 0)
            const entry = map.get(po.currency) ?? { rates: [], totalForeign: 0, count: 0 }
            entry.rates.push(rate)
            entry.totalForeign += totalFg
            entry.count++
            map.set(po.currency, entry)
        }

        const currencies = Array.from(map.entries()).map(([currency, data]) => ({
            currency,
            avgRate: Math.round(data.rates.reduce((a, b) => a + b, 0) / data.rates.length),
            minRate: Math.min(...data.rates),
            maxRate: Math.max(...data.rates),
            poCount: data.count,
            totalForeignValue: Math.round(data.totalForeign * 100) / 100,
            totalVNDValue: Math.round(data.totalForeign * (data.rates.reduce((a, b) => a + b, 0) / data.rates.length)),
        }))

        return { currencies }
    }, 120_000) // 2 min cache
    // Strip Prisma Decimal objects for Next.js client serialization
    return JSON.parse(JSON.stringify(result))
}

// ─── Legal Entities for Filter ────────────────────
export async function getLegalEntitiesForProcurement(): Promise<{ id: string; code: string; name: string }[]> {
    const entities = await prisma.legalEntity.findMany({
        select: { id: true, code: true, name: true },
        orderBy: { code: 'asc' },
    })
    return entities
}

// ─── Export Purchase Orders Excel ─────────────────
export async function exportPurchaseOrdersExcel(filters: {
    status?: string
    search?: string
    legalEntityId?: string
    currency?: string
    incoterms?: string
    dateFrom?: string
    dateTo?: string
} = {}): Promise<{ base64: string; filename: string }> {
    await requireAuth()
    const { status, search, legalEntityId, currency, incoterms, dateFrom, dateTo } = filters
    const where: any = {}
    if (status) where.status = status
    if (legalEntityId) where.legalEntityId = legalEntityId
    if (currency) where.currency = currency
    if (incoterms) where.incoterms = incoterms
    if (dateFrom || dateTo) {
        where.createdAt = {}
        if (dateFrom) where.createdAt.gte = new Date(dateFrom)
        if (dateTo) where.createdAt.lte = new Date(dateTo + 'T23:59:59.999Z')
    }
    if (search) {
        where.OR = [
            { poNo: { contains: search, mode: 'insensitive' } },
            { supplier: { name: { contains: search, mode: 'insensitive' } } },
        ]
    }

    const pos = await prisma.purchaseOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            supplier: { select: { name: true, code: true, country: true } },
            legalEntity: { select: { code: true, name: true } },
            shipments: { select: { billOfLading: true, vesselName: true, containerNo: true, status: true } },
            lines: {
                include: {
                    product: { select: { skuCode: true, productName: true } }
                }
            }
        },
        take: 5000,
    })

    const XLSX = await import('xlsx')
    
    // Sheet 1: Chi Tiết Từng Dòng Sản Phẩm PO
    const lineItemData: any[] = []
    for (const p of pos) {
        const rate = Number(p.exchangeRate)
        for (const l of p.lines) {
            const qty = Number(l.qtyOrdered)
            const price = Number(l.unitPrice)
            const lineTotal = qty * price
            lineItemData.push({
                'Số PO': p.poNo,
                'Ngày Lập': p.createdAt.toISOString().split('T')[0],
                'Trạng Thái': p.status,
                'Nhà Cung Cấp': p.supplier.name,
                'Quốc Gia': p.supplier.country || '',
                'Pháp Nhân': p.legalEntity?.code || '',
                'Incoterms': p.incoterms || 'EXW',
                'Mã SKU': l.product.skuCode,
                'Tên Sản Phẩm': l.product.productName,
                'Số Lượng (Chai)': qty,
                'Đơn Giá Ngoại Tệ': price,
                'Tiền Tệ': p.currency,
                'Thành Tiền Ngoại Tệ': lineTotal,
                'Tỷ Giá VNĐ': rate,
                'Thành Tiền VNĐ': Math.round(lineTotal * rate),
                'Vận Đơn B/L': p.shipments[0]?.billOfLading || '',
                'Tên Tàu': p.shipments[0]?.vesselName || '',
                'Số Container': p.shipments[0]?.containerNo || '',
            })
        }
    }

    // Sheet 2: Tổng Hợp Đơn Mua Hàng
    const summaryData = pos.map(p => {
        const rate = Number(p.exchangeRate)
        const totalForeign = p.lines.reduce((s, l) => s + Number(l.qtyOrdered) * Number(l.unitPrice), 0)
        return {
            'Số PO': p.poNo,
            'Ngày Lập': p.createdAt.toISOString().split('T')[0],
            'Trạng Thái': p.status,
            'Nhà Cung Cấp': p.supplier.name,
            'Pháp Nhân': p.legalEntity?.code || '',
            'Incoterms': p.incoterms || 'EXW',
            'Tiền Tệ': p.currency,
            'Tỷ Giá VNĐ': rate,
            'Số SKU': p.lines.length,
            'Tổng Số Chai': p.lines.reduce((s, l) => s + Number(l.qtyOrdered), 0),
            'Tổng Ngoại Tệ': totalForeign,
            'Tổng Giá Trị VNĐ': Math.round(totalForeign * rate),
            'Vận Đơn B/L': p.shipments.map(s => s.billOfLading).join(', ') || '',
        }
    })

    const wb = XLSX.utils.book_new()
    const wsLine = XLSX.utils.json_to_sheet(lineItemData)
    const wsSum = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, wsLine, 'Chi Tiết Dòng Hàng PO')
    XLSX.utils.book_append_sheet(wb, wsSum, 'Tổng Hợp PO')

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = `PurchaseOrders_Export_${new Date().toISOString().split('T')[0]}.xlsx`
    return { base64: buffer.toString('base64'), filename }
}
