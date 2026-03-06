'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cached, revalidateCache } from '@/lib/cache'

export type CustomerRow = {
    id: string
    code: string
    name: string
    taxId: string | null
    customerType: string
    channel: string | null
    paymentTerm: string
    creditLimit: number
    salesRepName: string | null
    status: string
    orderCount: number
    createdAt: Date
}

export async function getCustomers(params?: {
    search?: string; type?: string; status?: string; channel?: string; page?: number; pageSize?: number
}): Promise<{ rows: CustomerRow[]; total: number }> {
    const { search, type, status, channel, page = 1, pageSize = 25 } = params ?? {}
    const where: any = { deletedAt: null }
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
        ]
    }
    if (type) where.customerType = type
    if (status) where.status = status
    if (channel) where.channel = channel

    const [items, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            include: {
                salesRep: { select: { name: true } },
                salesOrders: { select: { id: true } },
            },
            orderBy: { name: 'asc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.customer.count({ where }),
    ])

    return {
        rows: items.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            taxId: c.taxId,
            customerType: c.customerType,
            channel: c.channel,
            paymentTerm: c.paymentTerm,
            creditLimit: Number(c.creditLimit),
            salesRepName: c.salesRep?.name ?? null,
            status: c.status,
            orderCount: c.salesOrders.length,
            createdAt: c.createdAt,
        })),
        total,
    }
}

const customerSchema = z.object({
    code: z.string().min(3, 'Mã KH bắt buộc'),
    name: z.string().min(2, 'Tên KH bắt buộc'),
    taxId: z.string().nullable().optional(),
    customerType: z.enum(['HORECA', 'WHOLESALE_DISTRIBUTOR', 'VIP_RETAIL', 'INDIVIDUAL']),
    channel: z.enum(['HORECA', 'WHOLESALE_DISTRIBUTOR', 'VIP_RETAIL', 'DIRECT_INDIVIDUAL']).nullable().optional(),
    paymentTerm: z.string().default('NET30'),
    creditLimit: z.number().default(0),
    status: z.enum(['ACTIVE', 'CREDIT_HOLD', 'INACTIVE']).default('ACTIVE'),
})

export type CustomerInput = z.infer<typeof customerSchema>

export async function createCustomer(input: CustomerInput) {
    const data = customerSchema.parse(input)
    await prisma.customer.create({
        data: {
            code: data.code,
            name: data.name,
            taxId: data.taxId ?? null,
            customerType: data.customerType,
            channel: data.channel ?? null,
            paymentTerm: data.paymentTerm,
            creditLimit: data.creditLimit,
            status: data.status,
        },
    })
    revalidatePath('/dashboard/customers')
    return { success: true }
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>) {
    await prisma.customer.update({ where: { id }, data: input as any })
    revalidatePath('/dashboard/customers')
    return { success: true }
}

// ── Soft delete customer ──────────────────────────
export async function deleteCustomer(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const activeSOs = await prisma.salesOrder.count({
            where: { customerId: id, status: { notIn: ['PAID', 'CANCELLED'] } },
        })
        if (activeSOs > 0) {
            return { success: false, error: `Không thể xoá. KH đang có ${activeSOs} đơn hàng chưa hoàn tất.` }
        }

        await prisma.customer.update({
            where: { id },
            data: { deletedAt: new Date(), status: 'INACTIVE' },
        })
        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// CUSTOMER ADDRESS CRUD
// ═══════════════════════════════════════════════════

export async function getCustomerAddresses(customerId: string) {
    return prisma.customerAddress.findMany({
        where: { customerId },
        orderBy: [{ isDefault: 'desc' }],
    })
}

export async function createCustomerAddress(input: {
    customerId: string
    label: string
    address: string
    ward?: string
    district?: string
    city?: string
    isBilling?: boolean
    isDefault?: boolean
}): Promise<{ success: boolean; error?: string }> {
    try {
        if (input.isDefault) {
            await prisma.customerAddress.updateMany({
                where: { customerId: input.customerId, isDefault: true },
                data: { isDefault: false },
            })
        }

        await prisma.customerAddress.create({
            data: {
                customerId: input.customerId,
                label: input.label,
                address: input.address,
                ward: input.ward ?? null,
                district: input.district ?? null,
                city: input.city ?? null,
                isBilling: input.isBilling ?? false,
                isDefault: input.isDefault ?? false,
            },
        })
        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function updateCustomerAddress(
    id: string,
    input: {
        label?: string
        address?: string
        ward?: string | null
        district?: string | null
        city?: string | null
        isBilling?: boolean
        isDefault?: boolean
    }
): Promise<{ success: boolean; error?: string }> {
    try {
        if (input.isDefault) {
            const addr = await prisma.customerAddress.findUnique({ where: { id } })
            if (addr) {
                await prisma.customerAddress.updateMany({
                    where: { customerId: addr.customerId, isDefault: true },
                    data: { isDefault: false },
                })
            }
        }

        await prisma.customerAddress.update({ where: { id }, data: input as any })
        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteCustomerAddress(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.customerAddress.delete({ where: { id } })
        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
