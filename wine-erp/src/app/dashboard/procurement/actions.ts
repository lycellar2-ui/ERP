'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

// ─── Types ────────────────────────────────────────
export type PORow = {
    id: string
    poNo: string
    supplierName: string
    supplierId: string
    currency: string
    exchangeRate: number
    status: string
    totalAmount: number
    lineCount: number
    totalQty: number
    createdAt: Date
}

export type PODetail = PORow & {
    lines: {
        id: string
        productId: string
        productName: string
        skuCode: string
        qtyOrdered: number
        unitPrice: number
        uom: string
        lineTotal: number
    }[]
}

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
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: PORow[]; total: number }> {
    const { search, status, supplierId, page = 1, pageSize = 20 } = filters

    const where: any = {}
    if (search) {
        where.OR = [
            { poNo: { contains: search, mode: 'insensitive' } },
            { supplier: { name: { contains: search, mode: 'insensitive' } } },
        ]
    }
    if (status) where.status = status
    if (supplierId) where.supplierId = supplierId

    const [items, total] = await Promise.all([
        prisma.purchaseOrder.findMany({
            where,
            include: {
                supplier: { select: { name: true } },
                lines: { select: { qtyOrdered: true, unitPrice: true } },
            },
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.purchaseOrder.count({ where }),
    ])

    const rows = items.map(po => ({
        id: po.id,
        poNo: po.poNo,
        supplierName: po.supplier.name,
        supplierId: po.supplierId,
        currency: po.currency,
        exchangeRate: Number(po.exchangeRate),
        status: po.status,
        totalAmount: po.lines.reduce((s, l) => s + Number(l.qtyOrdered) * Number(l.unitPrice), 0),
        lineCount: po.lines.length,
        totalQty: po.lines.reduce((s, l) => s + Number(l.qtyOrdered), 0),
        createdAt: po.createdAt,
    }))

    return { rows, total }
}

// ─── Get single PO with lines ─────────────────────
export async function getPODetail(id: string): Promise<PODetail | null> {
    const po = await prisma.purchaseOrder.findUnique({
        where: { id },
        include: {
            supplier: { select: { name: true } },
            lines: {
                include: {
                    product: { select: { productName: true, skuCode: true } },
                },
            },
        },
    })
    if (!po) return null

    const lines = po.lines.map(l => ({
        id: l.id,
        productId: l.productId,
        productName: l.product.productName,
        skuCode: l.product.skuCode,
        qtyOrdered: Number(l.qtyOrdered),
        unitPrice: Number(l.unitPrice),
        uom: l.uom,
        lineTotal: Number(l.qtyOrdered) * Number(l.unitPrice),
    }))

    return {
        id: po.id,
        poNo: po.poNo,
        supplierName: po.supplier.name,
        supplierId: po.supplierId,
        currency: po.currency,
        exchangeRate: Number(po.exchangeRate),
        status: po.status,
        totalAmount: lines.reduce((s, l) => s + l.lineTotal, 0),
        lineCount: lines.length,
        totalQty: lines.reduce((s, l) => s + l.qtyOrdered, 0),
        createdAt: po.createdAt,
        lines,
    }
}

// ─── Schema ───────────────────────────────────────
const poLineSchema = z.object({
    productId: z.string().min(1),
    qtyOrdered: z.number().positive(),
    unitPrice: z.number().positive(),
    uom: z.string().default('BOTTLE'),
})

const createPOSchema = z.object({
    supplierId: z.string().min(1, 'Chọn nhà cung cấp'),
    currency: z.enum(['USD', 'EUR', 'GBP']).default('USD'),
    exchangeRate: z.number().positive().default(25000),
    lines: z.array(poLineSchema).min(1, 'Cần ít nhất 1 dòng sản phẩm'),
})

export type CreatePOInput = z.infer<typeof createPOSchema>

// ─── Create PO ────────────────────────────────────
export async function createPurchaseOrder(input: CreatePOInput) {
    const data = createPOSchema.parse(input)
    const userId = await getOrCreateSystemUser()

    // Generate PO number: PO-YYMM-NNNN
    const now = new Date()
    const yy = String(now.getFullYear()).slice(-2)
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const count = await prisma.purchaseOrder.count()
    const poNo = `PO-${yy}${mm}-${String(count + 1).padStart(4, '0')}`

    const po = await prisma.purchaseOrder.create({
        data: {
            poNo,
            supplierId: data.supplierId,
            currency: data.currency,
            exchangeRate: data.exchangeRate,
            status: 'DRAFT',
            createdBy: userId,
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

    revalidatePath('/dashboard/procurement')
    return { success: true, id: po.id, poNo: po.poNo }
}

// ─── Update PO status ─────────────────────────────
export async function updatePOStatus(id: string, status: string) {
    await prisma.purchaseOrder.update({
        where: { id },
        data: { status: status as any },
    })
    revalidatePath('/dashboard/procurement')
    return { success: true }
}

// ─── Stats for dashboard ──────────────────────────
export async function getPOStats() {
    const [total, draft, approved, inTransit] = await Promise.all([
        prisma.purchaseOrder.count(),
        prisma.purchaseOrder.count({ where: { status: 'DRAFT' } }),
        prisma.purchaseOrder.count({ where: { status: 'APPROVED' } }),
        prisma.purchaseOrder.count({ where: { status: 'IN_TRANSIT' } }),
    ])
    return { total, draft, approved, inTransit }
}
