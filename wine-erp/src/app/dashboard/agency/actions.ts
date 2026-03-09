'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { serialize } from '@/lib/serialize'
import { cached, revalidateCache } from '@/lib/cache'

// ═══════════════════════════════════════════════════
// AGENCY PORTAL — External Partner Integration
// ═══════════════════════════════════════════════════

// ─── Types ────────────────────────────────────────
export type AgencyPartnerRow = {
    id: string
    code: string
    name: string
    type: string
    email: string
    status: string
    submissionCount: number
    pendingCount: number
}

export type AgencySubmissionRow = {
    id: string
    partnerName: string
    partnerType: string
    shipmentBol: string | null
    shipmentStatus: string | null
    vesselName: string | null
    shipmentEta: Date | null
    declarationNo: string | null
    status: string
    notes: string | null
    additionalCosts: number | null
    submittedAt: Date
    reviewedAt: Date | null
    documentCount: number
}

export type AgencyDashboardStats = {
    totalPartners: number
    pendingSubmissions: number
    approvedThisMonth: number
    activeShipments: number
}

// ─── Dashboard Stats ──────────────────────────────
export async function getAgencyDashboardStats(): Promise<AgencyDashboardStats> {
    return cached('agency:stats', async () => {
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

        const [totalPartners, pendingSubmissions, approvedThisMonth, activeShipments] = await Promise.all([
            prisma.externalPartner.count(),
            prisma.agencySubmission.count({ where: { status: 'PENDING_REVIEW' } }),
            prisma.agencySubmission.count({
                where: { status: 'APPROVED', reviewedAt: { gte: startOfMonth } },
            }),
            prisma.shipment.count({
                where: { status: { in: ['BOOKED', 'ON_VESSEL', 'ARRIVED_PORT'] } },
            }),
        ])

        return { totalPartners, pendingSubmissions, approvedThisMonth, activeShipments }
    }, 30_000) // 30s cache
}

// ─── List Partners ────────────────────────────────
export async function getAgencyPartners(): Promise<AgencyPartnerRow[]> {
    return cached('agency:partners', async () => {
        const partners = await prisma.externalPartner.findMany({
            include: {
                submissions: { select: { id: true, status: true } },
            },
            orderBy: { name: 'asc' },
        })

        return partners.map(p => ({
            id: p.id,
            code: p.code,
            name: p.name,
            type: p.type,
            email: p.email,
            status: p.status,
            submissionCount: p.submissions.length,
            pendingCount: p.submissions.filter(s => s.status === 'PENDING_REVIEW').length,
        }))
    }, 30_000) // 30s cache
}

// ─── Create Partner ───────────────────────────────
export async function createAgencyPartner(input: {
    code: string
    name: string
    type: 'CUSTOMS_BROKER' | 'FORWARDER' | 'SURVEYOR'
    email: string
    passwordHash: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const partner = await prisma.externalPartner.create({
            data: {
                code: input.code,
                name: input.name,
                type: input.type,
                email: input.email,
                passwordHash: input.passwordHash,
            },
        })
        revalidatePath('/dashboard/agency')
        return { success: true, id: partner.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── List Submissions ─────────────────────────────
export async function getAgencySubmissions(filters: {
    status?: string
    partnerId?: string
    shipmentId?: string
} = {}): Promise<AgencySubmissionRow[]> {
    const where: any = {}
    if (filters.status) where.status = filters.status
    if (filters.partnerId) where.partnerId = filters.partnerId
    if (filters.shipmentId) where.shipmentId = filters.shipmentId

    const submissions = await prisma.agencySubmission.findMany({
        where,
        include: {
            partner: { select: { name: true, type: true } },
            shipment: { select: { billOfLading: true, status: true, vesselName: true, eta: true } },
            documents: { select: { id: true } },
        },
        orderBy: { submittedAt: 'desc' },
        take: 100,
    })

    return submissions.map(s => ({
        id: s.id,
        partnerName: s.partner.name,
        partnerType: s.partner.type,
        shipmentBol: s.shipment?.billOfLading ?? null,
        shipmentStatus: s.shipment?.status ?? null,
        vesselName: s.shipment?.vesselName ?? null,
        shipmentEta: s.shipment?.eta ?? null,
        declarationNo: s.declarationNo,
        status: s.status,
        notes: s.notes,
        additionalCosts: s.additionalCosts ? Number(s.additionalCosts) : null,
        submittedAt: s.submittedAt,
        reviewedAt: s.reviewedAt,
        documentCount: s.documents.length,
    }))
}

// ─── Create Submission ────────────────────────────
export async function createAgencySubmission(input: {
    partnerId: string
    shipmentId: string
    declarationNo?: string
    eta?: string
    additionalCosts?: number
    notes?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const sub = await prisma.agencySubmission.create({
            data: {
                partnerId: input.partnerId,
                shipmentId: input.shipmentId,
                declarationNo: input.declarationNo ?? null,
                eta: input.eta ? new Date(input.eta) : null,
                additionalCosts: input.additionalCosts ?? null,
                notes: input.notes ?? null,
                status: 'PENDING_REVIEW',
            },
        })
        revalidatePath('/dashboard/agency')
        return { success: true, id: sub.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Review Submission ────────────────────────────
export async function reviewAgencySubmission(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    reviewedBy: string,
    notes?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.agencySubmission.update({
            where: { id },
            data: {
                status: decision,
                reviewedBy,
                reviewedAt: new Date(),
                ...(notes !== undefined && { notes }),
            },
        })
        revalidatePath('/dashboard/agency')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Get active shipments for dropdown ────────────
export async function getActiveShipments() {
    const raw = await prisma.shipment.findMany({
        where: { status: { in: ['BOOKED', 'ON_VESSEL', 'ARRIVED_PORT'] } },
        select: {
            id: true,
            billOfLading: true,
            vesselName: true,
            eta: true,
            status: true,
        },
        orderBy: { eta: 'asc' },
    })
    return serialize(raw)
}

// ═══════════════════════════════════════════════════
// PARTNER AUTHENTICATION & PORTAL
// ═══════════════════════════════════════════════════

export async function authenticatePartner(
    email: string,
    password: string
): Promise<{ success: boolean; partner?: { id: string; name: string; type: string; code: string }; error?: string }> {
    try {
        const partner = await prisma.externalPartner.findUnique({
            where: { email },
            select: { id: true, name: true, type: true, code: true, email: true, passwordHash: true, status: true },
        })

        if (!partner) return { success: false, error: 'Email không tồn tại trong hệ thống' }
        if (partner.status !== 'ACTIVE') return { success: false, error: 'Tài khoản đã bị vô hiệu hóa' }

        // Simple comparison — passwordHash is stored as-is in this codebase
        const valid = partner.passwordHash === password
        if (!valid) return { success: false, error: 'Mật khẩu không đúng' }

        return {
            success: true,
            partner: { id: partner.id, name: partner.name, type: partner.type, code: partner.code },
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export type PartnerShipmentView = {
    id: string
    billOfLading: string
    vesselName: string | null
    eta: Date | null
    status: string
    submissionCount: number
}

export async function getPartnerPortalData(partnerId: string): Promise<{
    shipments: PartnerShipmentView[]
    submissions: AgencySubmissionRow[]
}> {
    // Get shipments assigned to this partner
    const accesses = await prisma.partnerShipmentAccess.findMany({
        where: { partnerId },
        select: { shipmentId: true },
    })

    const shipmentIds = accesses.map(a => a.shipmentId)
    const shipments = await prisma.shipment.findMany({
        where: { id: { in: shipmentIds } },
        include: {
            agencySubmissions: { where: { partnerId }, select: { id: true } },
        },
        orderBy: { eta: 'desc' },
    })

    const formattedShipments: PartnerShipmentView[] = shipments.map(s => ({
        id: s.id,
        billOfLading: s.billOfLading,
        vesselName: s.vesselName,
        eta: s.eta,
        status: s.status,
        submissionCount: s.agencySubmissions.length,
    }))

    // Get partner's submissions
    const submissions = await getAgencySubmissions({ partnerId })

    return { shipments: formattedShipments, submissions }
}

// ═══════════════════════════════════════════════════
// DOCUMENT UPLOAD & MANAGEMENT
// ═══════════════════════════════════════════════════

import { uploadFile } from '@/lib/storage'

const DOC_TYPE_LABEL: Record<string, string> = {
    CUSTOMS_DECLARATION: 'Tờ Khai HQ',
    LOGISTICS_INVOICE: 'Invoice Logistics',
    INSPECTION_CERT: 'Chứng Nhận Giám Định',
    OTHER: 'Khác',
}

export type AgencyDocumentRow = {
    id: string
    type: string
    typeLabel: string
    fileUrl: string
    uploadedAt: Date
}

export async function uploadAgencyDocument(
    submissionId: string,
    formData: FormData,
    docType: string = 'OTHER'
): Promise<{ success: boolean; error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: 'Chưa chọn file' }

        const uploadRes = await uploadFile(formData, 'agency-documents')
        if (!uploadRes.success || !uploadRes.url) {
            return { success: false, error: uploadRes.error ?? 'Upload thất bại' }
        }

        await prisma.agencyDocument.create({
            data: {
                submissionId,
                type: docType as any,
                fileUrl: uploadRes.url,
            },
        })

        revalidatePath('/dashboard/agency')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getSubmissionDocuments(submissionId: string): Promise<AgencyDocumentRow[]> {
    const docs = await prisma.agencyDocument.findMany({
        where: { submissionId },
        orderBy: { uploadedAt: 'desc' },
    })

    return docs.map(d => ({
        id: d.id,
        type: d.type,
        typeLabel: DOC_TYPE_LABEL[d.type] ?? d.type,
        fileUrl: d.fileUrl,
        uploadedAt: d.uploadedAt,
    }))
}

// ═══════════════════════════════════════════════════
// SHIPMENT ASSIGNMENT WORKFLOW
// ═══════════════════════════════════════════════════

export async function assignShipmentToPartner(
    shipmentId: string,
    partnerId: string,
    role: 'FORWARDER' | 'CUSTOMS_BROKER'
): Promise<{ success: boolean; error?: string }> {
    try {
        // Grant access
        await prisma.partnerShipmentAccess.upsert({
            where: { partnerId_shipmentId: { partnerId, shipmentId } },
            create: { partnerId, shipmentId },
            update: {},
        })

        // Update shipment with the partner role
        const data = role === 'FORWARDER'
            ? { forwarderId: partnerId }
            : { customsBrokerId: partnerId }
        await prisma.shipment.update({ where: { id: shipmentId }, data })

        revalidatePath('/dashboard/agency')
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Partner's assigned shipments (richer view) ────
export type PartnerAssignment = {
    shipmentId: string; billOfLading: string; poNo: string; supplierName: string
    vesselName: string | null; containerNo: string | null
    portOfLoading: string | null; portOfDischarge: string | null
    etd: Date | null; eta: Date | null; status: string
    incoterms: string | null; role: string
    milestones: { id: string; milestone: string; label: string; completedAt: Date | null; sortOrder: number }[]
    submissionCount: number
}

export async function getPartnerAssignments(partnerId: string): Promise<PartnerAssignment[]> {
    const accesses = await prisma.partnerShipmentAccess.findMany({
        where: { partnerId },
        select: { shipmentId: true },
    })

    if (!accesses.length) return []

    const shipments = await prisma.shipment.findMany({
        where: { id: { in: accesses.map(a => a.shipmentId) } },
        include: {
            po: { include: { supplier: { select: { name: true } } } },
            milestones: { orderBy: { sortOrder: 'asc' } },
            agencySubmissions: { where: { partnerId }, select: { id: true } },
        },
        orderBy: { eta: 'desc' },
    })

    return shipments.map(s => ({
        shipmentId: s.id, billOfLading: s.billOfLading, poNo: s.po.poNo,
        supplierName: s.po.supplier.name, vesselName: s.vesselName,
        containerNo: s.containerNo, portOfLoading: s.portOfLoading,
        portOfDischarge: s.portOfDischarge, etd: s.etd, eta: s.eta,
        status: s.status, incoterms: s.incoterms,
        role: s.forwarderId === partnerId ? 'FORWARDER' : 'CUSTOMS_BROKER',
        milestones: s.milestones.map(m => ({
            id: m.id, milestone: m.milestone, label: m.label,
            completedAt: m.completedAt, sortOrder: m.sortOrder,
        })),
        submissionCount: s.agencySubmissions.length,
    }))
}

// ── Partner updates vessel/ETA info ───────────────
export async function partnerUpdateShipmentInfo(
    partnerId: string, shipmentId: string,
    input: {
        vesselName?: string; voyageNo?: string; containerNo?: string
        containerType?: string; etd?: string; eta?: string; ata?: string
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        // Verify partner has access
        const access = await prisma.partnerShipmentAccess.findUnique({
            where: { partnerId_shipmentId: { partnerId, shipmentId } },
        })
        if (!access) return { success: false, error: 'Không có quyền truy cập lô hàng này' }

        const data: any = {}
        if (input.vesselName !== undefined) data.vesselName = input.vesselName
        if (input.voyageNo !== undefined) data.voyageNo = input.voyageNo
        if (input.containerNo !== undefined) data.containerNo = input.containerNo
        if (input.containerType !== undefined) data.containerType = input.containerType
        if (input.etd) data.etd = new Date(input.etd)
        if (input.eta) data.eta = new Date(input.eta)
        if (input.ata) data.ata = new Date(input.ata)

        await prisma.shipment.update({ where: { id: shipmentId }, data })
        revalidatePath('/dashboard/agency')
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Partner completes a milestone ─────────────────
export async function partnerUpdateMilestone(
    partnerId: string, milestoneId: string, notes?: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const milestone = await prisma.shipmentMilestone.findUnique({
            where: { id: milestoneId },
            select: { shipmentId: true },
        })
        if (!milestone) return { success: false, error: 'Milestone không tồn tại' }

        // Verify access
        const access = await prisma.partnerShipmentAccess.findUnique({
            where: { partnerId_shipmentId: { partnerId, shipmentId: milestone.shipmentId } },
        })
        if (!access) return { success: false, error: 'Không có quyền' }

        await prisma.shipmentMilestone.update({
            where: { id: milestoneId },
            data: { completedAt: new Date(), completedBy: partnerId, notes: notes ?? null },
        })
        revalidatePath('/dashboard/agency')
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Partner's cost summary (what they've invoiced) ─
export async function getPartnerCostSummary(partnerId: string) {
    const accesses = await prisma.partnerShipmentAccess.findMany({
        where: { partnerId },
        select: { shipmentId: true },
    })
    if (!accesses.length) return { totalCostsVND: 0, shipmentCount: 0, items: [] }

    const costItems = await prisma.shipmentCostItem.findMany({
        where: { shipmentId: { in: accesses.map(a => a.shipmentId) } },
        include: { shipment: { select: { billOfLading: true } } },
        orderBy: { createdAt: 'desc' },
    })

    return {
        totalCostsVND: costItems.reduce((s, c) => s + Number(c.amountVND), 0),
        shipmentCount: accesses.length,
        items: costItems.map(c => ({
            id: c.id, shipmentBol: c.shipment.billOfLading,
            category: c.category, description: c.description,
            amount: Number(c.amount), currency: c.currency,
            amountVND: Number(c.amountVND), paidAt: c.paidAt,
        })),
    }
}
