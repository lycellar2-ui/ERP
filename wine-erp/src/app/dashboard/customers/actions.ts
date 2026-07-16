'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import ExcelJS from 'exceljs'
import path from 'path'
import fs from 'fs'
import { z } from 'zod'
import { cached, revalidateCache } from '@/lib/cache'
import { requireAuth, getCurrentUser, requirePermission, hasRole } from '@/lib/session'
import { logAudit, logAuditWithDiff } from '@/lib/audit'

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type CustomerRow = {
    id: string
    code: string
    name: string
    shortName: string | null
    taxId: string | null
    customerType: string
    channel: string | null
    paymentTerm: string
    creditLimit: number
    salesRepId: string | null
    salesRepName: string | null
    status: string
    orderCount: number
    createdAt: Date
    parentId: string | null
    parentCode: string | null
    parentName: string | null
    childrenCount: number
}

export type CustomerFilters = {
    search?: string
    type?: string
    status?: string
    channel?: string
    page?: number
    pageSize?: number
    sortBy?: 'name' | 'creditLimit' | 'orderCount' | 'createdAt'
    sortDir?: 'asc' | 'desc'
}

// ═══════════════════════════════════════════════════
// LIST — with expanded search, sort, channel filter
// ═══════════════════════════════════════════════════

export async function getCustomers(params?: CustomerFilters): Promise<{ rows: CustomerRow[]; total: number }> {
    await requirePermission('MDM', 'READ')
    const { search, type, status, channel, page = 1, pageSize = 25, sortBy = 'name', sortDir = 'asc' } = params ?? {}

    const isDefaultLoad = page === 1 && !search && !type && !status && !channel && sortBy === 'name' && sortDir === 'asc'

    const fetchData = async () => {
        const where: any = { deletedAt: null }

        const user = await getCurrentUser()
        if (user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            where.salesRepId = user.id
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { taxId: { contains: search, mode: 'insensitive' } },
                { shortName: { contains: search, mode: 'insensitive' } },
                {
                    contacts: {
                        some: {
                            OR: [
                                { email: { contains: search, mode: 'insensitive' } },
                                { phone: { contains: search, mode: 'insensitive' } },
                            ]
                        }
                    }
                },
            ]
        }
        if (type) where.customerType = type
        if (status) where.status = status
        if (channel) where.channel = channel

        // Dynamic sort
        let orderBy: any = { name: 'asc' }
        if (sortBy === 'creditLimit') orderBy = { creditLimit: sortDir }
        else if (sortBy === 'createdAt') orderBy = { createdAt: sortDir }
        else if (sortBy === 'name') orderBy = { name: sortDir }
        // orderCount is computed, sort after fetch for now

        const [items, total] = await Promise.all([
            prisma.customer.findMany({
                where,
                include: {
                    salesRep: { select: { id: true, name: true } },
                    salesOrders: { select: { id: true } },
                    parent: { select: { id: true, name: true, code: true } },
                    children: { where: { deletedAt: null }, select: { id: true } },
                },
                orderBy,
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.customer.count({ where }),
        ])

        let rows: CustomerRow[] = items.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            shortName: c.shortName,
            taxId: c.taxId,
            customerType: c.customerType,
            channel: c.channel,
            paymentTerm: c.paymentTerm,
            creditLimit: Number(c.creditLimit),
            salesRepId: c.salesRepId,
            salesRepName: c.salesRep?.name ?? null,
            status: c.status,
            orderCount: c.salesOrders.length,
            createdAt: c.createdAt,
            parentId: c.parent?.id ?? null,
            parentCode: c.parent?.code ?? null,
            parentName: c.parent?.name ?? null,
            childrenCount: c.children.length,
        }))

        // Client-side sort for computed field
        if (sortBy === 'orderCount') {
            rows.sort((a, b) => sortDir === 'asc' ? a.orderCount - b.orderCount : b.orderCount - a.orderCount)
        }

        return { rows, total }
    }

    if (isDefaultLoad) {
        return cached('customers:list:default', fetchData, 30_000)
    }
    return fetchData()
}

// ═══════════════════════════════════════════════════
// GET BY ID — for Edit mode
// ═══════════════════════════════════════════════════

export async function getCustomerById(id: string) {
    await requirePermission('MDM', 'READ')
    const c = await prisma.customer.findUnique({
        where: { id },
        include: {
            salesRep: { select: { id: true, name: true } },
            contacts: { where: { isPrimary: true }, take: 1 },
            addresses: { where: { isDefault: true }, take: 1 },
        },
    })
    if (!c) return null

    const contact = c.contacts[0]
    const addr = c.addresses[0]

    return {
        id: c.id,
        code: c.code,
        name: c.name,
        shortName: c.shortName,
        taxId: c.taxId,
        customerType: c.customerType,
        channel: c.channel,
        paymentTerm: c.paymentTerm,
        creditLimit: Number(c.creditLimit),
        salesRepId: c.salesRepId,
        status: c.status,
        parentId: c.parentId,
        contactName: contact?.name ?? null,
        contactTitle: contact?.title ?? null,
        email: contact?.email ?? null,
        phone: contact?.phone ?? null,
        address: addr?.address ?? null,
        ward: addr?.ward ?? null,
        district: addr?.district ?? null,
        city: addr?.city ?? null,
    }
}

// ═══════════════════════════════════════════════════
// STATS (aggregated, cached)
// ═══════════════════════════════════════════════════

export type CustomerStats = {
    total: number
    active: number
    withCredit: number
    totalCreditLimit: number
    topTypes: { type: string; label: string; count: number }[]
}

export async function getCustomerStats(): Promise<CustomerStats> {
    await requirePermission('MDM', 'READ')
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

// ═══════════════════════════════════════════════════
// FILTER OPTIONS — dynamic from DB
// ═══════════════════════════════════════════════════

export async function getCustomerChannels(): Promise<{ channel: string; count: number }[]> {
    return cached('customers:channels', async () => {
        const groups = await prisma.customer.groupBy({
            by: ['channel'],
            where: { deletedAt: null, channel: { not: null } },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        })
        return groups.map(g => ({ channel: g.channel!, count: g._count.id }))
    }, 60_000)
}

export async function getSalesRepList(): Promise<{ id: string; name: string }[]> {
    return cached('customers:sales-reps', async () => {
        const users = await prisma.user.findMany({
            where: {
                status: 'ACTIVE',
                roles: { some: { role: { name: { in: ['ADMIN', 'SALES_REP', 'SALES_MANAGER', 'SALES_MGR', 'Sales Rep', 'Sales Manager', 'Sales Admin', 'SALES_ADMIN'] } } } },
            },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        })
        return users.map(u => ({ id: u.id, name: u.name ?? 'Unnamed' }))
    }, 60_000)
}

export async function getParentCandidates(currentId?: string) {
    const where: any = {
        deletedAt: null,
        status: 'ACTIVE',
        customerType: { in: ['HORECA', 'WHOLESALE_DISTRIBUTOR'] },
        parentId: null,
    }

    if (currentId) {
        // Also exclude any children of currentId to avoid circular dependency
        const children = await prisma.customer.findMany({
            where: { parentId: currentId, deletedAt: null },
            select: { id: true }
        })
        const excludeIds = [currentId, ...children.map(c => c.id)]
        where.id = { notIn: excludeIds }
    }

    return prisma.customer.findMany({
        where,
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
    })
}

// ═══════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════

export async function exportCustomersData() {
    await requirePermission('MDM', 'READ')
    const items = await prisma.customer.findMany({
        where: { deletedAt: null },
        include: {
            salesRep: { select: { name: true } },
            contacts: { where: { isPrimary: true }, take: 1 },
            addresses: { where: { isDefault: true }, take: 1 },
            salesOrders: { select: { id: true } },
        },
        orderBy: { name: 'asc' },
    })

    return items.map(c => ({
        'Mã KH': c.code,
        'Tên KH': c.name,
        'Tên viết tắt': c.shortName ?? '',
        'Loại': c.customerType,
        'Kênh': c.channel ?? '',
        'MST': c.taxId ?? '',
        'Thanh Toán': c.paymentTerm,
        'Hạn Mức': Number(c.creditLimit),
        'Sales Rep': c.salesRep?.name ?? '',
        'Trạng Thái': c.status,
        'Số ĐH': c.salesOrders.length,
        'Người liên hệ': c.contacts[0]?.name ?? '',
        'SĐT': c.contacts[0]?.phone ?? '',
        'Email': c.contacts[0]?.email ?? '',
        'Địa chỉ': c.addresses[0]?.address ?? '',
        'Thành phố': c.addresses[0]?.city ?? '',
    }))
}

// ═══════════════════════════════════════════════════
// CREATE + UPDATE (with shortName, salesRepId)
// ═══════════════════════════════════════════════════

const customerSchema = z.object({
    code: z.string().min(3, 'Mã KH bắt buộc'),
    name: z.string().min(2, 'Tên KH bắt buộc'),
    shortName: z.string().nullable().optional(),
    taxId: z.string().nullable().optional(),
    customerType: z.enum(['HORECA', 'WHOLESALE_DISTRIBUTOR', 'VIP_RETAIL', 'INDIVIDUAL']),
    channel: z.enum(['HORECA', 'WHOLESALE_DISTRIBUTOR', 'VIP_RETAIL', 'DIRECT_INDIVIDUAL']).nullable().optional(),
    paymentTerm: z.string().default('NET30'),
    creditLimit: z.number().default(0),
    salesRepId: z.string().nullable().optional(),
    status: z.enum(['ACTIVE', 'CREDIT_HOLD', 'INACTIVE']).default('ACTIVE'),
    parentId: z.string().nullable().optional(),
    contactName: z.string().nullable().optional(),
    email: z.string().email('Email không hợp lệ').nullable().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    ward: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
})

export type CustomerInput = z.infer<typeof customerSchema>

export async function createCustomer(input: CustomerInput) {
    try {
        const user = await requirePermission('MDM', 'WRITE')
        const data = customerSchema.parse(input)

        let salesRepId = data.salesRepId
        if (user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            salesRepId = user.id
        }

        const customer = await prisma.$transaction(async (tx) => {
            const cust = await tx.customer.create({
                data: {
                    code: data.code,
                    name: data.name,
                    shortName: data.shortName !== undefined ? data.shortName : null,
                    taxId: data.taxId !== undefined ? data.taxId : null,
                    customerType: data.customerType,
                    channel: data.channel !== undefined ? data.channel : null,
                    paymentTerm: data.paymentTerm,
                    creditLimit: data.creditLimit,
                    salesRepId: salesRepId !== undefined ? salesRepId : null,
                    status: data.status,
                    parentId: data.parentId !== undefined ? data.parentId : null,
                },
            })

            const hasContact = data.contactName || data.email || data.phone
            if (hasContact) {
                await tx.customerContact.create({
                    data: {
                        customerId: cust.id,
                        name: data.contactName || data.name,
                        email: data.email !== undefined ? data.email : null,
                        phone: data.phone !== undefined ? data.phone : null,
                        isPrimary: true,
                    },
                })
            }

            if (data.address) {
                await tx.customerAddress.create({
                    data: {
                        customerId: cust.id,
                        label: 'Địa chỉ chính',
                        address: data.address,
                        ward: data.ward !== undefined ? data.ward : null,
                        district: data.district !== undefined ? data.district : null,
                        city: data.city !== undefined ? data.city : null,
                        isDefault: true,
                    },
                })
            }
            return cust
        })

        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
        logAudit({ userId: user?.id, userName: user?.name, action: 'CREATE', entityType: 'Customer', entityId: customer.id, newValue: { code: data.code, name: data.name, customerType: data.customerType, creditLimit: Number(data.creditLimit), paymentTerm: data.paymentTerm } })
        return { success: true }
    } catch (err: any) {
        if (err?.code === 'P2002') return { success: false, error: 'Mã KH đã tồn tại. Vui lòng chọn mã khác.' }
        if (err?.issues) {
            const msgs = err.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ')
            return { success: false, error: `Validation: ${msgs}` }
        }
        return { success: false, error: err.message ?? 'Lỗi tạo khách hàng' }
    }
}

export async function updateCustomer(id: string, input: Partial<CustomerInput>) {
    try {
        const user = await requirePermission('MDM', 'WRITE')
        const data = customerSchema.partial().parse(input)
        const { contactName, email, phone, address, ward, district, city, ...customerData } = data
        const oldCustomer = await prisma.customer.findUnique({ where: { id }, select: { code: true, name: true, customerType: true, creditLimit: true, paymentTerm: true, channel: true, salesRepId: true, status: true, shortName: true } })
        if (!oldCustomer) return { success: false, error: 'Khách hàng không tồn tại' }

        if (user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            if (oldCustomer.salesRepId !== user.id) {
                return { success: false, error: 'Bạn không có quyền chỉnh sửa khách hàng của Sales khác.' }
            }
            if (customerData.salesRepId && customerData.salesRepId !== user.id) {
                return { success: false, error: 'Bạn không thể đổi Sales phụ trách của khách hàng này.' }
            }
        }

        const updateData: any = {}
        if (customerData.code !== undefined) updateData.code = customerData.code
        if (customerData.name !== undefined) updateData.name = customerData.name
        if (customerData.shortName !== undefined) updateData.shortName = customerData.shortName
        if (customerData.taxId !== undefined) updateData.taxId = customerData.taxId
        if (customerData.customerType !== undefined) updateData.customerType = customerData.customerType
        if (customerData.channel !== undefined) updateData.channel = customerData.channel
        if (customerData.paymentTerm !== undefined) updateData.paymentTerm = customerData.paymentTerm
        if (customerData.creditLimit !== undefined) updateData.creditLimit = customerData.creditLimit
        if (customerData.salesRepId !== undefined) updateData.salesRepId = customerData.salesRepId
        if (customerData.status !== undefined) updateData.status = customerData.status
        if (customerData.parentId !== undefined) updateData.parentId = customerData.parentId

        if (customerData.parentId) {
            if (customerData.parentId === id) {
                return { success: false, error: 'Không thể chọn chính mình làm cha' }
            }
            // Prevent circular dependency: check if the chosen parent is a child of this customer
            const isChild = await prisma.customer.findFirst({
                where: { id: customerData.parentId, parentId: id, deletedAt: null }
            })
            if (isChild) {
                return { success: false, error: 'Khách hàng được chọn làm cha đang là con của khách hàng này' }
            }
        }

        await prisma.$transaction(async (tx) => {
            await tx.customer.update({
                where: { id },
                data: updateData,
            })

            // Update primary contact if provided
            if (contactName !== undefined || email !== undefined || phone !== undefined) {
                const existing = await tx.customerContact.findFirst({
                    where: { customerId: id, isPrimary: true },
                })
                if (existing) {
                    const contactUpdate: any = {}
                    if (contactName !== undefined) contactUpdate.name = contactName
                    if (email !== undefined) contactUpdate.email = email
                    if (phone !== undefined) contactUpdate.phone = phone
                    await tx.customerContact.update({
                        where: { id: existing.id },
                        data: contactUpdate,
                    })
                } else {
                    await tx.customerContact.create({
                        data: {
                            customerId: id,
                            name: contactName || 'Liên hệ chính',
                            email: email !== undefined ? email : null,
                            phone: phone !== undefined ? phone : null,
                            isPrimary: true,
                        },
                    })
                }
            }

            // Update default address if provided
            if (address !== undefined) {
                const existingAddr = await tx.customerAddress.findFirst({
                    where: { customerId: id, isDefault: true },
                })
                if (existingAddr) {
                    const addrUpdate: any = {}
                    if (address !== undefined) addrUpdate.address = address
                    if (ward !== undefined) addrUpdate.ward = ward
                    if (district !== undefined) addrUpdate.district = district
                    if (city !== undefined) addrUpdate.city = city
                    await tx.customerAddress.update({
                        where: { id: existingAddr.id },
                        data: addrUpdate,
                    })
                } else {
                    await tx.customerAddress.create({
                        data: {
                            customerId: id,
                            label: 'Địa chỉ chính',
                            address: address || '',
                            ward: ward !== undefined ? ward : null,
                            district: district !== undefined ? district : null,
                            city: city !== undefined ? city : null,
                            isDefault: true,
                        },
                    })
                }
            } else {
                if (ward !== undefined || district !== undefined || city !== undefined) {
                    const existingAddr = await tx.customerAddress.findFirst({
                        where: { customerId: id, isDefault: true },
                    })
                    if (existingAddr) {
                        const addrUpdate: any = {}
                        if (ward !== undefined) addrUpdate.ward = ward
                        if (district !== undefined) addrUpdate.district = district
                        if (city !== undefined) addrUpdate.city = city
                        await tx.customerAddress.update({
                            where: { id: existingAddr.id },
                            data: addrUpdate,
                        })
                    }
                }
            }
        })

        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
        const oldPlain = oldCustomer ? JSON.parse(JSON.stringify(oldCustomer)) : null
        logAuditWithDiff({ userId: user?.id, userName: user?.name, action: 'UPDATE', entityType: 'Customer', entityId: id, oldObj: oldPlain, newObj: { ...oldPlain, ...customerData } })
        return { success: true }
    } catch (err: any) {
        if (err?.issues) {
            const msgs = err.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ')
            return { success: false, error: `Validation: ${msgs}` }
        }
        return { success: false, error: err.message ?? 'Lỗi cập nhật KH' }
    }
}

// ═══════════════════════════════════════════════════
// DELETE (soft-delete with SO check)
// ═══════════════════════════════════════════════════

export async function deleteCustomer(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await requirePermission('MDM', 'WRITE')
        const customer = await prisma.customer.findUnique({ where: { id }, select: { code: true, name: true, customerType: true, creditLimit: true, salesRepId: true } })
        if (!customer) return { success: false, error: 'Khách hàng không tồn tại' }

        if (user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            if (customer.salesRepId !== user.id) {
                return { success: false, error: 'Bạn không có quyền xoá khách hàng của Sales khác.' }
            }
        }

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
        logAudit({ userId: user?.id, userName: user?.name, action: 'DELETE', entityType: 'Customer', entityId: id, oldValue: { code: customer?.code, name: customer?.name, customerType: customer?.customerType, creditLimit: customer ? Number(customer.creditLimit) : null } })
        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// BULK IMPORT (from Excel)
// ═══════════════════════════════════════════════════

export type ImportResult = {
    success: number
    errors: { row: number; message: string }[]
    total: number
}

export async function bulkImportCustomers(rows: Record<string, any>[]): Promise<ImportResult> {
    try {
        await requirePermission('MDM', 'WRITE')
    } catch (err: any) {
        return { success: 0, errors: [{ row: 1, message: err.message || 'Không có quyền thực hiện action này' }], total: rows.length }
    }
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

            const existing = await prisma.customer.findFirst({ where: { code, deletedAt: null } })
            if (existing) { result.errors.push({ row: i + 2, message: `Mã KH '${code}' đã tồn tại — bỏ qua` }); continue }

            const customer = await prisma.customer.create({
                data: {
                    code,
                    name,
                    shortName: r['Tên Viết Tắt'] ?? r['shortName'] ?? null,
                    customerType: customerType as any,
                    taxId: r['MST'] ?? r['taxId'] ?? null,
                    channel: r['Kênh'] ?? r['channel'] ?? null,
                    paymentTerm: r['Thanh Toán'] ?? r['paymentTerm'] ?? 'NET30',
                    creditLimit: Number(r['Hạn Mức'] ?? r['creditLimit'] ?? 0),
                    status: 'ACTIVE',
                },
            })

            const emailVal = r['Email'] ?? r['email'] ?? null
            const phoneVal = r['SĐT'] ?? r['phone'] ?? null
            const contactNameVal = r['Người Liên Hệ'] ?? r['contactName'] ?? null
            if (emailVal || phoneVal || contactNameVal) {
                await prisma.customerContact.create({
                    data: { customerId: customer.id, name: contactNameVal || name, email: emailVal, phone: phoneVal, isPrimary: true },
                })
            }

            const addressVal = r['Địa Chỉ'] ?? r['address'] ?? null
            if (addressVal) {
                await prisma.customerAddress.create({
                    data: { customerId: customer.id, label: 'Địa chỉ chính', address: addressVal, city: r['Thành Phố'] ?? r['city'] ?? null, isDefault: true },
                })
            }

            result.success++
        } catch (err: any) {
            result.errors.push({ row: i + 2, message: err.message ?? 'Lỗi không xác định' })
        }
    }

    if (result.success > 0) {
        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
    }
    return result
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
        await requirePermission('MDM', 'WRITE')
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
        await requirePermission('MDM', 'WRITE')
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
        await requirePermission('MDM', 'WRITE')
        await prisma.customerAddress.delete({ where: { id } })
        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function exportCustomerOnboardingForm(customerId: string): Promise<{ success: boolean; data?: string; filename?: string; error?: string }> {
    try {
        await requirePermission('MDM', 'READ')
        const c = await prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                salesRep: { select: { name: true } },
                contacts: { where: { isPrimary: true }, take: 1 },
                addresses: { where: { isDefault: true }, take: 1 },
            }
        })
        if (!c) throw new Error('Không tìm thấy khách hàng')

        const contact = c.contacts[0]
        const addr = c.addresses[0]

        // Load the template
        const templatePath = path.join(process.cwd(), 'public', 'templates', 'Form_8.8-A_Yeu_cau_Tao_ma_KH.xlsx')
        if (!fs.existsSync(templatePath)) {
            throw new Error(`Không tìm thấy file mẫu tại ${templatePath}`)
        }

        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.readFile(templatePath)
        const worksheet = workbook.getWorksheet(1)
        if (!worksheet) throw new Error('Không tìm thấy sheet trong file mẫu')

        // Fill cells
        worksheet.getCell('L2').value = c.salesRep?.name || ''
        worksheet.getCell('L4').value = new Date().toLocaleDateString('vi-VN')
        
        // Section I
        worksheet.getCell('A13').value = c.name
        worksheet.getCell('B13').value = addr
            ? `${addr.address}${addr.ward ? ', ' + addr.ward : ''}${addr.district ? ', ' + addr.district : ''}${addr.city ? ', ' + addr.city : ''}`
            : ''
        worksheet.getCell('E13').value = contact?.name || ''
        worksheet.getCell('F13').value = contact?.phone || ''
        worksheet.getCell('H13').value = contact?.name || ''
        worksheet.getCell('I13').value = contact?.phone || ''
        worksheet.getCell('K13').value = contact?.email || ''

        // Section B
        worksheet.getCell('B16').value = addr?.city === 'Hồ Chí Minh' || addr?.city === 'Hà Nội' ? 'Việt Nam' : ''
        worksheet.getCell('B18').value = addr?.city || ''
        worksheet.getCell('B19').value = addr?.ward || ''
        worksheet.getCell('H16').value = c.channel || ''
        
        // Section II
        worksheet.getCell('E25').value = c.paymentTerm || 'NET30'
        worksheet.getCell('N26').value = c.taxId || ''

        // Save workbook to buffer and return as base64 string
        const buffer = await workbook.xlsx.writeBuffer()
        const base64 = Buffer.from(buffer as ArrayBuffer).toString('base64')

        return {
            success: true,
            data: base64,
            filename: `Form_8.8-A_Yeu_cau_Tao_ma_KH_${c.code || 'KH'}.xlsx`
        }
    } catch (err: any) {
        console.error("Lỗi xuất Excel form:", err)
        return { success: false, error: err.message }
    }
}
