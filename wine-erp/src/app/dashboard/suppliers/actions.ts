'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { cached, revalidateCache } from '@/lib/cache'
import { requireAuth, getCurrentUser } from '@/lib/session'
import { logAudit, logAuditWithDiff } from '@/lib/audit'

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

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
    contactName: string | null
    contactEmail: string | null
    createdAt: Date
}

export type SupplierFilters = {
    search?: string
    type?: string
    status?: string
    country?: string
    page?: number
    pageSize?: number
    sortBy?: 'name' | 'poCount' | 'leadTimeDays' | 'createdAt'
    sortDir?: 'asc' | 'desc'
}

// ═══════════════════════════════════════════════════
// LIST — with expanded search, sort, country filter
// ═══════════════════════════════════════════════════

export async function getSuppliers(params?: SupplierFilters): Promise<{ rows: SupplierRow[]; total: number }> {
    const { search, type, status, country, page = 1, pageSize = 25, sortBy = 'name', sortDir = 'asc' } = params ?? {}
    const where: any = { deletedAt: null }

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
            { taxId: { contains: search, mode: 'insensitive' } },
            {
                contacts: {
                    some: {
                        OR: [
                            { email: { contains: search, mode: 'insensitive' } },
                            { phone: { contains: search, mode: 'insensitive' } },
                            { name: { contains: search, mode: 'insensitive' } },
                        ]
                    }
                }
            },
        ]
    }
    if (type) where.type = type
    if (status) where.status = status
    if (country) where.country = country

    let orderBy: any = { name: 'asc' }
    if (sortBy === 'leadTimeDays') orderBy = { leadTimeDays: sortDir }
    else if (sortBy === 'createdAt') orderBy = { createdAt: sortDir }
    else if (sortBy === 'name') orderBy = { name: sortDir }

    const [items, total] = await Promise.all([
        prisma.supplier.findMany({
            where,
            include: {
                purchaseOrders: { select: { id: true } },
                contacts: { where: { isPrimary: true }, take: 1 },
            },
            orderBy,
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        prisma.supplier.count({ where }),
    ])

    let rows: SupplierRow[] = items.map(s => ({
        id: s.id, code: s.code, name: s.name, type: s.type,
        country: s.country, taxId: s.taxId,
        tradeAgreement: s.tradeAgreement, coFormType: s.coFormType,
        paymentTerm: s.paymentTerm, defaultCurrency: s.defaultCurrency,
        incoterms: s.incoterms, leadTimeDays: s.leadTimeDays ?? 45,
        status: s.status, poCount: s.purchaseOrders.length,
        contactName: s.contacts[0]?.name ?? null,
        contactEmail: s.contacts[0]?.email ?? null,
        createdAt: s.createdAt,
    }))

    if (sortBy === 'poCount') {
        rows.sort((a, b) => sortDir === 'asc' ? a.poCount - b.poCount : b.poCount - a.poCount)
    }

    return { rows, total }
}

// ═══════════════════════════════════════════════════
// GET BY ID — for Edit mode + Detail view
// ═══════════════════════════════════════════════════

export async function getSupplierById(id: string) {
    const s = await prisma.supplier.findUnique({
        where: { id },
        include: {
            contacts: { where: { isPrimary: true }, take: 1 },
            addresses: { where: { isDefault: true }, take: 1 },
        },
    })
    if (!s) return null

    const contact = s.contacts[0]
    const addr = s.addresses[0]

    return {
        id: s.id, code: s.code, name: s.name, type: s.type,
        country: s.country, taxId: s.taxId,
        tradeAgreement: s.tradeAgreement, coFormType: s.coFormType,
        paymentTerm: s.paymentTerm, defaultCurrency: s.defaultCurrency,
        incoterms: s.incoterms, leadTimeDays: s.leadTimeDays,
        status: s.status, website: s.website, notes: s.notes,
        contactName: contact?.name ?? null,
        contactTitle: contact?.title ?? null,
        contactEmail: contact?.email ?? null,
        contactPhone: contact?.phone ?? null,
        addressLabel: addr?.label ?? null,
        address: addr?.address ?? null,
        city: addr?.city ?? null,
        region: addr?.region ?? null,
        addressCountry: addr?.country ?? null,
    }
}

// ═══════════════════════════════════════════════════
// DETAIL — full 360° data for detail drawer
// ═══════════════════════════════════════════════════

export type SupplierDetail = {
    supplier: NonNullable<Awaited<ReturnType<typeof getSupplierById>>>
    contacts: { id: string; name: string; title: string | null; phone: string | null; email: string | null; isPrimary: boolean }[]
    addresses: { id: string; label: string; address: string; city: string | null; region: string | null; country: string | null; isDefault: boolean }[]
    poSummary: { total: number; totalValue: number; statuses: { status: string; count: number }[] }
    apSummary: { totalInvoices: number; totalAmount: number; unpaidAmount: number }
    contractCount: number
    shipmentCount: number
    productCount: number
}

export async function getSupplierDetail(id: string): Promise<SupplierDetail | null> {
    const supplier = await getSupplierById(id)
    if (!supplier) return null

    const [contacts, addresses, pos, apInvoices, contractCount, shipmentCount] = await Promise.all([
        prisma.supplierContact.findMany({
            where: { supplierId: id },
            orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
        }),
        prisma.supplierAddress.findMany({
            where: { supplierId: id },
            orderBy: [{ isDefault: 'desc' }],
        }),
        prisma.purchaseOrder.findMany({
            where: { supplierId: id },
            include: { lines: { select: { qtyOrdered: true, unitPrice: true } } },
        }),
        prisma.aPInvoice.findMany({
            where: { supplierId: id },
            select: { amount: true, status: true, currency: true },
        }),
        prisma.contract.count({ where: { supplierId: id } }),
        prisma.shipment.count({ where: { po: { supplierId: id } } }),
    ])

    // PO summary
    let totalPOValue = 0
    const statusMap: Record<string, number> = {}
    for (const po of pos) {
        statusMap[po.status] = (statusMap[po.status] ?? 0) + 1
        for (const line of po.lines) {
            totalPOValue += Number(line.qtyOrdered) * Number(line.unitPrice) * Number(po.exchangeRate)
        }
    }

    // AP summary
    let totalAPAmount = 0
    let unpaidAPAmount = 0
    for (const inv of apInvoices) {
        const amt = Number(inv.amount)
        totalAPAmount += amt
        if (inv.status === 'OVERDUE' || inv.status === 'PARTIALLY_PAID') unpaidAPAmount += amt
    }

    // Unique products
    const productIds = new Set<string>()
    for (const po of pos) {
        const poLines = await prisma.purchaseOrderLine.findMany({
            where: { poId: po.id },
            select: { productId: true },
        })
        poLines.forEach(l => productIds.add(l.productId))
    }

    return {
        supplier,
        contacts: contacts.map(c => ({ id: c.id, name: c.name, title: c.title, phone: c.phone, email: c.email, isPrimary: c.isPrimary })),
        addresses: addresses.map(a => ({ id: a.id, label: a.label, address: a.address, city: a.city, region: a.region, country: a.country, isDefault: a.isDefault })),
        poSummary: {
            total: pos.length,
            totalValue: Math.round(totalPOValue),
            statuses: Object.entries(statusMap).map(([status, count]) => ({ status, count })),
        },
        apSummary: {
            totalInvoices: apInvoices.length,
            totalAmount: Math.round(totalAPAmount),
            unpaidAmount: Math.round(unpaidAPAmount),
        },
        contractCount,
        shipmentCount,
        productCount: productIds.size,
    }
}

// ═══════════════════════════════════════════════════
// STATS (aggregated, cached)
// ═══════════════════════════════════════════════════

export type SupplierStats = {
    total: number
    active: number
    countries: number
    avgLeadTime: number
    topTypes: { type: string; label: string; count: number }[]
}

export async function getSupplierStats(): Promise<SupplierStats> {
    return cached('suppliers:stats', async () => {
        const typeLabels: Record<string, string> = {
            WINERY: 'Winery', NEGOCIANT: 'Négociant', DISTRIBUTOR: 'Distributor',
            LOGISTICS: 'Logistics', FORWARDER: 'Forwarder', CUSTOMS_BROKER: 'Customs Broker',
        }
        const where = { deletedAt: null } as const

        const [total, active, leadTimeAgg, countriesRaw, typeCounts] = await Promise.all([
            prisma.supplier.count({ where }),
            prisma.supplier.count({ where: { ...where, status: 'ACTIVE' } }),
            prisma.supplier.aggregate({ where, _avg: { leadTimeDays: true } }),
            prisma.supplier.findMany({ where, select: { country: true }, distinct: ['country'] }),
            prisma.supplier.groupBy({
                by: ['type'],
                where,
                _count: { id: true },
                orderBy: { _count: { id: 'desc' } },
            }),
        ])

        return {
            total,
            active,
            countries: countriesRaw.length,
            avgLeadTime: Math.round(leadTimeAgg._avg.leadTimeDays ?? 45),
            topTypes: typeCounts.map(t => ({
                type: t.type,
                label: typeLabels[t.type] ?? t.type,
                count: t._count.id,
            })),
        }
    }, 30_000)
}

// ═══════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════

export async function exportSuppliersData() {
    const items = await prisma.supplier.findMany({
        where: { deletedAt: null },
        include: {
            contacts: { where: { isPrimary: true }, take: 1 },
            addresses: { where: { isDefault: true }, take: 1 },
            purchaseOrders: { select: { id: true } },
        },
        orderBy: { name: 'asc' },
    })

    return items.map(s => ({
        'Mã NCC': s.code,
        'Tên NCC': s.name,
        'Loại': s.type,
        'Quốc Gia': s.country,
        'MST': s.taxId ?? '',
        'Hiệp Định': s.tradeAgreement ?? '',
        'C/O Form': s.coFormType ?? '',
        'Thanh Toán': s.paymentTerm ?? '',
        'Tiền Tệ': s.defaultCurrency,
        'Incoterms': s.incoterms ?? '',
        'Lead Time': s.leadTimeDays,
        'Trạng Thái': s.status,
        'Số PO': s.purchaseOrders.length,
        'Người liên hệ': s.contacts[0]?.name ?? '',
        'SĐT': s.contacts[0]?.phone ?? '',
        'Email': s.contacts[0]?.email ?? '',
        'Địa chỉ': s.addresses[0]?.address ?? '',
        'Website': s.website ?? '',
    }))
}

// ═══════════════════════════════════════════════════
// CREATE + UPDATE
// ═══════════════════════════════════════════════════

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
    website: z.string().nullable().optional(),
    notes: z.string().nullable().optional(),
    // Flattened contact fields
    contactName: z.string().nullable().optional(),
    contactTitle: z.string().nullable().optional(),
    contactEmail: z.string().nullable().optional(),
    contactPhone: z.string().nullable().optional(),
    // Flattened address fields
    address: z.string().nullable().optional(),
    city: z.string().nullable().optional(),
    region: z.string().nullable().optional(),
})

export type SupplierInput = z.infer<typeof supplierSchema>

export async function createSupplier(input: SupplierInput) {
    try {
        await requireAuth()
        const data = supplierSchema.parse(input)
        const supplier = await prisma.supplier.create({
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
                website: data.website ?? null,
                notes: data.notes ?? null,
            },
        })

        const hasContact = data.contactName || data.contactEmail || data.contactPhone
        if (hasContact) {
            await prisma.supplierContact.create({
                data: {
                    supplierId: supplier.id,
                    name: data.contactName || data.name,
                    title: data.contactTitle ?? null,
                    email: data.contactEmail ?? null,
                    phone: data.contactPhone ?? null,
                    isPrimary: true,
                },
            })
        }

        if (data.address) {
            await prisma.supplierAddress.create({
                data: {
                    supplierId: supplier.id,
                    label: 'Trụ sở chính',
                    address: data.address,
                    city: data.city ?? null,
                    region: data.region ?? null,
                    country: data.country,
                    isDefault: true,
                },
            })
        }

        revalidateCache('suppliers')
        revalidatePath('/dashboard/suppliers')
        const user = await getCurrentUser().catch(() => null)
        logAudit({ userId: user?.id, userName: user?.name, action: 'CREATE', entityType: 'Supplier', entityId: supplier.id, newValue: { code: data.code, name: data.name, type: data.type, country: data.country, defaultCurrency: data.defaultCurrency } })
        return { success: true }
    } catch (err: any) {
        if (err?.code === 'P2002') return { success: false, error: 'Mã NCC đã tồn tại. Vui lòng chọn mã khác.' }
        if (err?.issues) {
            const msgs = err.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join(', ')
            return { success: false, error: `Validation: ${msgs}` }
        }
        return { success: false, error: err.message ?? 'Lỗi tạo NCC' }
    }
}

export async function updateSupplier(id: string, input: Partial<SupplierInput>) {
    try {
        const { contactName, contactTitle, contactEmail, contactPhone, address, city, region, ...supplierData } = input
        const oldSupplier = await prisma.supplier.findUnique({ where: { id }, select: { code: true, name: true, type: true, paymentTerm: true, defaultCurrency: true, incoterms: true, leadTimeDays: true, status: true } })

        await prisma.supplier.update({
            where: { id },
            data: supplierData as any,
        })

        // Update primary contact if provided
        if (contactName || contactEmail || contactPhone) {
            const existing = await prisma.supplierContact.findFirst({
                where: { supplierId: id, isPrimary: true },
            })
            if (existing) {
                await prisma.supplierContact.update({
                    where: { id: existing.id },
                    data: {
                        name: contactName || undefined,
                        title: contactTitle ?? undefined,
                        email: contactEmail ?? undefined,
                        phone: contactPhone ?? undefined,
                    },
                })
            } else {
                await prisma.supplierContact.create({
                    data: {
                        supplierId: id,
                        name: contactName || 'Liên hệ chính',
                        title: contactTitle ?? null,
                        email: contactEmail ?? null,
                        phone: contactPhone ?? null,
                        isPrimary: true,
                    },
                })
            }
        }

        // Update default address if provided
        if (address) {
            const existingAddr = await prisma.supplierAddress.findFirst({
                where: { supplierId: id, isDefault: true },
            })
            if (existingAddr) {
                await prisma.supplierAddress.update({
                    where: { id: existingAddr.id },
                    data: { address, city: city ?? undefined, region: region ?? undefined },
                })
            } else {
                await prisma.supplierAddress.create({
                    data: {
                        supplierId: id,
                        label: 'Trụ sở chính',
                        address,
                        city: city ?? null,
                        region: region ?? null,
                        country: (supplierData as any).country ?? null,
                        isDefault: true,
                    },
                })
            }
        }

        revalidateCache('suppliers')
        revalidatePath('/dashboard/suppliers')
        const user = await getCurrentUser().catch(() => null)
        const oldPlain = oldSupplier ? JSON.parse(JSON.stringify(oldSupplier)) : null
        logAuditWithDiff({ userId: user?.id, userName: user?.name, action: 'UPDATE', entityType: 'Supplier', entityId: id, oldObj: oldPlain, newObj: { ...oldPlain, ...supplierData } })
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message ?? 'Lỗi cập nhật NCC' }
    }
}

// ═══════════════════════════════════════════════════
// DELETE (soft-delete with PO check)
// ═══════════════════════════════════════════════════

export async function deleteSupplier(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supplier = await prisma.supplier.findUnique({ where: { id }, select: { code: true, name: true, type: true, status: true } })
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
        const user = await getCurrentUser().catch(() => null)
        logAudit({ userId: user?.id, userName: user?.name, action: 'DELETE', entityType: 'Supplier', entityId: id, oldValue: { code: supplier?.code, name: supplier?.name, type: supplier?.type } })
        revalidateCache('suppliers')
        revalidatePath('/dashboard/suppliers')
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

export async function bulkImportSuppliers(rows: Record<string, any>[]): Promise<ImportResult> {
    const result: ImportResult = { success: 0, errors: [], total: rows.length }
    if (rows.length > 500) {
        result.errors.push({ row: 0, message: 'Tối đa 500 dòng mỗi lần import' })
        return result
    }

    const validTypes = ['WINERY', 'NEGOCIANT', 'DISTRIBUTOR', 'LOGISTICS', 'FORWARDER', 'CUSTOMS_BROKER']
    const typeMap: Record<string, string> = {
        'Winery': 'WINERY', 'Négociant': 'NEGOCIANT', 'Distributor': 'DISTRIBUTOR',
        'Logistics': 'LOGISTICS', 'Forwarder': 'FORWARDER', 'Customs Broker': 'CUSTOMS_BROKER',
    }

    for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        try {
            const code = String(r['Mã NCC'] ?? r['code'] ?? '').trim()
            const name = String(r['Tên NCC'] ?? r['name'] ?? '').trim()
            if (!code || !name) { result.errors.push({ row: i + 2, message: 'Thiếu Mã NCC hoặc Tên NCC' }); continue }

            const rawType = String(r['Loại'] ?? r['type'] ?? 'WINERY').trim()
            const supplierType = typeMap[rawType] ?? rawType
            if (!validTypes.includes(supplierType)) {
                result.errors.push({ row: i + 2, message: `Loại NCC không hợp lệ: ${rawType}` }); continue
            }

            const country = String(r['Quốc Gia'] ?? r['country'] ?? '').trim()
            if (!country || country.length !== 2) {
                result.errors.push({ row: i + 2, message: 'Quốc gia phải là mã 2 ký tự (FR, IT, US...)' }); continue
            }

            const existing = await prisma.supplier.findFirst({ where: { code, deletedAt: null } })
            if (existing) { result.errors.push({ row: i + 2, message: `Mã NCC '${code}' đã tồn tại — bỏ qua` }); continue }

            const supplier = await prisma.supplier.create({
                data: {
                    code,
                    name,
                    type: supplierType as any,
                    country: country.toUpperCase(),
                    taxId: r['MST'] ?? r['taxId'] ?? null,
                    tradeAgreement: r['Hiệp Định'] ?? r['tradeAgreement'] ?? null,
                    paymentTerm: r['Thanh Toán'] ?? r['paymentTerm'] ?? null,
                    defaultCurrency: r['Tiền Tệ'] ?? r['currency'] ?? 'USD',
                    incoterms: r['Incoterms'] ?? r['incoterms'] ?? null,
                    leadTimeDays: Number(r['Lead Time'] ?? r['leadTimeDays'] ?? 45),
                    website: r['Website'] ?? r['website'] ?? null,
                    status: 'ACTIVE',
                },
            })

            const contactNameVal = r['Người Liên Hệ'] ?? r['contactName'] ?? null
            const emailVal = r['Email'] ?? r['email'] ?? null
            const phoneVal = r['SĐT'] ?? r['phone'] ?? null
            if (contactNameVal || emailVal || phoneVal) {
                await prisma.supplierContact.create({
                    data: { supplierId: supplier.id, name: contactNameVal || name, email: emailVal, phone: phoneVal, isPrimary: true },
                })
            }

            result.success++
        } catch (err: any) {
            result.errors.push({ row: i + 2, message: err.message ?? 'Lỗi không xác định' })
        }
    }

    if (result.success > 0) {
        revalidateCache('suppliers')
        revalidatePath('/dashboard/suppliers')
    }
    return result
}

// ═══════════════════════════════════════════════════
// SUPPLIER PO HISTORY
// ═══════════════════════════════════════════════════

export type SupplierPO = {
    id: string; poNo: string; status: string; currency: string
    totalValue: number; linesCount: number; createdAt: Date
    estimatedDelivery: Date | null; receivedAt: Date | null
}

export async function getSupplierPOs(supplierId: string): Promise<SupplierPO[]> {
    const pos = await prisma.purchaseOrder.findMany({
        where: { supplierId },
        include: { lines: { select: { qtyOrdered: true, unitPrice: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })

    return pos.map(po => ({
        id: po.id,
        poNo: po.poNo,
        status: po.status,
        currency: po.currency,
        totalValue: po.lines.reduce((sum, l) => sum + Number(l.qtyOrdered) * Number(l.unitPrice), 0),
        linesCount: po.lines.length,
        createdAt: po.createdAt,
        estimatedDelivery: po.estimatedDelivery,
        receivedAt: po.receivedAt,
    }))
}

// ═══════════════════════════════════════════════════
// SUPPLIER AP INVOICES
// ═══════════════════════════════════════════════════

export type SupplierAPInvoice = {
    id: string; invoiceNo: string; poNo: string
    amount: number; currency: string; dueDate: Date
    status: string; createdAt: Date
}

export async function getSupplierAPInvoices(supplierId: string): Promise<SupplierAPInvoice[]> {
    const invoices = await prisma.aPInvoice.findMany({
        where: { supplierId },
        include: { po: { select: { poNo: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })

    return invoices.map(inv => ({
        id: inv.id,
        invoiceNo: inv.invoiceNo,
        poNo: inv.po.poNo,
        amount: Number(inv.amount),
        currency: inv.currency,
        dueDate: inv.dueDate,
        status: inv.status,
        createdAt: inv.createdAt,
    }))
}

// ═══════════════════════════════════════════════════
// SUPPLIER CONTRACTS
// ═══════════════════════════════════════════════════

export type SupplierContract = {
    id: string; contractNo: string; type: string; value: number
    currency: string; startDate: Date; endDate: Date; status: string
}

export async function getSupplierContracts(supplierId: string): Promise<SupplierContract[]> {
    const contracts = await prisma.contract.findMany({
        where: { supplierId },
        orderBy: { startDate: 'desc' },
        take: 50,
    })

    return contracts.map(c => ({
        id: c.id, contractNo: c.contractNo, type: c.type,
        value: Number(c.value), currency: c.currency,
        startDate: c.startDate, endDate: c.endDate, status: c.status,
    }))
}

// ═══════════════════════════════════════════════════
// SUPPLIER SHIPMENTS
// ═══════════════════════════════════════════════════

export type SupplierShipment = {
    id: string; billOfLading: string; poNo: string
    vesselName: string | null; eta: Date | null
    cifAmount: number; status: string; createdAt: Date
}

export async function getSupplierShipments(supplierId: string): Promise<SupplierShipment[]> {
    const shipments = await prisma.shipment.findMany({
        where: { po: { supplierId } },
        include: { po: { select: { poNo: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
    })

    return shipments.map(s => ({
        id: s.id, billOfLading: s.billOfLading, poNo: s.po.poNo,
        vesselName: s.vesselName, eta: s.eta,
        cifAmount: Number(s.cifAmount), status: s.status, createdAt: s.createdAt,
    }))
}

// ═══════════════════════════════════════════════════
// SUPPLIER PRODUCTS (via PO lines)
// ═══════════════════════════════════════════════════

export type SupplierProduct = {
    id: string; skuCode: string; productName: string
    totalQty: number; avgUnitPrice: number; lastOrderDate: Date
    orderCount: number
}

export async function getSupplierProducts(supplierId: string): Promise<SupplierProduct[]> {
    const poLines = await prisma.purchaseOrderLine.findMany({
        where: { po: { supplierId } },
        include: {
            product: { select: { id: true, skuCode: true, productName: true } },
            po: { select: { createdAt: true } },
        },
    })

    const productMap = new Map<string, {
        id: string; skuCode: string; productName: string
        totalQty: number; totalValue: number; lastOrderDate: Date; orderCount: number
    }>()

    for (const line of poLines) {
        const pid = line.product.id
        const existing = productMap.get(pid)
        const qty = Number(line.qtyOrdered)
        const value = qty * Number(line.unitPrice)

        if (existing) {
            existing.totalQty += qty
            existing.totalValue += value
            existing.orderCount++
            if (line.po.createdAt > existing.lastOrderDate) existing.lastOrderDate = line.po.createdAt
        } else {
            productMap.set(pid, {
                id: pid, skuCode: line.product.skuCode, productName: line.product.productName,
                totalQty: qty, totalValue: value, lastOrderDate: line.po.createdAt, orderCount: 1,
            })
        }
    }

    return Array.from(productMap.values())
        .map(p => ({
            ...p,
            avgUnitPrice: p.orderCount > 0 ? Math.round(p.totalValue / p.totalQty * 100) / 100 : 0,
        }))
        .sort((a, b) => b.totalQty - a.totalQty)
}

// ═══════════════════════════════════════════════════
// SUPPLIER PRICING HISTORY (from PO lines)
// ═══════════════════════════════════════════════════

export type PricingPoint = {
    date: Date; poNo: string; productName: string
    unitPrice: number; currency: string; qty: number
}

export async function getSupplierPricingHistory(supplierId: string): Promise<PricingPoint[]> {
    const poLines = await prisma.purchaseOrderLine.findMany({
        where: { po: { supplierId } },
        include: {
            product: { select: { productName: true } },
            po: { select: { poNo: true, createdAt: true, currency: true } },
        },
        orderBy: { po: { createdAt: 'desc' } },
        take: 100,
    })

    return poLines.map(l => ({
        date: l.po.createdAt,
        poNo: l.po.poNo,
        productName: l.product.productName,
        unitPrice: Number(l.unitPrice),
        currency: l.po.currency,
        qty: Number(l.qtyOrdered),
    }))
}

// ═══════════════════════════════════════════════════
// SUPPLIER ACTIVITY LOG
// ═══════════════════════════════════════════════════

export async function getSupplierActivities(supplierId: string) {
    return prisma.supplierActivity.findMany({
        where: { supplierId },
        orderBy: { occurredAt: 'desc' },
        take: 50,
    })
}

export async function createSupplierActivity(input: {
    supplierId: string; type: string; description: string; performedBy?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.supplierActivity.create({
            data: {
                supplierId: input.supplierId,
                type: input.type,
                description: input.description,
                performedBy: input.performedBy ?? null,
            },
        })
        revalidatePath('/dashboard/suppliers')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// SUPPLIER SCORECARD
// ═══════════════════════════════════════════════════

export type SupplierScorecard = {
    supplierId: string
    supplierName: string
    totalPOs: number
    onTimeDeliveries: number
    lateDeliveries: number
    onTimeRate: number
    avgLeadTimeDays: number
    qualityScore: number
    overallScore: number
    grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export async function getSupplierScorecard(supplierId: string): Promise<SupplierScorecard | null> {
    const supplier = await prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { id: true, name: true, leadTimeDays: true },
    })
    if (!supplier) return null

    const pos = await prisma.purchaseOrder.findMany({
        where: { supplierId, status: 'RECEIVED' },
        select: { estimatedDelivery: true, createdAt: true, receivedAt: true },
    })

    let onTime = 0
    let late = 0
    let totalLeadDays = 0

    for (const po of pos) {
        const received = po.receivedAt ?? new Date()
        const estimated = po.estimatedDelivery
        if (estimated && received <= estimated) onTime++
        else late++

        const leadDays = Math.floor((received.getTime() - po.createdAt.getTime()) / 86400000)
        totalLeadDays += leadDays
    }

    const totalPOs = pos.length
    const onTimeRate = totalPOs > 0 ? (onTime / totalPOs) * 100 : 0
    const avgLeadTimeDays = totalPOs > 0 ? Math.round(totalLeadDays / totalPOs) : supplier.leadTimeDays

    const complaints = await prisma.complaintTicket.count({
        where: { type: 'QUALITY' },
    })
    const qualityScore = Math.max(0, 100 - complaints * 5)

    const overallScore = Math.round(onTimeRate * 0.5 + qualityScore * 0.3 + Math.min(100, (1 - Math.max(0, avgLeadTimeDays - 30) / 90) * 100) * 0.2)
    const grade = overallScore >= 90 ? 'A' : overallScore >= 75 ? 'B' : overallScore >= 60 ? 'C' : overallScore >= 40 ? 'D' : 'F'

    return {
        supplierId,
        supplierName: supplier.name,
        totalPOs,
        onTimeDeliveries: onTime,
        lateDeliveries: late,
        onTimeRate: Math.round(onTimeRate * 10) / 10,
        avgLeadTimeDays,
        qualityScore,
        overallScore,
        grade,
    }
}

export async function getAllSupplierScorecards(): Promise<SupplierScorecard[]> {
    const suppliers = await prisma.supplier.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { id: true },
    })

    const scorecards: SupplierScorecard[] = []
    for (const s of suppliers) {
        const sc = await getSupplierScorecard(s.id)
        if (sc) scorecards.push(sc)
    }
    return scorecards.sort((a, b) => b.overallScore - a.overallScore)
}

// ═══════════════════════════════════════════════════
// DUPLICATE DETECTION
// ═══════════════════════════════════════════════════

export type DuplicateCandidate = {
    type: 'PRODUCT' | 'CUSTOMER' | 'SUPPLIER'
    itemA: { id: string; code: string; name: string }
    itemB: { id: string; code: string; name: string }
    similarity: number
    field: string
}

function strSimilarity(a: string, b: string): number {
    const aLow = a.toLowerCase().trim()
    const bLow = b.toLowerCase().trim()
    if (aLow === bLow) return 100
    if (aLow.includes(bLow) || bLow.includes(aLow)) return 85

    const bigrams = (s: string) => {
        const set = new Set<string>()
        for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2))
        return set
    }
    const bgA = bigrams(aLow)
    const bgB = bigrams(bLow)
    let inter = 0
    bgA.forEach(b => { if (bgB.has(b)) inter++ })
    return Math.round((2 * inter) / (bgA.size + bgB.size) * 100)
}

export async function detectDuplicates(): Promise<DuplicateCandidate[]> {
    const [products, customers, suppliers] = await Promise.all([
        prisma.product.findMany({
            where: { deletedAt: null },
            select: { id: true, skuCode: true, productName: true },
        }),
        prisma.customer.findMany({
            where: { deletedAt: null },
            select: { id: true, code: true, name: true },
        }),
        prisma.supplier.findMany({
            where: { deletedAt: null },
            select: { id: true, code: true, name: true },
        }),
    ])

    const dupes: DuplicateCandidate[] = []
    const threshold = 75

    for (let i = 0; i < products.length; i++) {
        for (let j = i + 1; j < products.length; j++) {
            const a = products[i], b = products[j]
            const nameSim = strSimilarity(a.productName, b.productName)
            if (nameSim >= threshold) {
                dupes.push({
                    type: 'PRODUCT',
                    itemA: { id: a.id, code: a.skuCode, name: a.productName },
                    itemB: { id: b.id, code: b.skuCode, name: b.productName },
                    similarity: nameSim, field: 'productName',
                })
            }
            const codeSim = strSimilarity(a.skuCode, b.skuCode)
            if (codeSim >= 90 && codeSim < 100) {
                dupes.push({
                    type: 'PRODUCT',
                    itemA: { id: a.id, code: a.skuCode, name: a.productName },
                    itemB: { id: b.id, code: b.skuCode, name: b.productName },
                    similarity: codeSim, field: 'skuCode',
                })
            }
        }
    }

    for (let i = 0; i < customers.length; i++) {
        for (let j = i + 1; j < customers.length; j++) {
            const a = customers[i], b = customers[j]
            const nameSim = strSimilarity(a.name, b.name)
            if (nameSim >= threshold) {
                dupes.push({
                    type: 'CUSTOMER',
                    itemA: { id: a.id, code: a.code, name: a.name },
                    itemB: { id: b.id, code: b.code, name: b.name },
                    similarity: nameSim, field: 'name',
                })
            }
        }
    }

    for (let i = 0; i < suppliers.length; i++) {
        for (let j = i + 1; j < suppliers.length; j++) {
            const a = suppliers[i], b = suppliers[j]
            const nameSim = strSimilarity(a.name, b.name)
            if (nameSim >= threshold) {
                dupes.push({
                    type: 'SUPPLIER',
                    itemA: { id: a.id, code: a.code, name: a.name },
                    itemB: { id: b.id, code: b.code, name: b.name },
                    similarity: nameSim, field: 'name',
                })
            }
        }
    }

    return dupes.sort((a, b) => b.similarity - a.similarity)
}
