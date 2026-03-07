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

// ─── Customer Stats (aggregated from DB) ──────────
export type CustomerStats = {
    total: number
    active: number
    withCredit: number
    totalCreditLimit: number
    topTypes: { type: string; label: string; count: number }[]
}

export async function getCustomerStats(): Promise<CustomerStats> {
    return cached('customers:stats', async () => {
        const typeLabels: Record<string, string> = {
            HORECA: 'HORECA', WHOLESALE_DISTRIBUTOR: 'Phân Phối',
            VIP_RETAIL: 'VIP Retail', INDIVIDUAL: 'Cá Nhân',
        }

        const [total, active, withCredit, creditSum, typeCounts] = await Promise.all([
            prisma.customer.count({ where: { deletedAt: null } }),
            prisma.customer.count({ where: { deletedAt: null, status: 'ACTIVE' } }),
            prisma.customer.count({ where: { deletedAt: null, creditLimit: { gt: 0 } } }),
            prisma.customer.aggregate({ where: { deletedAt: null }, _sum: { creditLimit: true } }),
            prisma.customer.groupBy({
                by: ['customerType'],
                where: { deletedAt: null },
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            }),
        ])

        return {
            total,
            active,
            withCredit,
            totalCreditLimit: Number(creditSum._sum.creditLimit ?? 0),
            topTypes: typeCounts.map(t => ({
                type: t.customerType,
                label: typeLabels[t.customerType] ?? t.customerType,
                count: t._count.id,
            })),
        }
    }, 30_000)
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
    // Contact info (optional, auto-creates CustomerContact)
    contactName: z.string().nullable().optional(),
    email: z.string().email('Email không hợp lệ').nullable().optional(),
    phone: z.string().nullable().optional(),
    // Address (optional, auto-creates CustomerAddress)
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
})

export type CustomerInput = z.infer<typeof customerSchema>

export async function createCustomer(input: CustomerInput) {
    try {
        const data = customerSchema.parse(input)
        const customer = await prisma.customer.create({
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

        // Auto-create primary contact if contact info provided
        const hasContact = data.contactName || data.email || data.phone
        if (hasContact) {
            await prisma.customerContact.create({
                data: {
                    customerId: customer.id,
                    name: data.contactName || data.name,
                    email: data.email ?? null,
                    phone: data.phone ?? null,
                    isPrimary: true,
                },
            })
        }

        // Auto-create address if provided
        if (data.address) {
            await prisma.customerAddress.create({
                data: {
                    customerId: customer.id,
                    label: 'Địa chỉ chính',
                    address: data.address,
                    city: data.city ?? null,
                    isDefault: true,
                },
            })
        }

        revalidatePath('/dashboard/customers')
        return { success: true }
    } catch (err: any) {
        if (err?.code === 'P2002') throw new Error('Mã KH đã tồn tại. Vui lòng chọn mã khác.')
        if (err?.issues) {
            const msgs = err.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ')
            throw new Error(`Validation: ${msgs}`)
        }
        throw new Error(err.message ?? 'Lỗi tạo khách hàng')
    }
}

// ── Bulk import from Excel ──────────────────────────
export type ImportResult = {
    success: number
    errors: { row: number; message: string }[]
    total: number
}

export async function bulkImportCustomers(rows: Record<string, any>[]): Promise<ImportResult> {
    const result: ImportResult = { success: 0, errors: [], total: rows.length }
    if (rows.length > 500) {
        result.errors.push({ row: 0, message: 'Tối đa 500 dòng mỗi lần import' })
        return result
    }

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        try {
            const code = String(r['Mã KH'] ?? r['code'] ?? '').trim()
            const name = String(r['Tên KH'] ?? r['name'] ?? '').trim()
            if (!code || !name) { result.errors.push({ row: i + 2, message: 'Thiếu Mã KH hoặc Tên KH' }); continue }

            const typeMap: Record<string, string> = { 'HORECA': 'HORECA', 'Phân Phối': 'WHOLESALE_DISTRIBUTOR', 'VIP Retail': 'VIP_RETAIL', 'Cá Nhân': 'INDIVIDUAL' }
            const rawType = String(r['Loại KH'] ?? r['customerType'] ?? 'HORECA').trim()
            const customerType = typeMap[rawType] ?? rawType
            if (!['HORECA', 'WHOLESALE_DISTRIBUTOR', 'VIP_RETAIL', 'INDIVIDUAL'].includes(customerType)) {
                result.errors.push({ row: i + 2, message: `Loại KH không hợp lệ: ${rawType}` }); continue
            }

            // Check duplicate
            const existing = await prisma.customer.findFirst({ where: { code, deletedAt: null } })
            if (existing) { result.errors.push({ row: i + 2, message: `Mã KH '${code}' đã tồn tại — bỏ qua` }); continue }

            const customer = await prisma.customer.create({
                data: {
                    code,
                    name,
                    customerType: customerType as any,
                    taxId: r['MST'] ?? r['taxId'] ?? null,
                    channel: r['Kênh'] ?? r['channel'] ?? null,
                    paymentTerm: r['Thanh Toán'] ?? r['paymentTerm'] ?? 'NET30',
                    creditLimit: Number(r['Hạn Mức'] ?? r['creditLimit'] ?? 0),
                    status: 'ACTIVE',
                },
            })

            // Contact
            const email = r['Email'] ?? r['email'] ?? null
            const phone = r['SĐT'] ?? r['phone'] ?? null
            const contactName = r['Người Liên Hệ'] ?? r['contactName'] ?? null
            if (email || phone || contactName) {
                await prisma.customerContact.create({
                    data: { customerId: customer.id, name: contactName || name, email, phone, isPrimary: true },
                })
            }

            // Address
            const address = r['Địa Chỉ'] ?? r['address'] ?? null
            if (address) {
                await prisma.customerAddress.create({
                    data: { customerId: customer.id, label: 'Địa chỉ chính', address, city: r['Thành Phố'] ?? r['city'] ?? null, isDefault: true },
                })
            }

            result.success++
        } catch (err: any) {
            result.errors.push({ row: i + 2, message: err.message ?? 'Lỗi không xác định' })
        }
    }

    if (result.success > 0) {
        revalidatePath('/dashboard/customers')
    }
    return result
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
