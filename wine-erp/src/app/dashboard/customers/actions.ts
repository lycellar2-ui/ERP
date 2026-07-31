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
    customerType: string | null
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
    entityType: 'COMPANY' | 'RESTAURANT'
    allowDirectSO: boolean
    brandGroup: string | null
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
            entityType: c.entityType as 'COMPANY' | 'RESTAURANT',
            allowDirectSO: c.allowDirectSO,
            brandGroup: c.brandGroup,
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
        entityType: c.entityType,
        allowDirectSO: c.allowDirectSO,
        brandGroup: c.brandGroup,
        purchasingName: c.purchasingName,
        purchasingPhone: c.purchasingPhone,
        receiverName: c.receiverName,
        receiverPhone: c.receiverPhone,
        deliveryNotes: c.deliveryNotes,
        orderChannel: c.orderChannel,
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
    pendingApproval?: number
    rejected?: number
}

export async function getCustomerStats(): Promise<CustomerStats> {
    await requirePermission('MDM', 'READ')
    const user = await getCurrentUser()
    const userId = user?.id ?? 'guest'

    return cached(`customers:stats:${userId}`, async () => {
        const typeLabels: Record<string, string> = {
            HORECA: 'HORECA', CORPORATE: 'Corporate', RETAIL: 'Retail',
        }

        const where: any = { deletedAt: null }
        if (user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            where.salesRepId = user.id
        }

        const [total, active, pendingApproval, rejected, withCredit, creditSum, typeCounts] = await Promise.all([
            prisma.customer.count({ where }),
            prisma.customer.count({ where: { ...where, status: 'ACTIVE' } }),
            prisma.customer.count({ where: { ...where, status: 'PENDING_APPROVAL' } }),
            prisma.customer.count({ where: { ...where, status: 'REJECTED' } }),
            prisma.customer.count({ where: { ...where, creditLimit: { gt: 0 } } }),
            prisma.customer.aggregate({ where, _sum: { creditLimit: true } }),
            prisma.customer.groupBy({
                by: ['channel'],
                where,
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
                type: t.channel ?? 'N/A',
                label: typeLabels[t.channel ?? ''] ?? t.channel ?? 'N/A',
                count: t._count.id,
            })),
            pendingApproval,
            rejected,
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
            where: { deletedAt: null },
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } },
        })
        return groups.map(g => ({ channel: g.channel, count: g._count.id }))
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
    try {
        const where: any = {
            deletedAt: null,
            status: { in: ['ACTIVE', 'PENDING_APPROVAL'] },
            OR: [
                { entityType: 'COMPANY' },
                { parentId: null }
            ]
        }

        if (currentId) {
            const children = await prisma.customer.findMany({
                where: { parentId: currentId, deletedAt: null },
                select: { id: true }
            })
            const excludeIds = [currentId, ...children.map(c => c.id)]
            where.id = { notIn: excludeIds }
        }

        return await prisma.customer.findMany({
            where,
            select: { id: true, name: true, code: true, entityType: true },
            orderBy: { name: 'asc' },
        })
    } catch (err) {
        console.error('Lỗi getParentCandidates:', err)
        return []
    }
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
    code: z.string().min(3, 'Mã KH bắt buộc').optional(),
    name: z.string().min(2, 'Tên KH bắt buộc'),
    shortName: z.string().nullable().optional(),
    taxId: z.string().nullable().optional(),
    channel: z.enum(['HORECA', 'CORPORATE', 'RETAIL']).default('HORECA'),
    paymentTerm: z.string().default('NET30'),
    creditLimit: z.number().default(0),
    salesRepId: z.string().nullable().optional(),
    status: z.enum(['ACTIVE', 'CREDIT_HOLD', 'INACTIVE', 'PENDING_APPROVAL', 'REJECTED']).default('ACTIVE'),
    parentId: z.string().nullable().optional(),
    contactName: z.string().nullable().optional(),
    email: z.string().email('Email không hợp lệ').nullable().optional(),
    phone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    ward: z.string().nullable().optional(),
    district: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    entityType: z.enum(['COMPANY', 'RESTAURANT']).default('RESTAURANT'),
    allowDirectSO: z.boolean().default(false),
    brandGroup: z.string().nullable().optional(),
    purchasingName: z.string().nullable().optional(),
    purchasingPhone: z.string().nullable().optional(),
    receiverName: z.string().nullable().optional(),
    receiverPhone: z.string().nullable().optional(),
    deliveryNotes: z.string().nullable().optional(),
    orderChannel: z.enum(['ZALO', 'EMAIL', 'WHATSAPP', 'PHONE', 'DIRECT', 'OTHER']).nullable().optional(),
})

export type CustomerInput = z.infer<typeof customerSchema>

export async function createCustomer(input: CustomerInput) {
    try {
        const user = await requirePermission('MDM', 'WRITE')
        
        const isSalesRepUser = user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')

        let inputData = { ...input }

        if (isSalesRepUser) {
            inputData.status = 'PENDING_APPROVAL'
            const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
            inputData.code = `TEMP-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${rand}`
            inputData.salesRepId = user.id
        } else {
            if (!inputData.code || inputData.code.trim() === '') {
                const gen = await getNextCustomerCode({
                    channel: inputData.channel,
                    parentId: inputData.parentId ?? undefined
                })
                if (gen.success && gen.code) {
                    inputData.code = gen.code
                } else {
                    return { success: false, error: 'Không thể tự động khởi tạo mã KH.' }
                }
            }
            if (inputData.code.startsWith('TEMP-')) {
                return { success: false, error: 'Mã KH chính thức không được bắt đầu bằng TEMP-' }
            }
        }

        const data = customerSchema.parse(inputData)
        let salesRepId = data.salesRepId
        if (isSalesRepUser) {
            salesRepId = user.id
        }

        // Check duplicate Tax ID
        if (data.taxId && data.taxId.trim()) {
            const existingTax = await prisma.customer.findFirst({
                where: {
                    deletedAt: null,
                    taxId: { equals: data.taxId.trim(), mode: 'insensitive' }
                },
                select: { code: true, name: true }
            })
            if (existingTax) {
                return {
                    success: false,
                    error: `Mã số thuế '${data.taxId.trim()}' đã tồn tại cho Khách hàng [${existingTax.code}] ${existingTax.name}.`
                }
            }
        }

        const customer = await prisma.$transaction(async (tx) => {
            let finalParentId = data.parentId !== undefined ? data.parentId : null
            let finalCreditLimit = data.creditLimit

            // Business Rule: If Restaurant and no parent is specified, auto-generate a parent Company!
            if (data.entityType === 'RESTAURANT' && !finalParentId) {
                const parentCode = `${data.code}-M`
                let parentCompany = await tx.customer.findUnique({
                    where: { code: parentCode }
                })

                if (!parentCompany) {
                    parentCompany = await tx.customer.create({
                        data: {
                            code: parentCode,
                            name: `${data.name} (Mẹ)`,
                            shortName: data.shortName ? `${data.shortName} (Mẹ)` : null,
                            taxId: data.taxId !== undefined ? data.taxId : null,
                            channel: data.channel,
                            paymentTerm: data.paymentTerm,
                            creditLimit: data.creditLimit,
                            salesRep: salesRepId ? { connect: { id: salesRepId } } : undefined,
                            status: data.status,
                            entityType: 'COMPANY',
                            allowDirectSO: false,
                        }
                    })
                }
                finalParentId = parentCompany.id
                finalCreditLimit = 0 // Inherited from parent
            }

            if (data.entityType === 'COMPANY') {
                finalParentId = null
            }

            const cust = await tx.customer.create({
                data: {
                    code: data.code!,
                    name: data.name,
                    shortName: data.shortName !== undefined ? data.shortName : null,
                    taxId: data.taxId !== undefined ? data.taxId : null,
                    channel: data.channel,
                    paymentTerm: data.paymentTerm,
                    creditLimit: finalCreditLimit,
                    salesRep: salesRepId ? { connect: { id: salesRepId } } : undefined,
                    status: data.status,
                    parent: finalParentId ? { connect: { id: finalParentId } } : undefined,
                    entityType: data.entityType,
                    allowDirectSO: data.entityType === 'COMPANY' ? data.allowDirectSO : false,
                    brandGroup: data.brandGroup !== undefined ? data.brandGroup : null,
                    purchasingName: data.purchasingName !== undefined ? data.purchasingName : null,
                    purchasingPhone: data.purchasingPhone !== undefined ? data.purchasingPhone : null,
                    receiverName: data.receiverName !== undefined ? data.receiverName : null,
                    receiverPhone: data.receiverPhone !== undefined ? data.receiverPhone : null,
                    deliveryNotes: data.deliveryNotes !== undefined ? data.deliveryNotes : null,
                    orderChannel: data.orderChannel !== undefined ? data.orderChannel : null,
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
        logAudit({ userId: user?.id, userName: user?.name, action: 'CREATE', entityType: 'Customer', entityId: customer.id, newValue: { code: data.code, name: data.name, channel: data.channel, creditLimit: Number(data.creditLimit), paymentTerm: data.paymentTerm } })
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
        const oldCustomer = await prisma.customer.findUnique({
            where: { id },
            select: {
                code: true,
                name: true,
                customerType: true,
                creditLimit: true,
                paymentTerm: true,
                channel: true,
                salesRepId: true,
                status: true,
                shortName: true,
                entityType: true,
                allowDirectSO: true,
                parentId: true,
                taxId: true,
            }
        })
        if (!oldCustomer) return { success: false, error: 'Khách hàng không tồn tại' }

        if (user && hasRole(user, 'Sales Rep', 'SALES_REP') && !hasRole(user, 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN', 'CEO', 'Kế Toán', 'KE_TOAN')) {
            if (oldCustomer.salesRepId !== user.id) {
                return { success: false, error: 'Bạn không có quyền chỉnh sửa khách hàng của Sales khác.' }
            }
            if (customerData.salesRepId && customerData.salesRepId !== user.id) {
                return { success: false, error: 'Bạn không thể đổi Sales phụ trách của khách hàng này.' }
            }

            // Apply Sales Rep restrictions on status and code
            if (oldCustomer.status === 'REJECTED') {
                customerData.status = 'PENDING_APPROVAL'
            } else if (oldCustomer.status === 'PENDING_APPROVAL') {
                customerData.status = 'PENDING_APPROVAL'
            } else {
                delete customerData.status
            }
            delete customerData.code
        }

        const updateData: any = {}
        if (customerData.code !== undefined) updateData.code = customerData.code
        if (customerData.name !== undefined) updateData.name = customerData.name
        if (customerData.shortName !== undefined) updateData.shortName = customerData.shortName
        if (customerData.taxId !== undefined) updateData.taxId = customerData.taxId
        if (customerData.channel !== undefined) updateData.channel = customerData.channel
        if (customerData.paymentTerm !== undefined) updateData.paymentTerm = customerData.paymentTerm
        if (customerData.creditLimit !== undefined) updateData.creditLimit = customerData.creditLimit
        if (customerData.salesRepId !== undefined) updateData.salesRepId = customerData.salesRepId
        if (customerData.status !== undefined) updateData.status = customerData.status
        if (customerData.brandGroup !== undefined) updateData.brandGroup = customerData.brandGroup
        if (customerData.entityType !== undefined) updateData.entityType = customerData.entityType
        if (customerData.purchasingName !== undefined) updateData.purchasingName = customerData.purchasingName
        if (customerData.purchasingPhone !== undefined) updateData.purchasingPhone = customerData.purchasingPhone
        if (customerData.receiverName !== undefined) updateData.receiverName = customerData.receiverName
        if (customerData.receiverPhone !== undefined) updateData.receiverPhone = customerData.receiverPhone
        if (customerData.deliveryNotes !== undefined) updateData.deliveryNotes = customerData.deliveryNotes
        if (customerData.orderChannel !== undefined) updateData.orderChannel = customerData.orderChannel

        const currentEntityType = customerData.entityType ?? oldCustomer.entityType
        let finalParentId = customerData.parentId !== undefined ? customerData.parentId : oldCustomer.parentId

        if (currentEntityType === 'COMPANY') {
            updateData.parentId = null
            updateData.allowDirectSO = customerData.allowDirectSO !== undefined ? customerData.allowDirectSO : oldCustomer.allowDirectSO
        } else {
            updateData.allowDirectSO = false
            if (!finalParentId) {
                const codeForParent = customerData.code ?? oldCustomer.code
                const nameForParent = customerData.name ?? oldCustomer.name
                const parentCode = `${codeForParent}-M`
                
                await prisma.$transaction(async (tx) => {
                    let parentCompany = await tx.customer.findUnique({
                        where: { code: parentCode }
                    })

                    if (!parentCompany) {
                        const repId = customerData.salesRepId ?? oldCustomer.salesRepId
                        parentCompany = await tx.customer.create({
                            data: {
                                code: parentCode,
                                name: `${nameForParent} (Mẹ)`,
                                shortName: (customerData.shortName ?? oldCustomer.shortName) ? `${customerData.shortName ?? oldCustomer.shortName} (Mẹ)` : null,
                                taxId: customerData.taxId !== undefined ? customerData.taxId : oldCustomer.taxId,
                                channel: customerData.channel !== undefined ? customerData.channel : oldCustomer.channel,
                                paymentTerm: customerData.paymentTerm ?? oldCustomer.paymentTerm,
                                creditLimit: customerData.creditLimit ?? Number(oldCustomer.creditLimit),
                                salesRep: repId ? { connect: { id: repId } } : undefined,
                                status: customerData.status ?? oldCustomer.status,
                                entityType: 'COMPANY',
                                allowDirectSO: false,
                            }
                        })
                    }
                    updateData.parentId = parentCompany.id
                    updateData.creditLimit = 0 // Inherit
                })
            } else {
                updateData.parentId = finalParentId
            }
        }

        if (updateData.parentId) {
            if (updateData.parentId === id) {
                return { success: false, error: 'Không thể chọn chính mình làm cha' }
            }
            const isChild = await prisma.customer.findFirst({
                where: { id: updateData.parentId, parentId: id, deletedAt: null }
            })
            if (isChild) {
                return { success: false, error: 'Khách hàng được chọn làm cha đang là con của khách hàng này' }
            }
        }

        await prisma.$transaction(async (tx) => {
            const dataToUpdate: any = { ...updateData }
            
            // Connect relation
            if (dataToUpdate.parentId) {
                const pid = dataToUpdate.parentId
                delete dataToUpdate.parentId
                dataToUpdate.parent = { connect: { id: pid } }
            } else if (dataToUpdate.parentId === null) {
                dataToUpdate.parent = { disconnect: true }
            }

            if (dataToUpdate.salesRepId) {
                const srid = dataToUpdate.salesRepId
                delete dataToUpdate.salesRepId
                dataToUpdate.salesRep = { connect: { id: srid } }
            } else if (dataToUpdate.salesRepId === null) {
                dataToUpdate.salesRep = { disconnect: true }
            }

            await tx.customer.update({
                where: { id },
                data: dataToUpdate,
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

// ═══════════════════════════════════════════════════
// APPROVAL WORKFLOW ACTIONS
// ═══════════════════════════════════════════════════

export async function approveCustomer(id: string, officialCode: string) {
    try {
        const user = await requireAuth()
        const isSalesAdmin = hasRole(user, 'Sales Admin', 'SALES_ADMIN', 'ADMIN', 'CEO', 'Sales Manager', 'SALES_MGR', 'Kế Toán', 'KE_TOAN')
        if (!isSalesAdmin) {
            return { success: false, error: 'Bạn không có quyền phê duyệt khách hàng.' }
        }

        const trimmedCode = (officialCode || '').trim().toUpperCase()
        if (!trimmedCode || trimmedCode.length < 3) {
            return { success: false, error: 'Mã KH chính thức phải từ 3 ký tự trở lên' }
        }
        if (trimmedCode.startsWith('TEMP-') || trimmedCode.startsWith('DRAFT-')) {
            return { success: false, error: 'Mã KH chính thức không được bắt đầu bằng TEMP- hoặc DRAFT-' }
        }

        const oldCustomer = await prisma.customer.findUnique({
            where: { id },
            select: { code: true, name: true, status: true, parentId: true }
        })
        if (!oldCustomer) return { success: false, error: 'Khách hàng không tồn tại' }

        if (oldCustomer.status !== 'PENDING_APPROVAL' && oldCustomer.status !== 'REJECTED') {
            return { success: false, error: 'Khách hàng này đã được xử lý hoặc đang hoạt động.' }
        }

        // Check if code already exists
        const codeExists = await prisma.customer.findFirst({
            where: { code: trimmedCode, id: { not: id }, deletedAt: null }
        })
        if (codeExists) {
            return { success: false, error: `Mã KH '${trimmedCode}' đã tồn tại hệ thống. Vui lòng chọn mã khác.` }
        }

        const customer = await prisma.$transaction(async (tx) => {
            const updated = await tx.customer.update({
                where: { id },
                data: {
                    code: trimmedCode,
                    status: 'ACTIVE',
                }
            })

            // If it's a Restaurant and parent was auto-created with a temporary code, we also need to approve the parent!
            if (updated.parentId) {
                const parent = await tx.customer.findUnique({ where: { id: updated.parentId } })
                if (parent && parent.code.startsWith('TEMP-') && (parent.status === 'PENDING_APPROVAL' || parent.status === 'REJECTED')) {
                    const parentOfficialCode = `${trimmedCode}-M`
                    await tx.customer.update({
                        where: { id: parent.id },
                        data: {
                            code: parentOfficialCode,
                            status: 'ACTIVE'
                        }
                    })
                }
            }

            return updated
        })

        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
        logAudit({
            userId: user?.id,
            userName: user?.name,
            action: 'UPDATE',
            entityType: 'Customer',
            entityId: id,
            newValue: { code: trimmedCode, status: 'ACTIVE' }
        })

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message ?? 'Lỗi phê duyệt khách hàng' }
    }
}

export async function rejectCustomer(id: string) {
    try {
        const user = await requireAuth()
        const isSalesAdmin = hasRole(user, 'Sales Admin', 'SALES_ADMIN', 'ADMIN', 'CEO', 'Sales Manager', 'SALES_MGR')
        if (!isSalesAdmin) {
            return { success: false, error: 'Bạn không có quyền từ chối phê duyệt khách hàng.' }
        }

        const oldCustomer = await prisma.customer.findUnique({
            where: { id },
            select: { status: true }
        })
        if (!oldCustomer) return { success: false, error: 'Khách hàng không tồn tại' }

        if (oldCustomer.status !== 'PENDING_APPROVAL') {
            return { success: false, error: 'Chỉ có thể từ chối khách hàng đang chờ duyệt.' }
        }

        await prisma.customer.update({
            where: { id },
            data: { status: 'REJECTED' }
        })

        revalidateCache('customers')
        revalidatePath('/dashboard/customers')
        logAudit({
            userId: user?.id,
            userName: user?.name,
            action: 'UPDATE',
            entityType: 'Customer',
            entityId: id,
            newValue: { status: 'REJECTED' }
        })

        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message ?? 'Lỗi từ chối khách hàng' }
    }
}

// ═══════════════════════════════════════════════════
// AUTO-GENERATE CUSTOMER CODE (Master Data Rules)
// ═══════════════════════════════════════════════════
export async function getNextCustomerCode(params?: { channel?: string; parentId?: string }) {
    try {
        const { channel, parentId } = params ?? {}

        // Case 1: If child customer with a parent
        if (parentId) {
            const parent = await prisma.customer.findUnique({
                where: { id: parentId },
                select: { code: true }
            })
            if (parent) {
                const baseCode = parent.code
                const existingChildren = await prisma.customer.findMany({
                    where: {
                        OR: [
                            { parentId },
                            { code: { startsWith: `${baseCode}-` } }
                        ]
                    },
                    select: { code: true }
                })

                let maxSuffix = 0
                for (const c of existingChildren) {
                    const match = c.code.match(/-(\d+)$/)
                    if (match) {
                        const num = parseInt(match[1], 10)
                        if (!isNaN(num) && num > maxSuffix) maxSuffix = num
                    }
                }
                const nextSuffix = (maxSuffix + 1).toString().padStart(2, '0')
                return { success: true, code: `${baseCode}-${nextSuffix}` }
            }
        }

        // Case 2: Standalone / Parent customer based on channel or customerType
        let prefix = 'HR'
        const ch = (channel || '').toUpperCase()
        if (ch.includes('CORPORATE')) {
            prefix = 'CP'
        } else if (ch.includes('RETAIL')) {
            prefix = 'RT'
        } else {
            prefix = 'HR'
        }

        const customers = await prisma.customer.findMany({
            where: {
                code: { startsWith: prefix }
            },
            select: { code: true }
        })

        let maxNum = 10000 // Base for HR10001 / WS10001 / VIP10001
        for (const c of customers) {
            const match = c.code.slice(prefix.length).match(/^(\d+)(?:-.*)?$/)
            if (match) {
                const num = parseInt(match[1], 10)
                if (!isNaN(num) && num > maxNum) maxNum = num
            }
        }

        const nextCode = `${prefix}${maxNum + 1}`
        return { success: true, code: nextCode }
    } catch (err: any) {
        return { success: false, error: err.message ?? 'Lỗi sinh mã khách hàng' }
    }
}

// ═══════════════════════════════════════════════════
// DUPLICATE CUSTOMER CHECK (Tax ID, Phone, Name)
// ═══════════════════════════════════════════════════
export async function checkCustomerDuplicates(input: {
    taxId?: string | null
    phone?: string | null
    name?: string | null
    excludeId?: string | null
}) {
    try {
        const warnings: { type: 'TAX_ID' | 'PHONE' | 'NAME'; message: string; customer: { id: string; code: string; name: string } }[] = []

        const whereNotId = input.excludeId ? { id: { not: input.excludeId } } : {}

        // 1. Check Tax ID
        if (input.taxId && input.taxId.trim()) {
            const cleanTax = input.taxId.trim()
            const existingTax = await prisma.customer.findFirst({
                where: {
                    ...whereNotId,
                    deletedAt: null,
                    taxId: { equals: cleanTax, mode: 'insensitive' }
                },
                select: { id: true, code: true, name: true }
            })
            if (existingTax) {
                warnings.push({
                    type: 'TAX_ID',
                    message: `Mã số thuế '${cleanTax}' đã tồn tại ở Khách hàng [${existingTax.code}] ${existingTax.name}`,
                    customer: { id: existingTax.id, code: existingTax.code, name: existingTax.name }
                })
            }
        }

        // 2. Check Phone
        if (input.phone && input.phone.trim()) {
            const cleanPhone = input.phone.trim()
            const existingPhoneContact = await prisma.customerContact.findFirst({
                where: {
                    phone: { equals: cleanPhone, mode: 'insensitive' },
                    customer: {
                        deletedAt: null,
                        ...(input.excludeId ? { id: { not: input.excludeId } } : {})
                    }
                },
                include: { customer: { select: { id: true, code: true, name: true } } }
            })
            if (existingPhoneContact) {
                warnings.push({
                    type: 'PHONE',
                    message: `Số điện thoại '${cleanPhone}' đã trùng với SĐT liên hệ của [${existingPhoneContact.customer.code}] ${existingPhoneContact.customer.name}`,
                    customer: { id: existingPhoneContact.customer.id, code: existingPhoneContact.customer.code, name: existingPhoneContact.customer.name }
                })
            }
        }

        // 3. Check Exact Name
        if (input.name && input.name.trim().length >= 3) {
            const cleanName = input.name.trim()
            const existingName = await prisma.customer.findFirst({
                where: {
                    ...whereNotId,
                    deletedAt: null,
                    name: { equals: cleanName, mode: 'insensitive' }
                },
                select: { id: true, code: true, name: true }
            })
            if (existingName) {
                warnings.push({
                    type: 'NAME',
                    message: `Tên khách hàng trùng khớp với [${existingName.code}] ${existingName.name}`,
                    customer: { id: existingName.id, code: existingName.code, name: existingName.name }
                })
            }
        }

        return { success: true, warnings }
    } catch (err: any) {
        return { success: false, error: err.message, warnings: [] }
    }
}
