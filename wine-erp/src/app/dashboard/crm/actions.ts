'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'
import { parseOrThrow, CRMActivitySchema, CRMContactSchema, CRMComplaintSchema, CRMTastingEventSchema } from '@/lib/validations'
import { getCurrentUser } from '@/lib/session'

export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASTING' | 'DELIVERY' | 'COMPLAINT' | 'OTHER'
export type OpportunityStage = 'LEAD' | 'QUALIFIED' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'

export interface CustomerCRMRow {
    id: string
    code: string
    name: string
    customerType: string | null
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
    const cacheKey = `crm:customers:${page}:${pageSize}:${search ?? ''}:${type ?? ''}`
    return cached(cacheKey, async () => {
        const skip = (page - 1) * pageSize

        const where: any = { deletedAt: null }
        if (search) where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { code: { contains: search, mode: 'insensitive' } },
        ]
        if (type) where.channel = type as any

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
    }) // end cached
}

// ── Full 360° profile ────────────────────────────
export async function getCustomer360(id: string) {
    const [customer, recentOrders, recentActivities, arBalance] = await Promise.all([
        prisma.customer.findUnique({
            where: { id },
            include: {
                salesRep: { select: { name: true } },
                addresses: true,
                contacts: { orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }] },
                tags: { orderBy: { createdAt: 'asc' } },
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
        const validated = parseOrThrow(CRMActivitySchema, data)
        await prisma.customerActivity.create({
            data: {
                customerId: validated.customerId,
                type: validated.type,
                description: validated.description,
                performedBy: validated.performedBy,
            },
        })
        revalidateCache('crm')
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
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── CRM summary stats ────────────────────────────
export async function getCRMStats() {
    return cached('crm:stats', async () => {
        const [total, horeca, openOpps, openTickets] = await Promise.all([
            prisma.customer.count({ where: { status: 'ACTIVE', deletedAt: null } }),
            prisma.customer.count({ where: { channel: 'HORECA', status: 'ACTIVE', deletedAt: null } }),
            prisma.salesOpportunity.count({ where: { stage: { notIn: ['WON', 'LOST'] } } }),
            prisma.complaintTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        ])
        return { total, horeca, openOpps, openTickets }
    })
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

// ═══════════════════════════════════════════════════
// CUSTOMER CONTACTS — Multiple contacts per customer
// ═══════════════════════════════════════════════════

export type ContactRow = {
    id: string
    name: string
    title: string | null
    phone: string | null
    email: string | null
    isPrimary: boolean
    createdAt: Date
}

export async function getCustomerContacts(customerId: string): Promise<ContactRow[]> {
    return prisma.customerContact.findMany({
        where: { customerId },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    })
}

export async function createCustomerContact(input: {
    customerId: string
    name: string
    title?: string
    phone?: string
    email?: string
    isPrimary?: boolean
}): Promise<{ success: boolean; error?: string }> {
    try {
        const validated = parseOrThrow(CRMContactSchema, input)
        if (validated.isPrimary) {
            await prisma.customerContact.updateMany({
                where: { customerId: validated.customerId, isPrimary: true },
                data: { isPrimary: false },
            })
        }
        await prisma.customerContact.create({
            data: {
                customerId: validated.customerId,
                name: validated.name,
                title: validated.title ?? null,
                phone: validated.phone ?? null,
                email: validated.email ?? null,
                isPrimary: validated.isPrimary ?? false,
            },
        })
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function updateCustomerContact(
    id: string,
    input: { name?: string; title?: string; phone?: string; email?: string; isPrimary?: boolean }
): Promise<{ success: boolean; error?: string }> {
    try {
        if (input.isPrimary) {
            const contact = await prisma.customerContact.findUnique({ where: { id } })
            if (contact) {
                await prisma.customerContact.updateMany({
                    where: { customerId: contact.customerId, isPrimary: true },
                    data: { isPrimary: false },
                })
            }
        }
        await prisma.customerContact.update({ where: { id }, data: input as any })
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteCustomerContact(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.customerContact.delete({ where: { id } })
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// CUSTOMER TAGS — Custom labels (VIP, At-risk, etc.)
// ═══════════════════════════════════════════════════

export type TagRow = {
    id: string
    tag: string
    color: string
    createdAt: Date
}

const PRESET_TAGS: { tag: string; color: string }[] = [
    { tag: 'VIP', color: '#D4A853' },
    { tag: 'At-risk', color: '#E05252' },
    { tag: 'Price-sensitive', color: '#4A8FAB' },
    { tag: 'EVFTA', color: '#5BA88A' },
    { tag: 'New', color: '#0891B2' },
    { tag: 'Top Buyer', color: '#A5DED0' },
    { tag: 'HORECA Key', color: '#475569' },
]

export async function getPresetTags() {
    return PRESET_TAGS
}

export async function getCustomerTags(customerId: string): Promise<TagRow[]> {
    return prisma.customerTag.findMany({
        where: { customerId },
        orderBy: { createdAt: 'asc' },
    })
}

export async function addCustomerTag(input: {
    customerId: string
    tag: string
    color?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const preset = PRESET_TAGS.find(p => p.tag === input.tag)
        await prisma.customerTag.create({
            data: {
                customerId: input.customerId,
                tag: input.tag,
                color: input.color ?? preset?.color ?? '#87CBB9',
            },
        })
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        if (err.code === 'P2002') return { success: false, error: 'Tag đã tồn tại cho KH này' }
        return { success: false, error: err.message }
    }
}

export async function removeCustomerTag(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.customerTag.delete({ where: { id } })
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// #26 — WINE PREFERENCE PROFILE
// ═══════════════════════════════════════════════════

export type WinePreference = {
    id: string
    grapeVarieties: string[]
    regions: string[]
    tasteProfile: string[]
    priceRangeMin: number
    priceRangeMax: number
    notes: string | null
    updatedAt: Date
}

export async function getWinePreference(customerId: string): Promise<WinePreference | null> {
    const pref = await prisma.winePreference.findUnique({ where: { customerId } })
    if (!pref) return null
    return {
        id: pref.id,
        grapeVarieties: (pref.grapeVarieties as string[]) ?? [],
        regions: (pref.regions as string[]) ?? [],
        tasteProfile: (pref.tasteProfile as string[]) ?? [],
        priceRangeMin: Number(pref.priceRangeMin),
        priceRangeMax: Number(pref.priceRangeMax),
        notes: pref.notes,
        updatedAt: pref.updatedAt,
    }
}

export async function saveWinePreference(input: {
    customerId: string
    grapeVarieties: string[]
    regions: string[]
    tasteProfile: string[]
    priceRangeMin: number
    priceRangeMax: number
    notes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.winePreference.upsert({
            where: { customerId: input.customerId },
            create: {
                customerId: input.customerId,
                grapeVarieties: input.grapeVarieties,
                regions: input.regions,
                tasteProfile: input.tasteProfile,
                priceRangeMin: input.priceRangeMin,
                priceRangeMax: input.priceRangeMax,
                notes: input.notes ?? null,
            },
            update: {
                grapeVarieties: input.grapeVarieties,
                regions: input.regions,
                tasteProfile: input.tasteProfile,
                priceRangeMin: input.priceRangeMin,
                priceRangeMax: input.priceRangeMax,
                notes: input.notes ?? null,
            },
        })
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getGrapePresets() {
    return [
        'Cabernet Sauvignon', 'Merlot', 'Pinot Noir', 'Syrah/Shiraz', 'Malbec',
        'Chardonnay', 'Sauvignon Blanc', 'Riesling', 'Pinot Grigio', 'Moscato',
        'Tempranillo', 'Nebbiolo', 'Sangiovese', 'Grenache', 'Zinfandel',
    ]
}

export async function getRegionPresets() {
    return [
        'Bordeaux', 'Bourgogne', 'Champagne', 'Rhône', 'Loire',
        'Tuscany', 'Piedmont', 'Rioja', 'Barossa', 'Napa Valley',
        'Mendoza', 'Mosel', 'Douro', 'Marlborough', 'Central Otago',
    ]
}

export async function getTastePresets() {
    return [
        'Fruity', 'Dry', 'Sweet', 'Tannic', 'Oaky',
        'Light-bodied', 'Full-bodied', 'Crisp', 'Smooth', 'Spicy',
    ]
}

// ═══════════════════════════════════════════════════
// #27 — TASTING EVENT MANAGEMENT
// ═══════════════════════════════════════════════════

export type TastingEventRow = {
    id: string
    name: string
    date: Date | null
    venue: string | null
    description: string | null
    maxGuests: number
    status: string
    rsvpCount: number
    checkinCount: number
    conversionCount: number
    totalConversionValue: number
    createdAt: Date
}

export async function getTastingEvents(): Promise<TastingEventRow[]> {
    const events = await prisma.tastingEvent.findMany({
        orderBy: { date: 'desc' },
        include: {
            guests: { select: { id: true, rsvpStatus: true, checkedIn: true, linkedSOId: true } },
        },
    })

    return events.map(ev => {
        const rsvpCount = ev.guests.filter(g => g.rsvpStatus === 'CONFIRMED').length
        const checkinCount = ev.guests.filter(g => g.checkedIn).length
        const conversions = ev.guests.filter(g => g.linkedSOId)
        return {
            id: ev.id,
            name: ev.name,
            date: ev.date,
            venue: ev.venue,
            description: ev.description,
            maxGuests: ev.maxGuests,
            status: ev.status,
            rsvpCount,
            checkinCount,
            conversionCount: conversions.length,
            totalConversionValue: 0,
            createdAt: ev.createdAt,
        }
    })
}

export async function createTastingEvent(input: {
    name: string
    date: string
    venue: string
    description?: string
    maxGuests: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        const validated = parseOrThrow(CRMTastingEventSchema, input)
        await prisma.tastingEvent.create({
            data: {
                name: validated.name,
                eventDate: new Date(validated.date),
                date: new Date(validated.date),
                location: validated.venue,
                venue: validated.venue,
                description: validated.description ?? null,
                maxGuests: validated.maxGuests,
                status: 'PLANNED',
            },
        })
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function addEventGuest(input: {
    eventId: string
    customerId: string
    rsvpStatus?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.tastingEventGuest.create({
            data: {
                eventId: input.eventId,
                customerId: input.customerId,
                rsvpStatus: input.rsvpStatus ?? 'INVITED',
                checkedIn: false,
            },
        })
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        if (err.code === 'P2002') return { success: false, error: 'Khách đã được mời' }
        return { success: false, error: err.message }
    }
}

export async function checkinGuest(guestId: string): Promise<{ success: boolean }> {
    await prisma.tastingEventGuest.update({
        where: { id: guestId },
        data: { checkedIn: true, checkinAt: new Date() },
    })
    revalidatePath('/dashboard/crm')
    return { success: true }
}

export async function linkGuestConversion(guestId: string, soId: string): Promise<{ success: boolean }> {
    await prisma.tastingEventGuest.update({
        where: { id: guestId },
        data: { linkedSOId: soId },
    })
    revalidatePath('/dashboard/crm')
    return { success: true }
}

export async function getEventDetails(eventId: string) {
    const ev = await prisma.tastingEvent.findUnique({
        where: { id: eventId },
        include: {
            guests: {
                include: {
                    customer: { select: { id: true, name: true, code: true, customerType: true } },
                    linkedSO: { select: { id: true, soNo: true, totalAmount: true } },
                },
                orderBy: { createdAt: 'asc' },
            },
        },
    })
    if (!ev) return null

    const rsvpConfirmed = ev.guests.filter(g => g.rsvpStatus === 'CONFIRMED')
    const checkedIn = ev.guests.filter(g => g.checkedIn)
    const conversions = ev.guests.filter(g => g.linkedSOId)
    const conversionValue = conversions.reduce((s, g) => s + Number(g.linkedSO?.totalAmount ?? 0), 0)

    return {
        ...ev,
        stats: {
            invited: ev.guests.length,
            rsvpConfirmed: rsvpConfirmed.length,
            checkedIn: checkedIn.length,
            conversions: conversions.length,
            conversionValue,
            conversionRate: checkedIn.length > 0 ? (conversions.length / checkedIn.length) * 100 : 0,
        },
    }
}

// ═══════════════════════════════════════════════════
// #28 — COMPLAINT TICKET SYSTEM
// ═══════════════════════════════════════════════════

export type ComplaintRow = {
    id: string
    ticketNo: string | null
    customerId: string
    customerName: string
    type: string
    severity: string
    status: string
    subject: string | null
    description: string | null
    resolution: string | null
    resolvedAt: Date | null
    slaDeadline: Date | null
    isOverSLA: boolean
    createdAt: Date
}

const SLA_HOURS: Record<string, number> = {
    CRITICAL: 4,
    HIGH: 24,
    MEDIUM: 72,
    LOW: 168,
}

export async function getComplaintTickets(filters: {
    status?: string
    severity?: string
} = {}): Promise<ComplaintRow[]> {
    const where: any = {}
    if (filters.status) where.status = filters.status
    if (filters.severity) where.severity = filters.severity

    const tickets = await prisma.complaintTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { name: true } } },
        take: 100,
    })

    const now = new Date()
    return tickets.map(t => {
        const slaHours = SLA_HOURS[t.severity] ?? 72
        const slaDeadline = new Date(t.createdAt.getTime() + slaHours * 3600000)
        const isOverSLA = t.status !== 'RESOLVED' && t.status !== 'CLOSED' && now > slaDeadline
        return {
            id: t.id,
            ticketNo: t.ticketNo,
            customerId: t.customerId,
            customerName: t.customer.name,
            type: t.type,
            severity: t.severity,
            status: t.status,
            subject: t.subject,
            description: t.description,
            resolution: t.resolution,
            resolvedAt: t.resolvedAt,
            slaDeadline,
            isOverSLA,
            createdAt: t.createdAt,
        }
    })
}

export async function createComplaintTicket(input: {
    customerId: string
    type: string
    severity: string
    subject: string
    description: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const count = await prisma.complaintTicket.count()
        const ticketNo = `TK-${String(count + 1).padStart(5, '0')}`
        await prisma.complaintTicket.create({
            data: {
                ticketNo,
                customerId: input.customerId,
                type: input.type as any,
                severity: input.severity as any,
                subject: input.subject,
                description: input.description,
                status: 'OPEN',
            },
        })
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function resolveComplaintTicket(id: string, resolution: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.complaintTicket.update({
            where: { id },
            data: {
                status: 'RESOLVED',
                resolution,
                resolvedAt: new Date(),
            },
        })
        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function getComplaintTypes() {
    return ['QUALITY', 'DELIVERY', 'BILLING', 'SERVICE', 'PACKAGING', 'OTHER']
}

export async function getComplaintSeverityLevels() {
    return ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
}

// ═══════════════════════════════════════════════════
// WEEKLY VISIT PLANNER ACTIONS
// ═══════════════════════════════════════════════════

export async function getWeeklyPlan(year: number, weekNumber: number, targetSalesRepId?: string) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        let querySalesRepId = user.id
        if (targetSalesRepId && targetSalesRepId !== user.id) {
            const isManager = user.roles.some(roleName => ['CEO', 'SALES_MGR', 'SALES_ADMIN'].includes(roleName))
            if (!isManager) {
                return { success: false, error: 'Không có quyền truy cập kế hoạch của nhân viên khác' }
            }
            querySalesRepId = targetSalesRepId
        }

        const plan = await prisma.weeklyVisitPlan.findFirst({
            where: {
                salesRepId: querySalesRepId,
                year,
                weekNumber,
            },
            include: {
                visits: {
                    include: {
                        customer: {
                            select: { id: true, name: true, code: true }
                        }
                    },
                    orderBy: { visitDate: 'asc' }
                }
            }
        })

        if (!plan) return { success: true, plan: null }

        const serializedVisits = plan.visits.map(v => ({
            ...v,
            visitDate: v.visitDate.toISOString(),
            createdAt: v.createdAt.toISOString(),
            updatedAt: v.updatedAt.toISOString(),
        }))

        return {
            success: true,
            plan: {
                ...plan,
                createdAt: plan.createdAt.toISOString(),
                updatedAt: plan.updatedAt.toISOString(),
                visits: serializedVisits
            }
        }
    } catch (err: any) {
        console.error('Lỗi getWeeklyPlan:', err)
        return { success: false, error: err.message }
    }
}

export async function createOrUpdateWeeklyPlan(input: {
    weekNumber: number
    year: number
    note?: string
    visits: Array<{
        customerId: string
        visitDate: string
        purpose: string
    }>
}) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const result = await prisma.$transaction(async (tx) => {
            let plan = await tx.weeklyVisitPlan.findFirst({
                where: {
                    salesRepId: user.id,
                    year: input.year,
                    weekNumber: input.weekNumber,
                }
            })

            if (!plan) {
                plan = await tx.weeklyVisitPlan.create({
                    data: {
                        salesRepId: user.id,
                        year: input.year,
                        weekNumber: input.weekNumber,
                        note: input.note || null,
                        status: 'DRAFT',
                    }
                })
            } else {
                plan = await tx.weeklyVisitPlan.update({
                    where: { id: plan.id },
                    data: {
                        note: input.note || null,
                        status: 'DRAFT',
                    }
                })
            }

            await tx.salesVisitSchedule.deleteMany({
                where: { planId: plan.id }
            })

            if (input.visits.length > 0) {
                await tx.salesVisitSchedule.createMany({
                    data: input.visits.map(v => ({
                        planId: plan!.id,
                        customerId: v.customerId,
                        visitDate: new Date(v.visitDate),
                        purpose: v.purpose,
                        status: 'PLANNED',
                    }))
                })
            }

            return plan
        })

        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true, planId: result.id }
    } catch (err: any) {
        console.error('Lỗi createOrUpdateWeeklyPlan:', err)
        return { success: false, error: err.message }
    }
}

export async function updateVisitStatus(input: {
    visitId: string
    status: 'COMPLETED' | 'CANCELLED'
    resultNotes?: string
}) {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const result = await prisma.$transaction(async (tx) => {
            const visit = await tx.salesVisitSchedule.findUnique({
                where: { id: input.visitId },
                include: { plan: true }
            })

            if (!visit) throw new Error('Không tìm thấy lịch đi thăm')
            if (visit.plan.salesRepId !== user.id) throw new Error('Không có quyền thay đổi lịch này')

            const updated = await tx.salesVisitSchedule.update({
                where: { id: input.visitId },
                data: {
                    status: input.status,
                    resultNotes: input.resultNotes || null,
                }
            })

            if (input.status === 'COMPLETED') {
                const activityType = updated.purpose.toLowerCase().includes('thử') || updated.purpose.toLowerCase().includes('tasting')
                    ? 'TASTING'
                    : 'MEETING'

                await tx.customerActivity.create({
                    data: {
                        customerId: updated.customerId,
                        type: activityType,
                        description: `[Đi thăm] Kết quả: ${input.resultNotes || 'Đã gặp khách hàng.'} (Mục đích: ${updated.purpose})`,
                        performedBy: user.id,
                        occurredAt: new Date(),
                    }
                })
            }

            return updated
        })

        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        console.error('Lỗi updateVisitStatus:', err)
        return { success: false, error: err.message }
    }
}

export async function getSalesRepCustomers() {
    try {
        const user = await getCurrentUser()
        if (!user) return []

        const customers = await prisma.customer.findMany({
            where: {
                salesRepId: user.id,
                status: 'ACTIVE',
            },
            select: {
                id: true,
                code: true,
                name: true,
            },
            orderBy: { name: 'asc' }
        })

        return customers
    } catch (err) {
        console.error('Lỗi getSalesRepCustomers:', err)
        return []
    }
}

export async function getSalesRepsList() {
    try {
        const user = await getCurrentUser()
        if (!user) return []

        const isManager = user.roles.some(roleName => ['CEO', 'SALES_MGR', 'SALES_ADMIN'].includes(roleName))
        if (!isManager) return []

        const users = await prisma.user.findMany({
            where: {
                status: 'ACTIVE',
                roles: {
                    some: {
                        role: {
                            name: {
                                in: ['Sales Rep', 'SALES_REP']
                            }
                        }
                    }
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
            },
            orderBy: { name: 'asc' }
        })

        return users
    } catch (err) {
        console.error('Lỗi getSalesRepsList:', err)
        return []
    }
}

export async function getCurrentUserProfile() {
    try {
        return await getCurrentUser()
    } catch {
        return null
    }
}

// ═══════════════════════════════════════════════════
// TELESALES & PROSPECTING HUB (CORPORATE & RETAIL CRM)
// ═══════════════════════════════════════════════════

export interface TelesalesDashboardData {
    success: boolean
    error?: string
    todayStr: string
    currentMonth: number
    currentYear: number
    isManager: boolean
    currentUserId?: string
    stats: {
        totalCallsToday: number
        connectedCallsToday: number
        connectionRate: number
        corporateCallsToday: number
        retailCallsToday: number
        leadsFoundThisMonth: number
        dealsCreatedThisMonth: number
    }
    teamMatrix: Array<{
        repId: string
        repName: string
        repEmail: string
        channel: 'CORPORATE' | 'RETAIL' | 'ALL'
        dailyCallTarget: number
        callsToday: number
        connectedToday: number
        todayProgressPct: number
        monthlyLeadTarget: number
        leadsFoundMonth: number
        monthlyDealTarget: number
        dealsCreatedMonth: number
    }>
    recentCallLogs: Array<{
        id: string
        salespersonId: string
        salespersonName: string
        channel: string
        customerId: string | null
        customerCode?: string
        customerName?: string
        prospectName: string
        prospectCompany: string | null
        phone: string
        callType: string
        outcome: string
        notes: string | null
        followUpDate: string | null
        durationMinutes: number
        calledAt: string
    }>
    customersList: Array<{
        id: string
        code: string
        name: string
        channel: string
        phone: string | null
    }>
}

export async function getTelesalesProspectingDashboard(filters?: {
    channel?: string
    date?: string
    month?: number
    year?: number
}): Promise<TelesalesDashboardData> {
    try {
        const user = await getCurrentUser()
        const isManager = user?.roles.some(r => ['CEO', 'SALES_MGR', 'SALES_ADMIN', 'ADMIN'].includes(r)) ?? false

        // Determine current date and month in Vietnam timezone
        const now = new Date()
        const todayVnStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)
        const activeDateStr = filters?.date || todayVnStr
        const [targetYear, targetMonth, targetDay] = activeDateStr.split('-').map(Number)

        const startOfDay = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 0, 0, 0))
        const endOfDay = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 23, 59, 59, 999))

        const year = filters?.year || targetYear
        const month = filters?.month || targetMonth
        const startOfMonth = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0))
        const endOfMonth = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))

        // 1. Fetch Sales Reps
        const salesUsers = await prisma.user.findMany({
            where: {
                status: 'ACTIVE',
                roles: {
                    some: {
                        role: {
                            name: { in: ['Sales Rep', 'SALES_REP', 'Corporate Sales', 'Retail Sales', 'Sales Executive'] }
                        }
                    }
                }
            },
            select: {
                id: true,
                name: true,
                email: true,
                roles: { select: { role: { select: { name: true } } } },
            },
            orderBy: { name: 'asc' }
        })

        // Fallback: if no users have strict sales role, fetch all active users who have created SO or visits
        let reps = salesUsers
        if (reps.length === 0) {
            reps = await prisma.user.findMany({
                where: { status: 'ACTIVE' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    roles: { select: { role: { select: { name: true } } } },
                },
                take: 15,
                orderBy: { name: 'asc' }
            })
        }

        // 2. Fetch KPI Targets for calls, leads, deals
        const kpiTargets = await prisma.kpiTarget.findMany({
            where: {
                year,
                OR: [{ month }, { month: null }],
                metric: { in: ['CALLS_DAILY', 'NEW_LEADS', 'DEALS_COUNT', 'REVENUE'] }
            }
        })

        // 3. Fetch Calls Today
        const callsTodayWhere: any = {
            calledAt: { gte: startOfDay, lte: endOfDay }
        }
        if (filters?.channel && filters.channel !== 'ALL') {
            callsTodayWhere.channel = filters.channel
        }

        const callsToday = await prisma.salesCallLog.findMany({
            where: callsTodayWhere,
            select: {
                id: true,
                salespersonId: true,
                channel: true,
                outcome: true,
            }
        })

        // 4. Fetch Customers (Leads) Created this month
        const newCustomersMonth = await prisma.customer.findMany({
            where: {
                createdAt: { gte: startOfMonth, lte: endOfMonth },
                status: 'ACTIVE'
            },
            select: {
                id: true,
                salesRepId: true,
                channel: true,
            }
        })

        // 5. Fetch Sales Opportunities created this month
        const newOppsMonth = await prisma.salesOpportunity.findMany({
            where: {
                createdAt: { gte: startOfMonth, lte: endOfMonth }
            },
            select: {
                id: true,
                assignedTo: true,
                stage: true,
                expectedValue: true,
            }
        })

        // 6. Build Team Matrix
        const teamMatrix = reps.map(rep => {
            const roleNames = rep.roles.map(r => r.role.name.toLowerCase()).join(' ')
            let channel: 'CORPORATE' | 'RETAIL' | 'ALL' = 'CORPORATE'
            if (roleNames.includes('retail') || rep.name.toLowerCase().includes('retail') || rep.email.toLowerCase().includes('retail')) {
                channel = 'RETAIL'
            } else if (roleNames.includes('corp') || rep.name.toLowerCase().includes('corp') || rep.email.toLowerCase().includes('corp')) {
                channel = 'CORPORATE'
            } else {
                // If not specific, default Corporate for odd, Retail for even or check customer channel
                const repCusts = newCustomersMonth.filter(c => c.salesRepId === rep.id)
                const hasRetail = repCusts.some(c => c.channel === 'RETAIL' || c.channel === 'DIRECT_INDIVIDUAL')
                channel = hasRetail ? 'RETAIL' : 'CORPORATE'
            }

            // Custom target from DB or standard default
            const dailyTargetKpi = kpiTargets.find(t => t.salesRepId === rep.id && t.metric === 'CALLS_DAILY')
            const dailyCallTarget = dailyTargetKpi ? Number(dailyTargetKpi.targetValue) : (channel === 'RETAIL' ? 25 : 15)

            const monthlyLeadKpi = kpiTargets.find(t => t.salesRepId === rep.id && t.metric === 'NEW_LEADS')
            const monthlyLeadTarget = monthlyLeadKpi ? Number(monthlyLeadKpi.targetValue) : (channel === 'RETAIL' ? 20 : 10)

            const monthlyDealKpi = kpiTargets.find(t => t.salesRepId === rep.id && t.metric === 'DEALS_COUNT')
            const monthlyDealTarget = monthlyDealKpi ? Number(monthlyDealKpi.targetValue) : (channel === 'RETAIL' ? 10 : 5)

            // Actual counts
            const repCallsToday = callsToday.filter(c => c.salespersonId === rep.id)
            const callsCount = repCallsToday.length
            const connectedToday = repCallsToday.filter(c => c.outcome.startsWith('CONNECTED')).length
            const todayProgressPct = dailyCallTarget > 0 ? Math.min(100, Math.round((callsCount / dailyCallTarget) * 100)) : 0

            const leadsFoundMonth = newCustomersMonth.filter(c => c.salesRepId === rep.id).length
            const dealsCreatedMonth = newOppsMonth.filter(o => o.assignedTo === rep.id).length

            return {
                repId: rep.id,
                repName: rep.name,
                repEmail: rep.email,
                channel,
                dailyCallTarget,
                callsToday: callsCount,
                connectedToday,
                todayProgressPct,
                monthlyLeadTarget,
                leadsFoundMonth,
                monthlyDealTarget,
                dealsCreatedMonth,
            }
        })

        // 7. Recent Call Logs (Latest 50)
        const recentLogsWhere: any = {}
        if (filters?.channel && filters.channel !== 'ALL') {
            recentLogsWhere.channel = filters.channel
        }
        if (!isManager && user?.id) {
            recentLogsWhere.salespersonId = user.id
        }

        const recentCallLogs = await prisma.salesCallLog.findMany({
            where: recentLogsWhere,
            orderBy: { calledAt: 'desc' },
            take: 60,
            include: {
                salesperson: { select: { id: true, name: true, email: true } },
                customer: { select: { id: true, code: true, name: true, channel: true } }
            }
        })

        // 8. Stats calculations
        const totalCallsToday = callsToday.length
        const connectedCallsToday = callsToday.filter(c => c.outcome.startsWith('CONNECTED')).length
        const connectionRate = totalCallsToday > 0 ? Math.round((connectedCallsToday / totalCallsToday) * 100) : 0
        const corporateCallsToday = callsToday.filter(c => c.channel === 'CORPORATE').length
        const retailCallsToday = callsToday.filter(c => c.channel === 'RETAIL' || c.channel === 'DIRECT_INDIVIDUAL').length
        const leadsFoundThisMonth = newCustomersMonth.length
        const dealsCreatedThisMonth = newOppsMonth.length

        // 9. Lightweight Customer lookup list for quick search in Call Logger
        const customersList = await prisma.customer.findMany({
            where: { status: 'ACTIVE' },
            select: {
                id: true,
                code: true,
                name: true,
                channel: true,
                purchasingPhone: true,
            },
            orderBy: { name: 'asc' },
            take: 250
        })

        return {
            success: true,
            todayStr: activeDateStr,
            currentMonth: month,
            currentYear: year,
            isManager,
            currentUserId: user?.id,
            stats: {
                totalCallsToday,
                connectedCallsToday,
                connectionRate,
                corporateCallsToday,
                retailCallsToday,
                leadsFoundThisMonth,
                dealsCreatedThisMonth,
            },
            teamMatrix,
            recentCallLogs: recentCallLogs.map(log => ({
                id: log.id,
                salespersonId: log.salespersonId,
                salespersonName: log.salesperson.name,
                channel: log.channel,
                customerId: log.customerId,
                customerCode: log.customer?.code,
                customerName: log.customer?.name,
                prospectName: log.prospectName,
                prospectCompany: log.prospectCompany,
                phone: log.phone,
                callType: log.callType,
                outcome: log.outcome,
                notes: log.notes,
                followUpDate: log.followUpDate ? log.followUpDate.toISOString() : null,
                durationMinutes: log.durationMinutes,
                calledAt: log.calledAt.toISOString(),
            })),
            customersList: customersList.map(c => ({
                id: c.id,
                code: c.code,
                name: c.name,
                channel: c.channel,
                phone: c.purchasingPhone,
            }))
        }
    } catch (err: any) {
        console.error('getTelesalesProspectingDashboard error:', err)
        return {
            success: false,
            error: err.message || 'Lỗi khi tải bảng theo dõi Telesales & Prospecting',
            todayStr: '',
            currentMonth: 0,
            currentYear: 0,
            isManager: false,
            stats: {
                totalCallsToday: 0,
                connectedCallsToday: 0,
                connectionRate: 0,
                corporateCallsToday: 0,
                retailCallsToday: 0,
                leadsFoundThisMonth: 0,
                dealsCreatedThisMonth: 0,
            },
            teamMatrix: [],
            recentCallLogs: [],
            customersList: [],
        }
    }
}

export async function logSalesCallAction(data: {
    salespersonId?: string
    channel: 'CORPORATE' | 'RETAIL' | 'HORECA'
    customerId?: string
    prospectName: string
    prospectCompany?: string
    phone: string
    callType: string
    outcome: string
    notes?: string
    followUpDate?: string
    durationMinutes?: number
}): Promise<{ success: boolean; error?: string; logId?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const isManager = user.roles.some(r => ['CEO', 'SALES_MGR', 'SALES_ADMIN', 'ADMIN'].includes(r))
        const salespersonId = (isManager && data.salespersonId) ? data.salespersonId : user.id

        if (!data.phone || data.phone.trim().length < 8) {
            return { success: false, error: 'Vui lòng nhập số điện thoại hợp lệ (tối thiểu 8 số)' }
        }
        if (!data.prospectName || data.prospectName.trim().length < 2) {
            return { success: false, error: 'Vui lòng nhập tên người liên hệ / khách hàng' }
        }
        if (!data.outcome) {
            return { success: false, error: 'Vui lòng chọn kết quả cuộc gọi' }
        }

        const trimmedPhone = data.phone.trim().replace(/\s+/g, '')
        const trimmedName = data.prospectName.trim()
        const trimmedNotes = data.notes?.trim() || null
        const followUp = data.followUpDate ? new Date(data.followUpDate) : null

        const createdLog = await prisma.$transaction(async (tx) => {
            const log = await tx.salesCallLog.create({
                data: {
                    salespersonId,
                    channel: data.channel as any,
                    customerId: data.customerId || null,
                    prospectName: trimmedName,
                    prospectCompany: data.prospectCompany?.trim() || null,
                    phone: trimmedPhone,
                    callType: data.callType,
                    outcome: data.outcome,
                    notes: trimmedNotes,
                    followUpDate: followUp,
                    durationMinutes: data.durationMinutes || 3,
                    calledAt: new Date(),
                }
            })

            // If customerId is provided, also record to CustomerActivity so it appears in 360° view
            if (data.customerId) {
                await tx.customerActivity.create({
                    data: {
                        customerId: data.customerId,
                        type: 'CALL',
                        description: `[Cuộc gọi ${data.channel}] ${data.callType} - Kết quả: ${data.outcome}${trimmedNotes ? ` (Ghi chú: ${trimmedNotes})` : ''}`,
                        performedBy: salespersonId,
                        occurredAt: new Date(),
                    }
                }).catch(() => {})
            }

            return log
        })

        revalidatePath('/dashboard/crm')
        return { success: true, logId: createdLog.id }
    } catch (err: any) {
        console.error('logSalesCallAction error:', err)
        return { success: false, error: err.message || 'Lỗi khi lưu nhật ký cuộc gọi' }
    }
}

export async function setSalesQuotaAction(data: {
    salesRepId: string
    year: number
    month?: number
    dailyCallTarget: number
    monthlyLeadTarget?: number
    monthlyDealTarget?: number
    monthlyRevenueTarget?: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const isManager = user.roles.some(r => ['CEO', 'SALES_MGR', 'SALES_ADMIN', 'ADMIN'].includes(r))
        if (!isManager) {
            return { success: false, error: 'Chỉ Quản lý / Ban Giám Đốc mới có quyền thiết lập chỉ tiêu KPI' }
        }

        const year = data.year
        const month = data.month || null

        await prisma.$transaction(async (tx) => {
            const saveMetric = async (metric: string, targetValue: number, unit: string) => {
                const existing = await tx.kpiTarget.findFirst({
                    where: {
                        metric,
                        year,
                        month,
                        salesRepId: data.salesRepId,
                    }
                })

                if (existing) {
                    await tx.kpiTarget.update({
                        where: { id: existing.id },
                        data: { targetValue, unit }
                    })
                } else {
                    await tx.kpiTarget.create({
                        data: {
                            metric,
                            year,
                            month,
                            salesRepId: data.salesRepId,
                            targetValue,
                            unit,
                        }
                    })
                }
            }

            // 1. Daily call quota
            await saveMetric('CALLS_DAILY', data.dailyCallTarget, 'cuộc')

            // 2. Monthly lead discovery target
            if (data.monthlyLeadTarget !== undefined) {
                await saveMetric('NEW_LEADS', data.monthlyLeadTarget, 'KH')
            }

            // 3. Monthly deal count target
            if (data.monthlyDealTarget !== undefined) {
                await saveMetric('DEALS_COUNT', data.monthlyDealTarget, 'deal')
            }
        })

        revalidateCache('kpi')
        revalidatePath('/dashboard/crm')
        revalidatePath('/dashboard/kpi')
        return { success: true }
    } catch (err: any) {
        console.error('setSalesQuotaAction error:', err)
        return { success: false, error: err.message || 'Lỗi khi thiết lập chỉ tiêu bán hàng' }
    }
}

export async function convertProspectToCustomerAction(data: {
    callLogId: string
    customerName: string
    companyName?: string
    phone: string
    channel: 'CORPORATE' | 'RETAIL'
    taxId?: string
    address?: string
}): Promise<{ success: boolean; error?: string; customerId?: string; code?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const prefix = data.channel === 'CORPORATE' ? 'CORP' : 'RET'
        const count = await prisma.customer.count()
        const code = `${prefix}-${String(count + 1).padStart(5, '0')}`

        const customer = await prisma.$transaction(async (tx) => {
            const newCust = await tx.customer.create({
                data: {
                    code,
                    name: data.customerName.trim(),
                    vatCompanyName: data.companyName?.trim() || (data.channel === 'CORPORATE' ? data.customerName.trim() : null),
                    channel: data.channel as any,
                    customerType: data.channel === 'CORPORATE' ? 'ENTERPRISE' : 'INDIVIDUAL' as any,
                    purchasingName: data.customerName.trim(),
                    purchasingPhone: data.phone.trim(),
                    taxId: data.taxId?.trim() || null,
                    vatAddress: data.address?.trim() || null,
                    salesRepId: user.id,
                    status: 'ACTIVE',
                    paymentTerm: data.channel === 'CORPORATE' ? 'NET30' : 'COD',
                }
            })

            // Link the call log to this new customer
            await tx.salesCallLog.update({
                where: { id: data.callLogId },
                data: { customerId: newCust.id }
            })

            // Add activity log
            await tx.customerActivity.create({
                data: {
                    customerId: newCust.id,
                    type: 'CALL',
                    description: `[Chuyển đổi thành công từ Telesales] Khách hàng tạo mới từ cuộc gọi chào hàng kênh ${data.channel}.`,
                    performedBy: user.id,
                    occurredAt: new Date(),
                }
            })

            return newCust
        })

        revalidateCache('crm')
        revalidatePath('/dashboard/crm')
        return { success: true, customerId: customer.id, code: customer.code }
    } catch (err: any) {
        console.error('convertProspectToCustomerAction error:', err)
        return { success: false, error: err.message || 'Lỗi khi chuyển đổi khách hàng' }
    }
}

// ═══════════════════════════════════════════════════
// TELESALES CALL PLANNER & REPORTING ACTIONS
// ═══════════════════════════════════════════════════

export interface SalesCallPlanItem {
    id: string
    salespersonId: string
    salespersonName: string
    assignedById: string | null
    assignedByName: string | null
    planDate: string
    channel: 'CORPORATE' | 'RETAIL'
    customerId: string | null
    customerCode?: string
    customerName?: string
    prospectName: string
    prospectCompany: string | null
    phone: string
    callType: string
    priority: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'
    status: 'PENDING' | 'COMPLETED' | 'RESCHEDULED' | 'CANCELLED' | 'OVERDUE'
    notes: string | null
    scheduledTime: string | null
    callLogId: string | null
    completedAt: string | null
    createdAt: string
    callOutcome?: string | null
    callDurationMinutes?: number | null
}

export interface DailyCallPlanResponse {
    success: boolean
    error?: string
    dateStr: string
    isManager: boolean
    currentUserId?: string
    selectedSalesRepId?: string
    stats: {
        totalPlanned: number
        completed: number
        pending: number
        rescheduled: number
        overdue: number
        completionRate: number
        corporatePlanned: number
        retailPlanned: number
    }
    plans: SalesCallPlanItem[]
    salesReps: Array<{ id: string; name: string; email: string }>
}

export async function getDailyCallPlanAction(filters?: {
    date?: string
    salesRepId?: string
    status?: string
    channel?: string
}): Promise<DailyCallPlanResponse> {
    try {
        const user = await getCurrentUser()
        if (!user) return {
            success: false,
            error: 'Chưa đăng nhập',
            dateStr: '',
            isManager: false,
            stats: { totalPlanned: 0, completed: 0, pending: 0, rescheduled: 0, overdue: 0, completionRate: 0, corporatePlanned: 0, retailPlanned: 0 },
            plans: [],
            salesReps: [],
        }

        const isManager = user.roles.some(r => ['CEO', 'SALES_MGR', 'SALES_ADMIN', 'ADMIN'].includes(r))
        const queryRepId = (isManager && filters?.salesRepId && filters.salesRepId !== 'ALL')
            ? filters.salesRepId
            : (!isManager ? user.id : undefined)

        // Date calculation
        const now = new Date()
        const todayVnStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)
        const activeDateStr = filters?.date || todayVnStr
        const [targetYear, targetMonth, targetDay] = activeDateStr.split('-').map(Number)

        const startOfDay = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 0, 0, 0))
        const endOfDay = new Date(Date.UTC(targetYear, targetMonth - 1, targetDay, 23, 59, 59, 999))

        const where: any = {
            planDate: { gte: startOfDay, lte: endOfDay }
        }
        if (queryRepId) where.salespersonId = queryRepId
        if (filters?.channel && filters.channel !== 'ALL') where.channel = filters.channel as any
        if (filters?.status && filters.status !== 'ALL') where.status = filters.status

        const [plansDb, repsDb] = await Promise.all([
            prisma.salesCallPlan.findMany({
                where,
                orderBy: [
                    { priority: 'asc' },
                    { createdAt: 'asc' },
                ],
                include: {
                    salesperson: { select: { id: true, name: true } },
                    assignedBy: { select: { id: true, name: true } },
                    customer: { select: { id: true, code: true, name: true } },
                    callLog: { select: { id: true, outcome: true, durationMinutes: true } },
                }
            }),
            prisma.user.findMany({
                where: { status: 'ACTIVE' },
                select: { id: true, name: true, email: true },
                orderBy: { name: 'asc' },
                take: 50,
            })
        ])

        const totalPlanned = plansDb.length
        const completed = plansDb.filter(p => p.status === 'COMPLETED').length
        const pending = plansDb.filter(p => p.status === 'PENDING').length
        const rescheduled = plansDb.filter(p => p.status === 'RESCHEDULED').length
        const overdue = plansDb.filter(p => p.status === 'OVERDUE').length
        const corporatePlanned = plansDb.filter(p => p.channel === 'CORPORATE').length
        const retailPlanned = plansDb.filter(p => p.channel === 'RETAIL').length
        const completionRate = totalPlanned > 0 ? Math.round((completed / totalPlanned) * 100) : 0

        return {
            success: true,
            dateStr: activeDateStr,
            isManager,
            currentUserId: user.id,
            selectedSalesRepId: queryRepId,
            stats: {
                totalPlanned,
                completed,
                pending,
                rescheduled,
                overdue,
                completionRate,
                corporatePlanned,
                retailPlanned,
            },
            plans: plansDb.map(p => ({
                id: p.id,
                salespersonId: p.salespersonId,
                salespersonName: p.salesperson.name,
                assignedById: p.assignedById,
                assignedByName: p.assignedBy?.name || null,
                planDate: p.planDate.toISOString(),
                channel: p.channel as 'CORPORATE' | 'RETAIL',
                customerId: p.customerId,
                customerCode: p.customer?.code,
                customerName: p.customer?.name,
                prospectName: p.prospectName,
                prospectCompany: p.prospectCompany,
                phone: p.phone,
                callType: p.callType,
                priority: p.priority as any,
                status: p.status as any,
                notes: p.notes,
                scheduledTime: p.scheduledTime,
                callLogId: p.callLogId,
                completedAt: p.completedAt ? p.completedAt.toISOString() : null,
                createdAt: p.createdAt.toISOString(),
                callOutcome: p.callLog?.outcome || null,
                callDurationMinutes: p.callLog?.durationMinutes || null,
            })),
            salesReps: repsDb,
        }
    } catch (err: any) {
        console.error('getDailyCallPlanAction error:', err)
        return {
            success: false,
            error: err.message || 'Lỗi khi tải kế hoạch cuộc gọi ngày',
            dateStr: '',
            isManager: false,
            stats: { totalPlanned: 0, completed: 0, pending: 0, rescheduled: 0, overdue: 0, completionRate: 0, corporatePlanned: 0, retailPlanned: 0 },
            plans: [],
            salesReps: [],
        }
    }
}

export async function createCallPlanItemAction(data: {
    salespersonId?: string
    planDate: string
    channel: 'CORPORATE' | 'RETAIL'
    customerId?: string
    prospectName: string
    prospectCompany?: string
    phone: string
    callType?: string
    priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'
    notes?: string
    scheduledTime?: string
}): Promise<{ success: boolean; error?: string; planId?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const isManager = user.roles.some(r => ['CEO', 'SALES_MGR', 'SALES_ADMIN', 'ADMIN'].includes(r))
        const salespersonId = (isManager && data.salespersonId) ? data.salespersonId : user.id
        const assignedById = isManager && salespersonId !== user.id ? user.id : null

        if (!data.phone || data.phone.trim().length < 8) {
            return { success: false, error: 'Số điện thoại không hợp lệ (tối thiểu 8 số)' }
        }
        if (!data.prospectName || data.prospectName.trim().length < 2) {
            return { success: false, error: 'Vui lòng nhập tên khách hàng / người liên hệ' }
        }

        const [y, m, d] = data.planDate.split('-').map(Number)
        const planDateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))

        const created = await prisma.salesCallPlan.create({
            data: {
                salespersonId,
                assignedById,
                planDate: planDateObj,
                channel: data.channel as any,
                customerId: data.customerId || null,
                prospectName: data.prospectName.trim(),
                prospectCompany: data.prospectCompany?.trim() || null,
                phone: data.phone.trim().replace(/\s+/g, ''),
                callType: data.callType?.trim() || 'Chào hàng mới',
                priority: data.priority || 'NORMAL',
                status: 'PENDING',
                notes: data.notes?.trim() || null,
                scheduledTime: data.scheduledTime?.trim() || null,
            }
        })

        revalidatePath('/dashboard/crm')
        return { success: true, planId: created.id }
    } catch (err: any) {
        console.error('createCallPlanItemAction error:', err)
        return { success: false, error: err.message || 'Lỗi khi thêm kế hoạch cuộc gọi' }
    }
}

export async function assignCallPlanBatchAction(data: {
    targetSalesRepIds: string[]
    customerIds?: string[]
    customLeads?: Array<{ name: string; company?: string; phone: string }>
    planDate: string
    channel: 'CORPORATE' | 'RETAIL'
    callType?: string
    priority?: 'URGENT' | 'HIGH' | 'NORMAL' | 'LOW'
    notes?: string
}): Promise<{ success: boolean; error?: string; count?: number }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const isManager = user.roles.some(r => ['CEO', 'SALES_MGR', 'SALES_ADMIN', 'ADMIN'].includes(r))
        if (!isManager) {
            return { success: false, error: 'Chỉ Quản lý / Ban Giám Đốc mới có quyền phân bổ danh sách gọi' }
        }

        if (!data.targetSalesRepIds || data.targetSalesRepIds.length === 0) {
            return { success: false, error: 'Vui lòng chọn ít nhất 1 nhân viên Telesale nhận việc' }
        }

        const [y, m, d] = data.planDate.split('-').map(Number)
        const planDateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))

        // Collect all items to create
        const itemsToCreate: any[] = []

        // 1. From existing customers
        if (data.customerIds && data.customerIds.length > 0) {
            const customers = await prisma.customer.findMany({
                where: { id: { in: data.customerIds } },
                select: { id: true, name: true, vatCompanyName: true, purchasingPhone: true, channel: true }
            })
            for (const cust of customers) {
                itemsToCreate.push({
                    customerId: cust.id,
                    prospectName: cust.name,
                    prospectCompany: cust.vatCompanyName || null,
                    phone: cust.purchasingPhone || '0900000000',
                    channel: data.channel || cust.channel,
                })
            }
        }

        // 2. From custom leads
        if (data.customLeads && data.customLeads.length > 0) {
            for (const lead of data.customLeads) {
                if (lead.phone && lead.name) {
                    itemsToCreate.push({
                        customerId: null,
                        prospectName: lead.name,
                        prospectCompany: lead.company || null,
                        phone: lead.phone.trim().replace(/\s+/g, ''),
                        channel: data.channel,
                    })
                }
            }
        }

        if (itemsToCreate.length === 0) {
            return { success: false, error: 'Không có khách hàng hoặc đầu mối nào được chọn để phân bổ' }
        }

        // Round-robin distribution among selected reps
        const reps = data.targetSalesRepIds
        let count = 0

        await prisma.$transaction(async (tx) => {
            for (let i = 0; i < itemsToCreate.length; i++) {
                const assignedRepId = reps[i % reps.length]
                const item = itemsToCreate[i]

                await tx.salesCallPlan.create({
                    data: {
                        salespersonId: assignedRepId,
                        assignedById: user.id,
                        planDate: planDateObj,
                        channel: item.channel as any,
                        customerId: item.customerId,
                        prospectName: item.prospectName,
                        prospectCompany: item.prospectCompany,
                        phone: item.phone,
                        callType: data.callType || 'Chăm sóc khách hàng định kỳ',
                        priority: data.priority || 'NORMAL',
                        status: 'PENDING',
                        notes: data.notes?.trim() || null,
                    }
                })
                count++
            }
        })

        revalidatePath('/dashboard/crm')
        return { success: true, count }
    } catch (err: any) {
        console.error('assignCallPlanBatchAction error:', err)
        return { success: false, error: err.message || 'Lỗi khi phân bổ danh sách gọi' }
    }
}

export async function completeCallPlanWithReportAction(data: {
    planId: string
    outcome: string
    durationMinutes?: number
    notes?: string
    followUpDate?: string
}): Promise<{ success: boolean; error?: string; logId?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const plan = await prisma.salesCallPlan.findUnique({
            where: { id: data.planId },
            include: { customer: true }
        })
        if (!plan) return { success: false, error: 'Không tìm thấy mục kế hoạch cuộc gọi' }

        const isManager = user.roles.some(r => ['CEO', 'SALES_MGR', 'SALES_ADMIN', 'ADMIN'].includes(r))
        if (!isManager && plan.salespersonId !== user.id) {
            return { success: false, error: 'Bạn không có quyền báo cáo cho kế hoạch của nhân viên khác' }
        }

        const duration = data.durationMinutes || 3
        const followUp = data.followUpDate ? new Date(data.followUpDate) : null
        const trimmedNotes = data.notes?.trim() || null

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create SalesCallLog
            const callLog = await tx.salesCallLog.create({
                data: {
                    salespersonId: plan.salespersonId,
                    channel: plan.channel,
                    customerId: plan.customerId,
                    prospectName: plan.prospectName,
                    prospectCompany: plan.prospectCompany,
                    phone: plan.phone,
                    callType: plan.callType,
                    outcome: data.outcome,
                    notes: trimmedNotes,
                    followUpDate: followUp,
                    durationMinutes: duration,
                    calledAt: new Date(),
                }
            })

            // 2. Update SalesCallPlan to COMPLETED and link callLogId
            await tx.salesCallPlan.update({
                where: { id: plan.id },
                data: {
                    status: 'COMPLETED',
                    completedAt: new Date(),
                    callLogId: callLog.id,
                }
            })

            // 3. If followUpDate is specified and customer wants callback, create automatic follow-up plan for that date
            if (followUp && (data.outcome.includes('BUSY') || data.outcome.includes('CALLBACK') || data.outcome.includes('INTERESTED'))) {
                await tx.salesCallPlan.create({
                    data: {
                        salespersonId: plan.salespersonId,
                        assignedById: user.id,
                        planDate: followUp,
                        channel: plan.channel,
                        customerId: plan.customerId,
                        prospectName: plan.prospectName,
                        prospectCompany: plan.prospectCompany,
                        phone: plan.phone,
                        callType: `Lịch hẹn gọi lại: ${plan.callType}`,
                        priority: 'HIGH',
                        status: 'PENDING',
                        notes: `[Tự động từ cuộc gọi ngày ${new Date().toLocaleDateString('vi-VN')}]: ${trimmedNotes || 'Khách hẹn gọi lại'}`,
                    }
                })
            }

            // 4. Log to CustomerActivity if customer exists
            if (plan.customerId) {
                await tx.customerActivity.create({
                    data: {
                        customerId: plan.customerId,
                        type: 'CALL',
                        description: `[Kế hoạch gọi ${plan.channel}] ${plan.callType} - Báo cáo: ${data.outcome} (${duration} phút)${trimmedNotes ? ` | Ghi chú: ${trimmedNotes}` : ''}`,
                        performedBy: plan.salespersonId,
                        occurredAt: new Date(),
                    }
                }).catch(() => {})
            }

            return callLog
        })

        revalidatePath('/dashboard/crm')
        return { success: true, logId: result.id }
    } catch (err: any) {
        console.error('completeCallPlanWithReportAction error:', err)
        return { success: false, error: err.message || 'Lỗi khi lưu báo cáo cuộc gọi' }
    }
}

export async function updateCallPlanStatusAction(data: {
    planId: string
    status: 'PENDING' | 'RESCHEDULED' | 'CANCELLED'
    rescheduleDate?: string
    notes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const plan = await prisma.salesCallPlan.findUnique({ where: { id: data.planId } })
        if (!plan) return { success: false, error: 'Không tìm thấy kế hoạch' }

        const isManager = user.roles.some(r => ['CEO', 'SALES_MGR', 'SALES_ADMIN', 'ADMIN'].includes(r))
        if (!isManager && plan.salespersonId !== user.id) {
            return { success: false, error: 'Không có quyền cập nhật kế hoạch này' }
        }

        const updateData: any = { status: data.status }
        if (data.notes) updateData.notes = data.notes

        if (data.status === 'RESCHEDULED' && data.rescheduleDate) {
            const [y, m, d] = data.rescheduleDate.split('-').map(Number)
            updateData.planDate = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
            updateData.status = 'PENDING' // reset to pending on new date
        }

        await prisma.salesCallPlan.update({
            where: { id: data.planId },
            data: updateData
        })

        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        console.error('updateCallPlanStatusAction error:', err)
        return { success: false, error: err.message || 'Lỗi khi cập nhật trạng thái kế hoạch' }
    }
}

export async function deleteCallPlanItemAction(planId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const user = await getCurrentUser()
        if (!user) return { success: false, error: 'Chưa đăng nhập' }

        const plan = await prisma.salesCallPlan.findUnique({ where: { id: planId } })
        if (!plan) return { success: false, error: 'Không tìm thấy kế hoạch' }

        const isManager = user.roles.some(r => ['CEO', 'SALES_MGR', 'SALES_ADMIN', 'ADMIN'].includes(r))
        if (!isManager && plan.salespersonId !== user.id) {
            return { success: false, error: 'Không có quyền xóa kế hoạch này' }
        }

        await prisma.salesCallPlan.delete({ where: { id: planId } })

        revalidatePath('/dashboard/crm')
        return { success: true }
    } catch (err: any) {
        console.error('deleteCallPlanItemAction error:', err)
        return { success: false, error: err.message || 'Lỗi khi xóa kế hoạch' }
    }
}


