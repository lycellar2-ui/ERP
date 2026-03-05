'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

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

export async function getCustomers(search?: string): Promise<CustomerRow[]> {
    const where: any = { deletedAt: null }
    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
        ]
    }
    const items = await prisma.customer.findMany({
        where,
        include: {
            salesRep: { select: { name: true } },
            salesOrders: { select: { id: true } },
        },
        orderBy: { name: 'asc' },
    })
    return items.map(c => ({
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
    }))
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
