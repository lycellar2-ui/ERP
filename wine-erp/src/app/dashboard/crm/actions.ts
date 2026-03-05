'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASTING' | 'DELIVERY' | 'COMPLAINT' | 'OTHER'
export type OpportunityStage = 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'

export interface CustomerCRMRow {
    id: string
    code: string
    name: string
    customerType: string
    channel: string | null
    paymentTerm: string
    creditLimit: number
    salesRepName: string | null
    status: string
    totalOrders: number
    totalRevenue: number
    lastOrderDate: Date | null
    openComplaints: number
    createdAt: Date
}

// ── Customer list for CRM ────────────────────────
export async function getCRMCustomers(filters: {
    search?: string
    type?: string
    page?: number
    pageSize?: number
} = {}): Promise<{ rows: CustomerCRMRow[]; total: number }> {
    const { search, type, page = 1, pageSize = 20 } = filters
    const skip = (page - 1) * pageSize

    const where: any = { deletedAt: null }
    if (search) where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
    ]
    if (type) where.customerType = type

    const [customers, total] = await Promise.all([
        prisma.customer.findMany({
            where,
            skip,
            take: pageSize,
            orderBy: { createdAt: 'desc' },
            include: {
                salesRep: { select: { name: true } },
                salesOrders: {
                    where: { status: { in: ['CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'] } },
                    select: { totalAmount: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                },
                complaints: { where: { status: { in: ['OPEN', 'IN_PROGRESS'] } }, select: { id: true } },
            },
        }),
        prisma.customer.count({ where }),
    ])

    return {
        rows: customers.map(c => ({
            id: c.id,
            code: c.code,
            name: c.name,
            customerType: c.customerType,
            channel: c.channel,
            paymentTerm: c.paymentTerm,
            creditLimit: Number(c.creditLimit),
            salesRepName: c.salesRep?.name ?? null,
            status: c.status,
            totalOrders: c.salesOrders.length,
            totalRevenue: c.salesOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0),
            lastOrderDate: c.salesOrders[0]?.createdAt ?? null,
            openComplaints: c.complaints.length,
            createdAt: c.createdAt,
        })),
        total,
    }
}

// ── Full 360° profile ────────────────────────────
export async function getCustomer360(id: string) {
    const [customer, recentOrders, recentActivities, arBalance] = await Promise.all([
        prisma.customer.findUnique({
            where: { id },
            include: {
                salesRep: { select: { name: true } },
                addresses: true,
                opportunities: {
                    where: { stage: { notIn: ['WON', 'LOST'] } },
                    select: { id: true, name: true, expectedValue: true, stage: true, probability: true, closeDate: true },
                    orderBy: { createdAt: 'desc' },
                    take: 5,
                },
                complaints: {
                    where: { status: { in: ['OPEN', 'IN_PROGRESS'] } },
                    select: { id: true, type: true, severity: true, status: true, createdAt: true },
                    orderBy: { createdAt: 'desc' },
                    take: 3,
                },
            },
        }),
        prisma.salesOrder.findMany({
            where: { customerId: id },
            orderBy: { createdAt: 'desc' },
            take: 8,
            select: { id: true, soNo: true, status: true, totalAmount: true, createdAt: true, channel: true },
        }),
        prisma.customerActivity.findMany({
            where: { customerId: id },
            orderBy: { occurredAt: 'desc' },
            take: 10,
            include: { performer: { select: { name: true } } },
        }),
        prisma.aRInvoice.aggregate({
            where: {
                customerId: id,
                status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] },
            },
            _sum: { amount: true },
        }),
    ])

    if (!customer) return null

    const totalRevenue = recentOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
    const arBalanceAmount = Number(arBalance._sum?.amount ?? 0)

    return {
        customer,
        recentOrders,
        recentActivities,
        arBalance: arBalanceAmount,
        totalRevenue,
        creditAvailable: Math.max(0, Number(customer.creditLimit) - arBalanceAmount),
    }
}

// ── Log activity ─────────────────────────────────
export async function logCustomerActivity(data: {
    customerId: string
    type: ActivityType
    description: string
    performedBy: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.customerActivity.create({
            data: {
                customerId: data.customerId,
                type: data.type,
                description: data.description,
                performedBy: data.performedBy,
            },
        })
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Create opportunity ──────────────────────────
export async function createOpportunity(data: {
    customerId: string
    name: string
    expectedValue: number
    stage: OpportunityStage
    probability: number
    closeDate?: Date
    notes?: string
    assignedTo: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.salesOpportunity.create({ data })
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── CRM summary stats ────────────────────────────
export async function getCRMStats() {
    const [total, horeca, openOpps, openTickets] = await Promise.all([
        prisma.customer.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        prisma.customer.count({ where: { channel: 'HORECA', status: 'ACTIVE', deletedAt: null } }),
        prisma.salesOpportunity.count({ where: { stage: { notIn: ['WON', 'LOST'] } } }),
        prisma.complaintTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    ])
    return { total, horeca, openOpps, openTickets }
}

// ── Customer Transaction History (P1) ────────────
export async function getCustomerTransactions(customerId: string) {
    const [orders, arInvoices] = await Promise.all([
        // All-time orders
        prisma.salesOrder.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, soNo: true, status: true, totalAmount: true,
                channel: true, createdAt: true,
                lines: {
                    select: { qtyOrdered: true, unitPrice: true, product: { select: { skuCode: true, productName: true } } },
                },
            },
        }),
        // AR Invoices
        prisma.aRInvoice.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' },
            include: { payments: { select: { amount: true } } },
        }),
    ])

    // Compute top SKU from order lines
    const skuMap = new Map<string, { skuCode: string; productName: string; totalQty: number; totalValue: number }>()
    for (const o of orders) {
        if (!['CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'].includes(o.status)) continue
        for (const line of o.lines) {
            const key = line.product.skuCode
            const existing = skuMap.get(key) ?? { skuCode: key, productName: line.product.productName, totalQty: 0, totalValue: 0 }
            existing.totalQty += Number(line.qtyOrdered)
            existing.totalValue += Number(line.qtyOrdered) * Number(line.unitPrice)
            skuMap.set(key, existing)
        }
    }
    const topSkus = Array.from(skuMap.values()).sort((a, b) => b.totalValue - a.totalValue).slice(0, 10)

    const allTimeRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
    const confirmedOrders = orders.filter(o => ['CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'].includes(o.status))

    return {
        allTimeRevenue,
        totalOrders: orders.length,
        confirmedOrders: confirmedOrders.length,
        avgOrderValue: confirmedOrders.length > 0 ? allTimeRevenue / confirmedOrders.length : 0,
        orders: orders.map(o => ({
            id: o.id,
            soNo: o.soNo,
            status: o.status,
            amount: Number(o.totalAmount),
            channel: o.channel,
            date: o.createdAt,
            lineCount: o.lines.length,
        })),
        invoices: arInvoices.map(i => ({
            invoiceNo: i.invoiceNo,
            amount: Number(i.amount),
            paidAmount: i.payments.reduce((s: number, p: { amount: any }) => s + Number(p.amount), 0),
            status: i.status,
            date: i.createdAt,
            dueDate: i.dueDate,
        })),
        topSkus,
    }
}

// ── Customer Tier Auto-Calculation ───────────────
export type CustomerTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM'

const TIER_THRESHOLDS: { tier: CustomerTier; minRevenue: number }[] = [
    { tier: 'PLATINUM', minRevenue: 5_000_000_000 },
    { tier: 'GOLD', minRevenue: 2_000_000_000 },
    { tier: 'SILVER', minRevenue: 500_000_000 },
    { tier: 'BRONZE', minRevenue: 0 },
]

export async function calculateCustomerTier(customerId: string): Promise<{ tier: CustomerTier; annualRevenue: number }> {
    const yearStart = new Date(new Date().getFullYear(), 0, 1)
    const annualSO = await prisma.salesOrder.aggregate({
        where: {
            customerId,
            status: { in: ['CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'] },
            createdAt: { gte: yearStart },
        },
        _sum: { totalAmount: true },
    })
    const annualRevenue = Number(annualSO._sum?.totalAmount ?? 0)
    const tier = TIER_THRESHOLDS.find(t => annualRevenue >= t.minRevenue)?.tier ?? 'BRONZE'
    return { tier, annualRevenue }
}

export async function recalcAllCustomerTiers(): Promise<{ success: boolean; updated: number }> {
    const customers = await prisma.customer.findMany({
        where: { status: 'ACTIVE', deletedAt: null },
        select: { id: true },
    })
    let updated = 0
    for (const c of customers) {
        await calculateCustomerTier(c.id)
        updated++
    }
    return { success: true, updated }
}
