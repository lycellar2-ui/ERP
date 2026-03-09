'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'

// ═══════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════

export type ShipmentRow = {
    id: string; billOfLading: string; poNo: string; supplierName: string
    vesselName: string | null; containerNo: string | null
    portOfLoading: string | null; portOfDischarge: string | null
    etd: Date | null; eta: Date | null; ata: Date | null
    cifAmount: number; cifCurrency: string; status: string
    incoterms: string | null; forwarderName: string | null
    milestoneProgress: number; totalCosts: number; createdAt: Date
}

export type ShipmentDetail = ShipmentRow & {
    poId: string; voyageNo: string | null; containerType: string | null
    freightAmount: number | null; insuranceAmount: number | null
    customsBrokerId: string | null; forwarderId: string | null
    costItems: CostItemRow[]
    milestones: MilestoneRow[]
    customs: CustomsDeclRow | null
    insurance: InsurancePolicyRow | null
}

export type CostItemRow = {
    id: string; category: string; description: string
    amount: number; currency: string; amountVND: number
    paidTo: string | null; invoiceNo: string | null; paidAt: Date | null
}

export type MilestoneRow = {
    id: string; milestone: string; label: string
    completedAt: Date | null; completedBy: string | null; notes: string | null; sortOrder: number
}

export type CustomsDeclRow = {
    id: string; declarationNo: string | null; declarationType: string | null
    registeredAt: Date | null; clearedAt: Date | null; customsOffice: string | null
    coFormType: string | null; coNumber: string | null; hsCode: string | null
    importTaxRate: number | null; importTaxAmount: number | null
    sctRate: number | null; sctAmount: number | null
    vatRate: number | null; vatAmount: number | null; totalTax: number | null
    inspectionResult: string | null; inspectionBody: string | null; inspectionDate: Date | null
    status: string; notes: string | null
}

export type InsurancePolicyRow = {
    id: string; policyNo: string | null; insurer: string | null
    insuredValue: number | null; premium: number | null; currency: string
    coverageType: string | null; startDate: Date | null; endDate: Date | null
    status: string; claimAmount: number | null; claimNotes: string | null
}

// Default milestone templates per Incoterms
const MILESTONE_TEMPLATES: Record<string, { milestone: string; label: string }[]> = {
    EXW: [
        { milestone: 'PO_CONFIRMED', label: 'PO xác nhận' },
        { milestone: 'PICKUP_ARRANGED', label: 'Đặt xe lấy hàng' },
        { milestone: 'INSURANCE_BOUGHT', label: 'Mua bảo hiểm' },
        { milestone: 'BOOKING_CONFIRMED', label: 'Booking tàu' },
        { milestone: 'DOCS_RECEIVED', label: 'Nhận chứng từ gốc' },
        { milestone: 'LOADED', label: 'Xếp hàng lên container' },
        { milestone: 'DEPARTED', label: 'Tàu rời cảng' },
        { milestone: 'ARRIVED', label: 'Tàu cập cảng VN' },
        { milestone: 'CUSTOMS_FILED', label: 'Khai HQ' },
        { milestone: 'INSPECTION_DONE', label: 'Giám định chất lượng' },
        { milestone: 'CUSTOMS_CLEARED', label: 'Thông quan' },
        { milestone: 'STAMPED', label: 'Dán tem rượu' },
        { milestone: 'WAREHOUSED', label: 'Nhập kho' },
    ],
    FOB: [
        { milestone: 'PO_CONFIRMED', label: 'PO xác nhận' },
        { milestone: 'INSURANCE_BOUGHT', label: 'Mua bảo hiểm' },
        { milestone: 'BOOKING_CONFIRMED', label: 'Booking tàu' },
        { milestone: 'DOCS_RECEIVED', label: 'Nhận chứng từ gốc' },
        { milestone: 'LOADED', label: 'Hàng lên tàu (FOB)' },
        { milestone: 'DEPARTED', label: 'Tàu rời cảng' },
        { milestone: 'ARRIVED', label: 'Tàu cập cảng VN' },
        { milestone: 'CUSTOMS_FILED', label: 'Khai HQ' },
        { milestone: 'INSPECTION_DONE', label: 'Giám định chất lượng' },
        { milestone: 'CUSTOMS_CLEARED', label: 'Thông quan' },
        { milestone: 'STAMPED', label: 'Dán tem rượu' },
        { milestone: 'WAREHOUSED', label: 'Nhập kho' },
    ],
    CIF: [
        { milestone: 'PO_CONFIRMED', label: 'PO xác nhận' },
        { milestone: 'DOCS_RECEIVED', label: 'Nhận chứng từ gốc' },
        { milestone: 'DEPARTED', label: 'Tàu rời cảng (NCC lo)' },
        { milestone: 'ARRIVED', label: 'Tàu cập cảng VN' },
        { milestone: 'CUSTOMS_FILED', label: 'Khai HQ' },
        { milestone: 'INSPECTION_DONE', label: 'Giám định chất lượng' },
        { milestone: 'CUSTOMS_CLEARED', label: 'Thông quan' },
        { milestone: 'STAMPED', label: 'Dán tem rượu' },
        { milestone: 'WAREHOUSED', label: 'Nhập kho' },
    ],
}

import { COST_CATEGORIES } from './shipment-constants'

// ═══════════════════════════════════════════════════
// LIST SHIPMENTS
// ═══════════════════════════════════════════════════

export async function getShipments(filters: {
    status?: string; search?: string; page?: number; pageSize?: number
} = {}): Promise<{ rows: ShipmentRow[]; total: number }> {
    const { status, search, page = 1, pageSize = 20 } = filters
    const cacheKey = `shipments:list:${page}:${pageSize}:${status ?? ''}:${search ?? ''}`
    return cached(cacheKey, async () => {
        const where: any = {}
        if (status) where.status = status
        if (search) {
            where.OR = [
                { billOfLading: { contains: search, mode: 'insensitive' } },
                { vesselName: { contains: search, mode: 'insensitive' } },
                { containerNo: { contains: search, mode: 'insensitive' } },
                { po: { poNo: { contains: search, mode: 'insensitive' } } },
                { po: { supplier: { name: { contains: search, mode: 'insensitive' } } } },
            ]
        }

        const [items, total] = await Promise.all([
            prisma.shipment.findMany({
                where,
                include: {
                    po: { include: { supplier: { select: { name: true } } } },
                    costItems: { select: { amountVND: true } },
                    milestones: { select: { completedAt: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            prisma.shipment.count({ where }),
        ])

        const rows: ShipmentRow[] = items.map(s => {
            const totalMilestones = s.milestones.length
            const completedMilestones = s.milestones.filter(m => m.completedAt).length
            return {
                id: s.id, billOfLading: s.billOfLading, poNo: s.po.poNo,
                supplierName: s.po.supplier.name, vesselName: s.vesselName,
                containerNo: s.containerNo, portOfLoading: s.portOfLoading,
                portOfDischarge: s.portOfDischarge, etd: s.etd, eta: s.eta, ata: s.ata,
                cifAmount: Number(s.cifAmount), cifCurrency: s.cifCurrency,
                status: s.status, incoterms: s.incoterms,
                forwarderName: null, // Will be resolved if needed
                milestoneProgress: totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0,
                totalCosts: s.costItems.reduce((sum, c) => sum + Number(c.amountVND), 0),
                createdAt: s.createdAt,
            }
        })

        return { rows, total }
    }, 30_000) // 30s cache
}

// ═══════════════════════════════════════════════════
// GET SHIPMENT DETAIL
// ═══════════════════════════════════════════════════

export async function getShipmentDetail(id: string): Promise<ShipmentDetail | null> {
    const s = await prisma.shipment.findUnique({
        where: { id },
        include: {
            po: { include: { supplier: { select: { name: true } } } },
            costItems: { orderBy: { createdAt: 'desc' } },
            milestones: { orderBy: { sortOrder: 'asc' } },
            customsDecl: true,
            insurancePolicy: true,
        },
    })
    if (!s) return null

    return {
        id: s.id, billOfLading: s.billOfLading, poNo: s.po.poNo, poId: s.poId,
        supplierName: s.po.supplier.name, vesselName: s.vesselName,
        voyageNo: s.voyageNo, containerNo: s.containerNo, containerType: s.containerType,
        portOfLoading: s.portOfLoading, portOfDischarge: s.portOfDischarge,
        etd: s.etd, eta: s.eta, ata: s.ata,
        cifAmount: Number(s.cifAmount), cifCurrency: s.cifCurrency,
        freightAmount: s.freightAmount ? Number(s.freightAmount) : null,
        insuranceAmount: s.insuranceAmount ? Number(s.insuranceAmount) : null,
        status: s.status, incoterms: s.incoterms,
        forwarderId: s.forwarderId, customsBrokerId: s.customsBrokerId,
        forwarderName: null,
        milestoneProgress: s.milestones.length > 0
            ? Math.round((s.milestones.filter(m => m.completedAt).length / s.milestones.length) * 100) : 0,
        totalCosts: s.costItems.reduce((sum, c) => sum + Number(c.amountVND), 0),
        createdAt: s.createdAt,
        costItems: s.costItems.map(c => ({
            id: c.id, category: c.category, description: c.description,
            amount: Number(c.amount), currency: c.currency, amountVND: Number(c.amountVND),
            paidTo: c.paidTo, invoiceNo: c.invoiceNo, paidAt: c.paidAt,
        })),
        milestones: s.milestones.map(m => ({
            id: m.id, milestone: m.milestone, label: m.label,
            completedAt: m.completedAt, completedBy: m.completedBy,
            notes: m.notes, sortOrder: m.sortOrder,
        })),
        customs: s.customsDecl ? {
            id: s.customsDecl.id,
            declarationNo: s.customsDecl.declarationNo, declarationType: s.customsDecl.declarationType,
            registeredAt: s.customsDecl.registeredAt, clearedAt: s.customsDecl.clearedAt,
            customsOffice: s.customsDecl.customsOffice,
            coFormType: s.customsDecl.coFormType, coNumber: s.customsDecl.coNumber,
            hsCode: s.customsDecl.hsCode,
            importTaxRate: s.customsDecl.importTaxRate ? Number(s.customsDecl.importTaxRate) : null,
            importTaxAmount: s.customsDecl.importTaxAmount ? Number(s.customsDecl.importTaxAmount) : null,
            sctRate: s.customsDecl.sctRate ? Number(s.customsDecl.sctRate) : null,
            sctAmount: s.customsDecl.sctAmount ? Number(s.customsDecl.sctAmount) : null,
            vatRate: s.customsDecl.vatRate ? Number(s.customsDecl.vatRate) : null,
            vatAmount: s.customsDecl.vatAmount ? Number(s.customsDecl.vatAmount) : null,
            totalTax: s.customsDecl.totalTax ? Number(s.customsDecl.totalTax) : null,
            inspectionResult: s.customsDecl.inspectionResult, inspectionBody: s.customsDecl.inspectionBody,
            inspectionDate: s.customsDecl.inspectionDate,
            status: s.customsDecl.status, notes: s.customsDecl.notes,
        } : null,
        insurance: s.insurancePolicy ? {
            id: s.insurancePolicy.id,
            policyNo: s.insurancePolicy.policyNo, insurer: s.insurancePolicy.insurer,
            insuredValue: s.insurancePolicy.insuredValue ? Number(s.insurancePolicy.insuredValue) : null,
            premium: s.insurancePolicy.premium ? Number(s.insurancePolicy.premium) : null,
            currency: s.insurancePolicy.currency, coverageType: s.insurancePolicy.coverageType,
            startDate: s.insurancePolicy.startDate, endDate: s.insurancePolicy.endDate,
            status: s.insurancePolicy.status,
            claimAmount: s.insurancePolicy.claimAmount ? Number(s.insurancePolicy.claimAmount) : null,
            claimNotes: s.insurancePolicy.claimNotes,
        } : null,
    }
}

// ═══════════════════════════════════════════════════
// CREATE SHIPMENT (with auto milestones)
// ═══════════════════════════════════════════════════

export async function createShipment(input: {
    poId: string; billOfLading: string; vesselName?: string; voyageNo?: string
    containerNo?: string; containerType?: string
    portOfLoading?: string; portOfDischarge?: string
    etd?: string; eta?: string; cifAmount: number; cifCurrency?: string
    freightAmount?: number; insuranceAmount?: number; incoterms?: string
    forwarderId?: string; customsBrokerId?: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const incoterms = input.incoterms ?? 'EXW'
        const shipment = await prisma.shipment.create({
            data: {
                poId: input.poId,
                billOfLading: input.billOfLading,
                vesselName: input.vesselName ?? null,
                voyageNo: input.voyageNo ?? null,
                containerNo: input.containerNo ?? null,
                containerType: input.containerType ?? null,
                portOfLoading: input.portOfLoading ?? null,
                portOfDischarge: input.portOfDischarge ?? 'VNSGN',
                etd: input.etd ? new Date(input.etd) : null,
                eta: input.eta ? new Date(input.eta) : null,
                cifAmount: input.cifAmount,
                cifCurrency: input.cifCurrency ?? 'USD',
                freightAmount: input.freightAmount ?? null,
                insuranceAmount: input.insuranceAmount ?? null,
                incoterms,
                forwarderId: input.forwarderId ?? null,
                customsBrokerId: input.customsBrokerId ?? null,
                status: 'BOOKED',
            },
        })

        // Auto-create milestones based on Incoterms
        const template = MILESTONE_TEMPLATES[incoterms] ?? MILESTONE_TEMPLATES.EXW
        await prisma.shipmentMilestone.createMany({
            data: template.map((t, i) => ({
                shipmentId: shipment.id,
                milestone: t.milestone,
                label: t.label,
                sortOrder: i * 10,
            })),
        })

        // Update PO status
        await prisma.purchaseOrder.update({
            where: { id: input.poId },
            data: { status: 'IN_TRANSIT' },
        })

        revalidatePath('/dashboard/procurement')
        return { success: true, id: shipment.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// UPDATE SHIPMENT
// ═══════════════════════════════════════════════════

export async function updateShipment(id: string, input: Partial<{
    vesselName: string; voyageNo: string; containerNo: string; containerType: string
    portOfLoading: string; portOfDischarge: string; etd: string; eta: string; ata: string
    status: string; forwarderId: string; customsBrokerId: string
}>): Promise<{ success: boolean; error?: string }> {
    try {
        const data: any = { ...input }
        if (input.etd) data.etd = new Date(input.etd)
        if (input.eta) data.eta = new Date(input.eta)
        if (input.ata) data.ata = new Date(input.ata)

        await prisma.shipment.update({ where: { id }, data })
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// MILESTONE MANAGEMENT
// ═══════════════════════════════════════════════════

export async function completeMilestone(id: string, notes?: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.shipmentMilestone.update({
            where: { id },
            data: { completedAt: new Date(), notes: notes ?? null },
        })
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function uncompleteMilestone(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.shipmentMilestone.update({
            where: { id },
            data: { completedAt: null, completedBy: null },
        })
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function addCustomMilestone(shipmentId: string, label: string): Promise<{ success: boolean; error?: string }> {
    try {
        const maxSort = await prisma.shipmentMilestone.findFirst({
            where: { shipmentId },
            orderBy: { sortOrder: 'desc' },
            select: { sortOrder: true },
        })
        await prisma.shipmentMilestone.create({
            data: {
                shipmentId,
                milestone: 'CUSTOM',
                label,
                sortOrder: (maxSort?.sortOrder ?? 0) + 10,
            },
        })
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// COST ITEM MANAGEMENT
// ═══════════════════════════════════════════════════

export async function addCostItem(input: {
    shipmentId: string; category: string; description: string
    amount: number; currency?: string; exchangeRate?: number
    paidTo?: string; invoiceNo?: string; paidAt?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const currency = input.currency ?? 'VND'
        const exchangeRate = input.exchangeRate ?? 1
        const amountVND = currency === 'VND' ? input.amount : Math.round(input.amount * exchangeRate)

        await prisma.shipmentCostItem.create({
            data: {
                shipmentId: input.shipmentId,
                category: input.category,
                description: input.description,
                amount: input.amount,
                currency,
                exchangeRate,
                amountVND,
                paidTo: input.paidTo ?? null,
                invoiceNo: input.invoiceNo ?? null,
                paidAt: input.paidAt ? new Date(input.paidAt) : null,
            },
        })
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteCostItem(id: string): Promise<{ success: boolean }> {
    await prisma.shipmentCostItem.delete({ where: { id } })
    revalidatePath('/dashboard/procurement')
    return { success: true }
}

export async function getLandedCostBreakdown(shipmentId: string) {
    const [costItems, shipment] = await Promise.all([
        prisma.shipmentCostItem.findMany({ where: { shipmentId }, orderBy: { category: 'asc' } }),
        prisma.shipment.findUnique({
            where: { id: shipmentId },
            include: {
                po: { include: { lines: { include: { product: { select: { productName: true, skuCode: true } } } } } },
                customsDecl: { select: { importTaxAmount: true, sctAmount: true, vatAmount: true, totalTax: true } },
            },
        }),
    ])
    if (!shipment) return null

    const categoryTotals = new Map<string, number>()
    for (const item of costItems) {
        categoryTotals.set(item.category, (categoryTotals.get(item.category) ?? 0) + Number(item.amountVND))
    }

    const cifVND = Number(shipment.cifAmount) * Number(shipment.po.exchangeRate)
    const totalCosts = costItems.reduce((s, c) => s + Number(c.amountVND), 0)
    const taxTotal = shipment.customsDecl?.totalTax ? Number(shipment.customsDecl.totalTax) : 0
    const grandTotal = cifVND + totalCosts + taxTotal
    const totalQty = shipment.po.lines.reduce((s, l) => s + Number(l.qtyOrdered), 0)

    return {
        cifVND: Math.round(cifVND),
        costsByCategory: Array.from(categoryTotals.entries()).map(([cat, total]) => ({
            category: cat,
            label: COST_CATEGORIES.find(c => c.key === cat)?.label ?? cat,
            totalVND: Math.round(total),
        })),
        taxBreakdown: {
            importTax: shipment.customsDecl?.importTaxAmount ? Number(shipment.customsDecl.importTaxAmount) : 0,
            sct: shipment.customsDecl?.sctAmount ? Number(shipment.customsDecl.sctAmount) : 0,
            vat: shipment.customsDecl?.vatAmount ? Number(shipment.customsDecl.vatAmount) : 0,
            total: taxTotal,
        },
        totalCosts: Math.round(totalCosts),
        grandTotal: Math.round(grandTotal),
        totalQty,
        avgLandedCostPerUnit: totalQty > 0 ? Math.round(grandTotal / totalQty) : 0,
        productBreakdown: shipment.po.lines.map(l => ({
            skuCode: l.product.skuCode,
            productName: l.product.productName,
            qty: Number(l.qtyOrdered),
            unitCIF: Math.round(Number(l.unitPrice) * Number(shipment.po.exchangeRate)),
            estimatedLandedCost: totalQty > 0
                ? Math.round((Number(l.qtyOrdered) / totalQty) * grandTotal / Number(l.qtyOrdered))
                : 0,
        })),
    }
}

// ═══════════════════════════════════════════════════
// CUSTOMS DECLARATION
// ═══════════════════════════════════════════════════

export async function upsertCustomsDeclaration(shipmentId: string, input: {
    declarationNo?: string; declarationType?: string; registeredAt?: string
    clearedAt?: string; customsOffice?: string; coFormType?: string; coNumber?: string
    hsCode?: string; importTaxRate?: number; importTaxAmount?: number
    sctRate?: number; sctAmount?: number; vatRate?: number; vatAmount?: number
    totalTax?: number; inspectionResult?: string; inspectionBody?: string
    inspectionDate?: string; status?: string; notes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const data: any = { ...input }
        if (input.registeredAt) data.registeredAt = new Date(input.registeredAt)
        if (input.clearedAt) data.clearedAt = new Date(input.clearedAt)
        if (input.inspectionDate) data.inspectionDate = new Date(input.inspectionDate)

        await prisma.customsDeclaration.upsert({
            where: { shipmentId },
            create: { shipmentId, ...data },
            update: data,
        })
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// INSURANCE POLICY
// ═══════════════════════════════════════════════════

export async function upsertInsurancePolicy(shipmentId: string, input: {
    policyNo?: string; insurer?: string; insuredValue?: number; premium?: number
    currency?: string; coverageType?: string; startDate?: string; endDate?: string
    status?: string; claimAmount?: number; claimNotes?: string
}): Promise<{ success: boolean; error?: string }> {
    try {
        const data: any = { ...input }
        if (input.startDate) data.startDate = new Date(input.startDate)
        if (input.endDate) data.endDate = new Date(input.endDate)

        await prisma.insurancePolicy.upsert({
            where: { shipmentId },
            create: { shipmentId, ...data },
            update: data,
        })
        revalidatePath('/dashboard/procurement')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// SHIPMENT STATS
// ═══════════════════════════════════════════════════

export async function getShipmentStats() {
    const [total, booked, onVessel, atPort, customsFiling, cleared, delivered] = await Promise.all([
        prisma.shipment.count(),
        prisma.shipment.count({ where: { status: 'BOOKED' } }),
        prisma.shipment.count({ where: { status: 'ON_VESSEL' } }),
        prisma.shipment.count({ where: { status: 'ARRIVED_PORT' } }),
        prisma.shipment.count({ where: { status: { in: ['CUSTOMS_FILING', 'CUSTOMS_INSPECTING'] } } }),
        prisma.shipment.count({ where: { status: 'CUSTOMS_CLEARED' } }),
        prisma.shipment.count({ where: { status: 'DELIVERED_TO_WAREHOUSE' } }),
    ])
    return { total, booked, onVessel, atPort, customsFiling, cleared, delivered }
}

// ═══════════════════════════════════════════════════
// GET FORWARDERS/BROKERS (for assignment dropdown)
// ═══════════════════════════════════════════════════

export async function getForwardersAndBrokers() {
    const partners = await prisma.externalPartner.findMany({
        where: { status: 'ACTIVE', type: { in: ['FORWARDER', 'CUSTOMS_BROKER'] } },
        select: { id: true, name: true, type: true, code: true },
        orderBy: { name: 'asc' },
    })
    return {
        forwarders: partners.filter(p => p.type === 'FORWARDER'),
        brokers: partners.filter(p => p.type === 'CUSTOMS_BROKER'),
    }
}
