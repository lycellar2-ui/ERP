'use server'

import { prisma } from '@/lib/db'

/**
 * Get regulated documents linked to a specific supplier.
 * Returns all docs where scope=SUPPLIER and supplierId matches.
 */
export async function getSupplierRegDocs(supplierId: string) {
    const docs = await prisma.regulatedDocument.findMany({
        where: { supplierId, scope: 'SUPPLIER' },
        include: {
            files: {
                orderBy: { version: 'desc' },
                take: 1,
            },
        },
        orderBy: { expiryDate: 'asc' },
    })

    const now = new Date()
    return docs.map(d => {
        const expiry = d.expiryDate ? new Date(d.expiryDate) : null
        const daysRemaining = expiry
            ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
            : null

        return {
            id: d.id,
            docNo: d.docNo,
            name: d.name,
            category: d.category,
            type: d.type,
            status: d.status,
            issueDate: d.issueDate,
            expiryDate: d.expiryDate,
            issuingAuthority: d.issuingAuthority,
            version: d.version,
            daysRemaining,
            latestFile: d.files[0] ?? null,
        }
    })
}

/**
 * Get regulated documents linked to a specific product.
 * Returns all docs where scope=PRODUCT and productId matches.
 */
export async function getProductRegDocs(productId: string) {
    const docs = await prisma.regulatedDocument.findMany({
        where: { productId, scope: 'PRODUCT' },
        include: {
            files: {
                orderBy: { version: 'desc' },
                take: 1,
            },
        },
        orderBy: { expiryDate: 'asc' },
    })

    const now = new Date()
    return docs.map(d => {
        const expiry = d.expiryDate ? new Date(d.expiryDate) : null
        const daysRemaining = expiry
            ? Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
            : null

        return {
            id: d.id,
            docNo: d.docNo,
            name: d.name,
            category: d.category,
            type: d.type,
            status: d.status,
            issueDate: d.issueDate,
            expiryDate: d.expiryDate,
            issuingAuthority: d.issuingAuthority,
            version: d.version,
            daysRemaining,
            latestFile: d.files[0] ?? null,
        }
    })
}

/**
 * Compliance check for a supplier — used by PO creation form.
 * Returns { compliant: boolean, missing: string[], expiring: {...}[] }
 */
export async function checkSupplierCompliance(supplierId: string) {
    const docs = await prisma.regulatedDocument.findMany({
        where: {
            supplierId,
            scope: 'SUPPLIER',
            status: { in: ['ACTIVE', 'EXPIRING'] },
        },
        select: { type: true, status: true, expiryDate: true, name: true, docNo: true },
    })

    const now = new Date()
    const thirtyDays = new Date(now.getTime() + 30 * 86400000)

    // Required document types for a wine import supplier
    const requiredTypes = [
        'GP_PHAN_PHOI_RUOU',
        'GP_NK_TU_DONG',
        'CN_VSATTP',
    ]

    const existingTypes = new Set<string>(docs.map(d => d.type))
    const missing = requiredTypes.filter(t => !existingTypes.has(t))

    const expiring = docs
        .filter(d => d.expiryDate && new Date(d.expiryDate) <= thirtyDays)
        .map(d => ({
            docNo: d.docNo,
            name: d.name,
            type: d.type,
            expiryDate: d.expiryDate,
            daysRemaining: Math.ceil((new Date(d.expiryDate!).getTime() - now.getTime()) / 86400000),
        }))

    return {
        compliant: missing.length === 0 && expiring.length === 0,
        missing,
        expiring,
        totalActiveDocs: docs.length,
    }
}

// ═══════════════════════════════════════════════════
// SHIPMENT DOC CHECKLIST (In-context)
// ═══════════════════════════════════════════════════

const IMPORT_DOC_TYPES = [
    'CERTIFICATE_OF_ORIGIN',
    'QUALITY_TEST_REPORT',
    'CUSTOMS_DECLARATION_CERT',
    'FOOD_SAFETY_LOT',
    'INSURANCE_POLICY_DOC',
    'WINE_STAMP_CERT',
    'HEALTH_CERTIFICATE',
    'FREE_SALE_CERTIFICATE',
    'PHYTOSANITARY_CERT',
] as const

/**
 * Get the doc checklist for a shipment.
 * Returns all IMPORT_DOCUMENT types with their upload status.
 */
export async function getShipmentDocChecklist(shipmentId: string) {
    const docs = await prisma.regulatedDocument.findMany({
        where: { shipmentId, scope: 'SHIPMENT' },
        include: {
            files: { orderBy: { version: 'desc' }, take: 1 },
        },
    })

    const docMap = new Map(docs.map(d => [d.type, d]))

    return IMPORT_DOC_TYPES.map(type => {
        const doc = docMap.get(type)
        return {
            type,
            checked: !!doc,
            status: doc?.status ?? null,
            docId: doc?.id ?? null,
            docNo: doc?.docNo ?? null,
            name: doc?.name ?? null,
            expiryDate: doc?.expiryDate ?? null,
            latestFile: doc?.files[0] ?? null,
        }
    })
}

/**
 * Toggle a doc type as required for a shipment.
 * If checked=true → create a DRAFT RegulatedDocument placeholder.
 * If checked=false → delete the DRAFT placeholder (only if DRAFT).
 */
export async function toggleShipmentDocRequired(shipmentId: string, docType: string, checked: boolean) {
    if (checked) {
        const existing = await prisma.regulatedDocument.findFirst({
            where: { shipmentId, scope: 'SHIPMENT', type: docType as any },
        })
        if (existing) return existing.id

        const count = await prisma.regulatedDocument.count()
        const doc = await prisma.regulatedDocument.create({
            data: {
                docNo: `RD-${Date.now().toString(36).toUpperCase()}`,
                category: 'IMPORT_DOCUMENT',
                type: docType as any,
                name: docType,
                scope: 'SHIPMENT',
                shipmentId,
                issueDate: new Date(),
                status: 'DRAFT',
                version: 1,
                alertDays: [30, 7],
            },
        })
        return doc.id
    } else {
        // Only delete if DRAFT (not yet uploaded)
        await prisma.regulatedDocument.deleteMany({
            where: { shipmentId, scope: 'SHIPMENT', type: docType as any, status: 'DRAFT' },
        })
        return null
    }
}

/**
 * Mark a shipment doc as uploaded (DRAFT → ACTIVE) with metadata.
 */
export async function activateShipmentDoc(docId: string, data: {
    name: string
    docNo?: string
    issuingAuthority?: string
    issueDate?: string
    expiryDate?: string
}) {
    const doc = await prisma.regulatedDocument.update({
        where: { id: docId },
        data: {
            name: data.name,
            docNo: data.docNo || undefined,
            issuingAuthority: data.issuingAuthority || undefined,
            issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
            expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
            status: 'ACTIVE',
        },
    })
    return doc
}
