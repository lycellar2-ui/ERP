'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import { parseOrThrow, RegDocCreateSchema, RegDocUpdateSchema, RegDocRenewSchema } from '@/lib/validations'
import { uploadToStorage } from '@/lib/supabase-storage'

// ═══════════════════════════════════════════════════
// Type Definitions
// ═══════════════════════════════════════════════════

export interface RegDocRow {
    id: string
    docNo: string
    category: string
    type: string
    name: string
    scope: string
    issueDate: Date
    expiryDate: Date | null
    issuingAuthority: string | null
    status: string
    daysRemaining: number | null
    linkedEntity: string | null
    linkedEntityType: string | null
    assignedToName: string | null
    version: number
    fileCount: number
    createdAt: Date
}

// ═══════════════════════════════════════════════════
// CRUD Actions
// ═══════════════════════════════════════════════════

export async function getRegulatedDocs(filters: {
    category?: string
    type?: string
    scope?: string
    status?: string
    search?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: RegDocRow[]; total: number }> {
    const { category, type, scope, status, search, page = 1, pageSize = 20 } = filters
    const cacheKey = `regdocs:list:${page}:${pageSize}:${category ?? ''}:${type ?? ''}:${scope ?? ''}:${status ?? ''}:${search ?? ''}`

    return cached(cacheKey, async () => {
        const skip = (page - 1) * pageSize
        const now = new Date()

        const where: any = {}
        if (category) where.category = category
        if (type) where.type = type
        if (scope) where.scope = scope
        if (status) where.status = status
        if (search) {
            where.OR = [
                { docNo: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ]
        }

        const [docs, total] = await Promise.all([
            prisma.regulatedDocument.findMany({
                where, skip, take: pageSize,
                orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
                include: {
                    supplier: { select: { name: true } },
                    customer: { select: { name: true } },
                    product: { select: { productName: true, skuCode: true } },
                    shipment: { select: { billOfLading: true } },
                    stockLot: { select: { lotNo: true } },
                    assignedTo: { select: { name: true } },
                    _count: { select: { files: true } },
                },
            }),
            prisma.regulatedDocument.count({ where }),
        ])

        return {
            rows: docs.map(d => {
                let linkedEntity: string | null = null
                let linkedEntityType: string | null = null

                if (d.supplier) { linkedEntity = d.supplier.name; linkedEntityType = 'supplier' }
                else if (d.customer) { linkedEntity = d.customer.name; linkedEntityType = 'customer' }
                else if (d.product) { linkedEntity = `${d.product.skuCode} — ${d.product.productName}`; linkedEntityType = 'product' }
                else if (d.shipment) { linkedEntity = d.shipment.billOfLading; linkedEntityType = 'shipment' }
                else if (d.stockLot) { linkedEntity = d.stockLot.lotNo; linkedEntityType = 'lot' }

                const daysRemaining = d.expiryDate
                    ? Math.ceil((d.expiryDate.getTime() - now.getTime()) / (86400 * 1000))
                    : null

                return {
                    id: d.id,
                    docNo: d.docNo,
                    category: d.category,
                    type: d.type,
                    name: d.name,
                    scope: d.scope,
                    issueDate: d.issueDate,
                    expiryDate: d.expiryDate,
                    issuingAuthority: d.issuingAuthority,
                    status: d.status,
                    daysRemaining,
                    linkedEntity,
                    linkedEntityType,
                    assignedToName: d.assignedTo?.name ?? null,
                    version: d.version,
                    fileCount: d._count.files,
                    createdAt: d.createdAt,
                }
            }),
            total,
        }
    })
}

export async function getRegDocStats() {
    return cached('regdocs:stats', async () => {
        const now = new Date()
        const d90 = new Date(now.getTime() + 90 * 86400000)

        const [total, active, expiringSoon, expired, byCategory] = await Promise.all([
            prisma.regulatedDocument.count(),
            prisma.regulatedDocument.count({ where: { status: 'ACTIVE' } }),
            prisma.regulatedDocument.count({
                where: {
                    status: { in: ['ACTIVE', 'EXPIRING'] },
                    expiryDate: { gte: now, lte: d90 },
                },
            }),
            prisma.regulatedDocument.count({ where: { status: 'EXPIRED' } }),
            prisma.regulatedDocument.groupBy({
                by: ['category'],
                _count: true,
                where: { status: { in: ['ACTIVE', 'EXPIRING'] } },
            }),
        ])

        const categoryBreakdown = Object.fromEntries(
            byCategory.map(b => [b.category, b._count])
        )

        return { total, active, expiringSoon, expired, categoryBreakdown }
    })
}

export async function createRegulatedDoc(input: unknown): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const validated = parseOrThrow(RegDocCreateSchema, input)

        const doc = await prisma.regulatedDocument.create({
            data: {
                docNo: validated.docNo,
                category: validated.category as any,
                type: validated.type as any,
                name: validated.name,
                description: validated.description ?? null,
                issueDate: new Date(validated.issueDate),
                effectiveDate: validated.effectiveDate ? new Date(validated.effectiveDate) : null,
                expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : null,
                issuingAuthority: validated.issuingAuthority ?? null,
                referenceNo: validated.referenceNo ?? null,
                scope: (validated.scope as any) ?? 'COMPANY',
                contractId: validated.contractId || null,
                supplierId: validated.supplierId || null,
                customerId: validated.customerId || null,
                productId: validated.productId || null,
                shipmentId: validated.shipmentId || null,
                stockLotId: validated.stockLotId || null,
                assignedToId: validated.assignedToId || null,
                alertDays: validated.alertDays ?? [90, 60, 30, 7],
                status: 'ACTIVE',
            },
        })

        revalidateCache('regdocs')
        revalidatePath('/dashboard/contracts')
        return { success: true, id: doc.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function updateRegulatedDoc(input: unknown): Promise<{ success: boolean; error?: string }> {
    try {
        const validated = parseOrThrow(RegDocUpdateSchema, input)
        const { id, ...data } = validated

        const updateData: any = {}
        if (data.name) updateData.name = data.name
        if (data.description !== undefined) updateData.description = data.description
        if (data.expiryDate) updateData.expiryDate = new Date(data.expiryDate)
        if (data.issuingAuthority !== undefined) updateData.issuingAuthority = data.issuingAuthority
        if (data.referenceNo !== undefined) updateData.referenceNo = data.referenceNo
        if (data.status) updateData.status = data.status
        if (data.assignedToId !== undefined) updateData.assignedToId = data.assignedToId || null
        if (data.alertDays) updateData.alertDays = data.alertDays

        await prisma.regulatedDocument.update({ where: { id }, data: updateData })

        revalidateCache('regdocs')
        revalidatePath('/dashboard/contracts')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteRegulatedDoc(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.regulatedDocument.delete({ where: { id } })
        revalidateCache('regdocs')
        revalidatePath('/dashboard/contracts')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// Renewal (Gia Hạn)
// ═══════════════════════════════════════════════════

export async function renewRegulatedDoc(input: unknown): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const validated = parseOrThrow(RegDocRenewSchema, input)

        const original = await prisma.regulatedDocument.findUnique({
            where: { id: validated.originalDocId },
        })
        if (!original) return { success: false, error: 'Giấy tờ gốc không tồn tại' }

        const result = await prisma.$transaction(async (tx) => {
            // Create new version
            const newDoc = await tx.regulatedDocument.create({
                data: {
                    docNo: validated.newDocNo,
                    category: original.category,
                    type: original.type,
                    name: original.name,
                    description: original.description,
                    issueDate: new Date(validated.issueDate),
                    effectiveDate: new Date(validated.issueDate),
                    expiryDate: validated.expiryDate ? new Date(validated.expiryDate) : null,
                    issuingAuthority: validated.issuingAuthority ?? original.issuingAuthority,
                    referenceNo: null,
                    scope: original.scope,
                    contractId: original.contractId,
                    supplierId: original.supplierId,
                    customerId: original.customerId,
                    productId: original.productId,
                    shipmentId: original.shipmentId,
                    stockLotId: original.stockLotId,
                    assignedToId: original.assignedToId,
                    alertDays: original.alertDays,
                    status: 'ACTIVE',
                    renewedFromId: validated.keepHistory ? original.id : null,
                    version: original.version + 1,
                    createdBy: original.createdBy,
                },
            })

            if (validated.keepHistory) {
                // Mark original as RENEWED
                await tx.regulatedDocument.update({
                    where: { id: original.id },
                    data: { status: 'RENEWED' },
                })
            } else {
                // Delete original
                await tx.regulatedDocument.delete({ where: { id: original.id } })
            }

            return newDoc
        })

        revalidateCache('regdocs')
        revalidatePath('/dashboard/contracts')
        return { success: true, id: result.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// File Upload
// ═══════════════════════════════════════════════════

export async function uploadRegDocFile(regDocId: string, formData: FormData) {
    try {
        const file = formData.get('file') as File
        if (!file || file.size === 0) return { success: false, error: 'Chưa chọn file' }
        if (file.size > 10 * 1024 * 1024) return { success: false, error: 'File quá lớn (max 10MB)' }

        const doc = await prisma.regulatedDocument.findUnique({
            where: { id: regDocId },
            select: { docNo: true, version: true },
        })

        const filePath = `regulated-docs/${doc?.docNo ?? regDocId}/v${doc?.version ?? 1}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`
        const buffer = Buffer.from(await file.arrayBuffer())
        const uploadRes = await uploadToStorage('contracts', filePath, buffer, file.type)

        if (!uploadRes.success || !uploadRes.url) {
            return { success: false, error: uploadRes.error ?? 'Upload failed' }
        }

        const regDocFile = await prisma.regDocFile.create({
            data: {
                regDocId,
                name: file.name,
                fileUrl: uploadRes.url,
                storagePath: uploadRes.path,
                version: doc?.version ?? 1,
            },
        })

        revalidateCache('regdocs')
        revalidatePath('/dashboard/contracts')
        return { success: true, file: regDocFile }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getRegDocFiles(regDocId: string) {
    return prisma.regDocFile.findMany({
        where: { regDocId },
        orderBy: { uploadedAt: 'desc' },
    })
}

// ═══════════════════════════════════════════════════
// Compliance Check (for warnings)
// ═══════════════════════════════════════════════════

export interface ComplianceWarning {
    id: string
    docNo: string
    name: string
    type: string
    daysRemaining: number | null
    status: string
    severity: 'critical' | 'warning' | 'info'
    message: string
}

export async function getComplianceWarnings(): Promise<ComplianceWarning[]> {
    const now = new Date()
    const d90 = new Date(now.getTime() + 90 * 86400000)

    const docs = await prisma.regulatedDocument.findMany({
        where: {
            status: { in: ['ACTIVE', 'EXPIRING', 'EXPIRED'] },
            expiryDate: { lte: d90 },
        },
        orderBy: { expiryDate: 'asc' },
        select: {
            id: true, docNo: true, name: true, type: true,
            expiryDate: true, status: true,
        },
    })

    return docs.map(d => {
        const daysRemaining = d.expiryDate
            ? Math.ceil((d.expiryDate.getTime() - now.getTime()) / (86400 * 1000))
            : null

        let severity: 'critical' | 'warning' | 'info' = 'info'
        let message = ''

        if (daysRemaining !== null && daysRemaining <= 0) {
            severity = 'critical'
            message = `⚠️ Đã hết hạn ${Math.abs(daysRemaining)} ngày — Cần gia hạn ngay`
        } else if (daysRemaining !== null && daysRemaining <= 30) {
            severity = 'critical'
            message = `🔴 Còn ${daysRemaining} ngày — Gia hạn khẩn cấp`
        } else if (daysRemaining !== null && daysRemaining <= 60) {
            severity = 'warning'
            message = `🟡 Còn ${daysRemaining} ngày — Chuẩn bị hồ sơ gia hạn`
        } else {
            severity = 'info'
            message = `🟢 Còn ${daysRemaining} ngày`
        }

        return {
            id: d.id, docNo: d.docNo, name: d.name, type: d.type,
            daysRemaining, status: d.status, severity, message,
        }
    })
}

// ═══════════════════════════════════════════════════
// Auto-Expire Regulated Documents
// ═══════════════════════════════════════════════════

export async function autoExpireRegDocs(): Promise<{ expired: number; expiring: number }> {
    const now = new Date()
    const d90 = new Date(now.getTime() + 90 * 86400000)

    // Mark as EXPIRED
    const expired = await prisma.regulatedDocument.updateMany({
        where: {
            status: { in: ['ACTIVE', 'EXPIRING'] },
            expiryDate: { lt: now },
        },
        data: { status: 'EXPIRED' },
    })

    // Mark as EXPIRING (within 90 days)
    const expiring = await prisma.regulatedDocument.updateMany({
        where: {
            status: 'ACTIVE',
            expiryDate: { gte: now, lte: d90 },
        },
        data: { status: 'EXPIRING' },
    })

    if (expired.count > 0 || expiring.count > 0) {
        revalidateCache('regdocs')
        revalidatePath('/dashboard/contracts')
    }

    return { expired: expired.count, expiring: expiring.count }
}

// ═══════════════════════════════════════════════════
// Linked Entity Lookups (for form dropdowns)
// ═══════════════════════════════════════════════════

export async function getRegDocLinkOptions() {
    const [suppliers, customers, products, shipments] = await Promise.all([
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
        prisma.product.findMany({
            where: { deletedAt: null },
            select: { id: true, productName: true, skuCode: true },
            orderBy: { productName: 'asc' },
            take: 200,
        }),
        prisma.shipment.findMany({
            select: { id: true, billOfLading: true, containerNo: true },
            orderBy: { createdAt: 'desc' },
            take: 50,
        }),
    ])

    return { suppliers, customers, products, shipments }
}
