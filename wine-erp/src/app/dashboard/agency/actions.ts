'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

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
}

// ─── List Partners ────────────────────────────────
export async function getAgencyPartners(): Promise<AgencyPartnerRow[]> {
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
            shipment: { select: { billOfLading: true } },
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
    return prisma.shipment.findMany({
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
}
