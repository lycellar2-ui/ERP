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
