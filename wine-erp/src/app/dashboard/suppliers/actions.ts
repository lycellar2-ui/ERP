'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

export type SupplierRow = {
    id: string
    code: string
    name: string
    type: string
    country: string
    taxId: string | null
    tradeAgreement: string | null
    coFormType: string | null
    paymentTerm: string | null
    defaultCurrency: string
    incoterms: string | null
    leadTimeDays: number
    status: string
    poCount: number
    createdAt: Date
}

export async function getSuppliers(search?: string): Promise<SupplierRow[]> {
    const where: any = { deletedAt: null }
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
        ]
    }
    const items = await prisma.supplier.findMany({
        where,
        include: {
            purchaseOrders: { select: { id: true } },
        },
        orderBy: { name: 'asc' },
    })
    return items.map(s => ({
        id: s.id,
        code: s.code,
        name: s.name,
        type: s.type,
        country: s.country,
        taxId: s.taxId,
        tradeAgreement: s.tradeAgreement,
        coFormType: s.coFormType,
        paymentTerm: s.paymentTerm,
        defaultCurrency: s.defaultCurrency,
        incoterms: s.incoterms,
        leadTimeDays: s.leadTimeDays,
        status: s.status,
        poCount: s.purchaseOrders.length,
        createdAt: s.createdAt,
    }))
}

const supplierSchema = z.object({
    code: z.string().min(3, 'Mã NCC bắt buộc'),
    name: z.string().min(2, 'Tên NCC bắt buộc'),
    type: z.enum(['WINERY', 'NEGOCIANT', 'DISTRIBUTOR', 'LOGISTICS', 'FORWARDER', 'CUSTOMS_BROKER']),
    country: z.string().min(2).max(2),
    taxId: z.string().nullable().optional(),
    tradeAgreement: z.string().nullable().optional(),
    coFormType: z.string().nullable().optional(),
    paymentTerm: z.string().nullable().optional(),
    defaultCurrency: z.string().default('USD'),
    incoterms: z.string().nullable().optional(),
    leadTimeDays: z.number().int().default(45),
    status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED']).default('ACTIVE'),
})

export type SupplierInput = z.infer<typeof supplierSchema>

export async function createSupplier(input: SupplierInput) {
    const data = supplierSchema.parse(input)
    await prisma.supplier.create({
        data: {
            code: data.code,
            name: data.name,
            type: data.type,
            country: data.country,
            taxId: data.taxId ?? null,
            tradeAgreement: data.tradeAgreement ?? null,
            coFormType: data.coFormType ?? null,
            paymentTerm: data.paymentTerm ?? null,
            defaultCurrency: data.defaultCurrency,
            incoterms: data.incoterms ?? null,
            leadTimeDays: data.leadTimeDays,
            status: data.status,
        },
    })
    revalidatePath('/dashboard/suppliers')
    return { success: true }
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>) {
    await prisma.supplier.update({ where: { id }, data: input as any })
    revalidatePath('/dashboard/suppliers')
    return { success: true }
}

// ── Soft delete supplier ──────────────────────────
export async function deleteSupplier(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        // Check for active POs
        const activePOs = await prisma.purchaseOrder.count({
            where: { supplierId: id, status: { notIn: ['RECEIVED', 'CANCELLED'] } },
        })
        if (activePOs > 0) {
            return { success: false, error: `Không thể xoá. NCC đang có ${activePOs} đơn hàng chưa hoàn tất.` }
        }

        await prisma.supplier.update({
            where: { id },
            data: { deletedAt: new Date(), status: 'INACTIVE' },
        })
        revalidatePath('/dashboard/suppliers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
