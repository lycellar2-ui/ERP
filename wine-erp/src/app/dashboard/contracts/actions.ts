'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export interface ContractRow {
    id: string
    contractNo: string
    type: string
    counterpartyName: string
    counterpartyType: 'supplier' | 'customer'
    value: number
    currency: string
    startDate: Date
    endDate: Date
    status: string
    isExpiringSoon: boolean
    createdAt: Date
}

export interface ContractCreateInput {
    contractNo: string
    type: string
    supplierId?: string
    customerId?: string
    value: number
    currency: string
    startDate: string
    endDate: string
    paymentTerm?: string
    incoterms?: string
}

export async function getContracts(filters: {
    status?: string
    type?: string
    search?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: ContractRow[]; total: number }> {
    const { status, type, search, page = 1, pageSize = 20 } = filters
    const skip = (page - 1) * pageSize

    const where: any = {}
    if (status) where.status = status
    if (type) where.type = type
    if (search) where.contractNo = { contains: search, mode: 'insensitive' }

    const [contracts, total] = await Promise.all([
        prisma.contract.findMany({
            where, skip, take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                supplier: { select: { name: true } },
                customer: { select: { name: true } },
            },
        }),
        prisma.contract.count({ where }),
    ])

    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    return {
        rows: contracts.map(c => ({
            id: c.id,
            contractNo: c.contractNo,
            type: c.type,
            counterpartyName: c.supplier?.name ?? c.customer?.name ?? 'Unknown',
            counterpartyType: c.supplierId ? 'supplier' : 'customer',
            value: Number(c.value),
            currency: c.currency,
            startDate: c.startDate,
            endDate: c.endDate,
            status: c.status,
            isExpiringSoon: c.endDate <= thirtyDaysFromNow && c.status === 'ACTIVE',
            createdAt: c.createdAt,
        })),
        total,
    }
}

export async function getContractStats() {
    const now = new Date()
    const [total, active, expiringSoon, expired] = await Promise.all([
        prisma.contract.count(),
        prisma.contract.count({ where: { status: 'ACTIVE' } }),
        prisma.contract.count({
            where: {
                status: 'ACTIVE',
                endDate: { lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
            },
        }),
        prisma.contract.count({ where: { status: 'EXPIRED' } }),
    ])
    return { total, active, expiringSoon, expired }
}

// ── Get suppliers & customers for contract form ───
export async function getCounterparties() {
    const [suppliers, customers] = await Promise.all([
        prisma.supplier.findMany({
            where: { status: 'ACTIVE' },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        }),
        prisma.customer.findMany({
            where: { status: 'ACTIVE', deletedAt: null },
            select: { id: true, name: true, code: true },
            orderBy: { name: 'asc' },
        }),
    ])
    return { suppliers, customers }
}

// ── Create contract ───────────────────────────────
export async function createContract(input: ContractCreateInput): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        if (!input.supplierId && !input.customerId) {
            return { success: false, error: 'Phải chọn nhà cung cấp hoặc khách hàng' }
        }

        const contract = await prisma.contract.create({
            data: {
                contractNo: input.contractNo,
                type: input.type as any,
                supplierId: input.supplierId ?? null,
                customerId: input.customerId ?? null,
                value: input.value,
                currency: input.currency,
                startDate: new Date(input.startDate),
                endDate: new Date(input.endDate),
                paymentTerm: input.paymentTerm ?? null,
                incoterms: input.incoterms ?? null,
                status: 'ACTIVE',
            },
        })

        revalidatePath('/dashboard/contracts')
        return { success: true, id: contract.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Update contract status ────────────────────────
export async function updateContractStatus(
    id: string,
    status: 'ACTIVE' | 'EXPIRED' | 'TERMINATED'
): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.contract.update({ where: { id }, data: { status } })
        revalidatePath('/dashboard/contracts')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Contract Utilization (PO/SO linked value) ─────
export async function getContractUtilization(contractId: string) {
    const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
            purchaseOrders: {
                select: {
                    id: true,
                    lines: { select: { unitPrice: true, qtyOrdered: true } },
                },
            },
            salesOrders: { select: { totalAmount: true } },
            documents: { orderBy: { uploadedAt: 'desc' } },
        },
    })
    if (!contract) return null

    const poTotal = contract.purchaseOrders.reduce((s: number, po: any) =>
        s + po.lines.reduce((ls: number, l: any) => ls + Number(l.unitPrice) * Number(l.qtyOrdered), 0), 0)
    const soTotal = contract.salesOrders.reduce((s: number, so: any) => s + Number(so.totalAmount), 0)
    const utilizedValue = poTotal + soTotal
    const contractValue = Number(contract.value)
    const utilizationPct = contractValue > 0 ? (utilizedValue / contractValue) * 100 : 0

    return {
        contractValue,
        utilizedValue,
        utilizationPct: Math.min(utilizationPct, 100),
        poCount: contract.purchaseOrders.length,
        soCount: contract.salesOrders.length,
        poTotal,
        soTotal,
        remaining: contractValue - utilizedValue,
        documents: contract.documents.map(d => ({
            id: d.id,
            name: d.name,
            fileUrl: d.fileUrl,
            uploadedAt: d.uploadedAt
        }))
    }
}

// ── Link Contract to SO ───────────────────────────
export async function linkContractToSO(contractId: string, soId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const contract = await prisma.contract.findUnique({ where: { id: contractId } })
        if (!contract) return { success: false, error: 'Hợp đồng không tồn tại' }
        if (contract.status !== 'ACTIVE') return { success: false, error: 'Hợp đồng không active' }
        if (contract.endDate < new Date()) return { success: false, error: 'Hợp đồng đã hết hạn' }

        await prisma.salesOrder.update({ where: { id: soId }, data: { contractId } })
        revalidatePath('/dashboard/contracts')
        revalidatePath('/dashboard/sales')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Link Contract to PO ───────────────────────────
export async function linkContractToPO(contractId: string, poId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const contract = await prisma.contract.findUnique({ where: { id: contractId } })
        if (!contract) return { success: false, error: 'Hợp đồng không tồn tại' }
        if (contract.status !== 'ACTIVE') return { success: false, error: 'Hợp đồng không active' }
        if (contract.endDate < new Date()) return { success: false, error: 'Hợp đồng đã hết hạn' }

        await prisma.purchaseOrder.update({ where: { id: poId }, data: { contractId } })
        revalidatePath('/dashboard/contracts')
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Expiring Contracts Alert ──────────────────────
export type ExpiringContractAlert = {
    id: string
    contractNo: string
    counterpartyName: string
    endDate: Date
    daysRemaining: number
    value: number
    type: string
}

export async function getExpiringContracts(daysAhead: number = 30): Promise<ExpiringContractAlert[]> {
    const now = new Date()
    const futureDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

    const contracts = await prisma.contract.findMany({
        where: {
            status: 'ACTIVE',
            endDate: { gte: now, lte: futureDate },
        },
        include: {
            supplier: { select: { name: true } },
            customer: { select: { name: true } },
        },
        orderBy: { endDate: 'asc' },
    })

    return contracts.map(c => ({
        id: c.id,
        contractNo: c.contractNo,
        counterpartyName: c.supplier?.name ?? c.customer?.name ?? 'Unknown',
        endDate: c.endDate,
        daysRemaining: Math.ceil((c.endDate.getTime() - now.getTime()) / (86400 * 1000)),
        value: Number(c.value),
        type: c.type,
    }))
}

// ── Auto-Expire Past-Due Contracts ────────────────
export async function autoExpireContracts(): Promise<{ success: boolean; expired: number }> {
    const now = new Date()
    const result = await prisma.contract.updateMany({
        where: {
            status: 'ACTIVE',
            endDate: { lt: now },
        },
        data: { status: 'EXPIRED' },
    })
    revalidatePath('/dashboard/contracts')
    return { success: true, expired: result.count }
}

// ── Contract Amendment ────────────────────────────
export async function createContractAmendment(input: {
    contractId: string
    newEndDate?: string
    newValue?: number
    reason: string
    fileUrl?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const contract = await prisma.contract.findUnique({
            where: { id: input.contractId },
            include: { amendments: { select: { amendNo: true }, orderBy: { amendNo: 'desc' }, take: 1 } }
        })
        if (!contract) return { success: false, error: 'Hợp đồng không tồn tại' }

        const nextAmendNo = (contract.amendments[0]?.amendNo ?? 0) + 1
        const updateData: any = {}
        if (input.newEndDate) updateData.endDate = new Date(input.newEndDate)
        if (input.newValue != null) updateData.value = input.newValue

        await prisma.$transaction(async (tx) => {
            // 1. Create amendment record
            await tx.contractAmendment.create({
                data: {
                    contractId: input.contractId,
                    amendNo: nextAmendNo,
                    description: input.reason,
                    signedDate: new Date(),
                    fileUrl: input.fileUrl ?? null,
                },
            })

            // 2. Update the contract itself
            await tx.contract.update({
                where: { id: input.contractId },
                data: {
                    ...updateData,
                    status: 'ACTIVE', // Re-activate if was expired
                },
            })
        })

        revalidatePath('/dashboard/contracts')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── List Contract Amendments ──────────────────────
export async function getContractAmendments(contractId: string) {
    return prisma.contractAmendment.findMany({
        where: { contractId },
        orderBy: { amendNo: 'desc' },
    })
}

// ── Upload/Get Contract Documents ─────────────────
import { uploadFile } from '@/lib/storage'

export async function uploadContractDocument(contractId: string, formData: FormData) {
    try {
        const file = formData.get('file') as File
        if (!file) return { success: false, error: 'Chưa chọn file hợp đồng' }

        const uploadRes = await uploadFile(formData, 'contracts')
        if (!uploadRes.success || !uploadRes.url) {
            return { success: false, error: uploadRes.error ?? 'Upload failed' }
        }

        const doc = await prisma.contractDocument.create({
            data: {
                contractId,
                name: file.name,
                fileUrl: uploadRes.url,
            }
        })

        revalidatePath('/dashboard/contracts')
        return { success: true, document: doc }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getContractDocuments(contractId: string) {
    return prisma.contractDocument.findMany({
        where: { contractId },
        orderBy: { uploadedAt: 'desc' }
    })
}

export async function signContract(contractId: string, signatureUrl: string) {
    try {
        await prisma.contract.update({
            where: { id: contractId },
            data: { signatureUrl, status: 'ACTIVE' },
        })
        revalidatePath('/dashboard/contracts')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// #30 — DIGITAL SIGNATURE (Internal)
// ═══════════════════════════════════════════════════

export async function signContractInternal(input: {
    contractId: string
    signerId: string
    signerRole: string
    signatureDataUrl: string // base64 canvas signature
    ipAddress?: string
}): Promise<{ success: boolean; signatureHash?: string; error?: string }> {
    try {
        const contract = await prisma.contract.findUnique({ where: { id: input.contractId } })
        if (!contract) return { success: false, error: 'Hợp đồng không tồn tại' }
        if (contract.status === 'ACTIVE') return { success: false, error: 'Hợp đồng đã được ký' }

        // Generate hash for verification
        const encoder = new TextEncoder()
        const data = encoder.encode(`${input.contractId}:${input.signerId}:${Date.now()}`)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const signatureHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        await prisma.contract.update({
            where: { id: input.contractId },
            data: {
                signatureUrl: input.signatureDataUrl,
                status: 'ACTIVE',
            },
        })

        // Log audit for signature (stores signedBy, signatureHash, etc.)
        const { logAudit } = await import('@/lib/audit')
        await logAudit({
            userId: input.signerId,
            action: 'SIGN',
            entityType: 'Contract',
            entityId: input.contractId,
            description: `Ký nội bộ HĐ ${contract.contractNo} — ${input.signerRole}`,
            newValue: { signatureHash, signedBy: input.signerId, signedAt: new Date().toISOString(), signerRole: input.signerRole, ip: input.ipAddress },
        })

        revalidatePath('/dashboard/contracts')
        return { success: true, signatureHash }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function verifyContractSignature(contractId: string): Promise<{
    isSigned: boolean
    signedAt: Date | null
    signedBy: string | null
    signatureHash: string | null
}> {
    const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        select: { signatureUrl: true, updatedAt: true },
    })

    if (!contract?.signatureUrl) {
        return { isSigned: false, signedAt: null, signedBy: null, signatureHash: null }
    }

    return {
        isSigned: true,
        signedAt: contract.updatedAt,
        signedBy: null,
        signatureHash: null,
    }
}
