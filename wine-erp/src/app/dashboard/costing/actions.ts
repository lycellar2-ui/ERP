'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'

export interface CostingProduct {
    id: string
    skuCode: string
    productName: string
    wineType: string
    abvPercent: number | null
    country: string
    unitLandedCost: number
    listPrice: number | null
    marginPct: number | null
    stockQty: number
    isLoss: boolean
}

export async function getCostingProducts(): Promise<CostingProduct[]> {
    const products = await prisma.product.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: {
            id: true,
            skuCode: true,
            productName: true,
            wineType: true,
            abvPercent: true,
            country: true,
            stockLots: {
                where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
                select: { unitLandedCost: true, qtyAvailable: true },
            },
            priceLines: {
                select: { unitPrice: true, currency: true },
                orderBy: { unitPrice: 'desc' },
                take: 1,
            },
        },
        orderBy: { productName: 'asc' },
    })

    return products.map(p => {
        const totalQty = p.stockLots.reduce((s, l) => s + Number(l.qtyAvailable), 0)
        const totalCostValue = p.stockLots.reduce((s, l) => s + Number(l.qtyAvailable) * Number(l.unitLandedCost), 0)
        const unitLandedCost = totalQty > 0 ? totalCostValue / totalQty : 0
        const listPrice = p.priceLines[0] ? Number(p.priceLines[0].unitPrice) : null
        const marginPct = listPrice && unitLandedCost > 0 ? ((listPrice - unitLandedCost) / listPrice) * 100 : null

        return {
            id: p.id,
            skuCode: p.skuCode,
            productName: p.productName,
            wineType: p.wineType,
            abvPercent: p.abvPercent ? Number(p.abvPercent) : null,
            country: p.country,
            unitLandedCost,
            listPrice,
            marginPct,
            stockQty: totalQty,
            isLoss: marginPct !== null && marginPct < 0,
        }
    })
}

// ═══════════════════════════════════════════════════
// LANDED COST CAMPAIGN — Container cost proration
// ═══════════════════════════════════════════════════

export type ShipmentForCampaign = {
    id: string
    billOfLading: string
    poNo: string
    supplierName: string
    vesselName: string | null
    cifAmount: number
    cifCurrency: string
    status: string
    eta: string | null
    lotCount: number
}

export type LandedCostCampaignRow = {
    id: string
    shipmentId: string
    shipmentBol: string | null
    vesselName: string | null
    supplierName: string | null
    cifAmount: number
    totalImportTax: number
    totalSct: number
    totalVat: number
    totalOtherCost: number
    totalCost: number
    status: string
    allocationCount: number
    lotCount: number
    createdAt: Date
}

export type LandedCostAllocationRow = {
    id: string
    campaignId: string
    productId: string
    productName: string
    skuCode: string
    qty: number
    unitLandedCost: number
    totalCost: number
}

// ── Get Shipments Available for Campaign ──────────
export async function getShipmentsForCampaign(): Promise<ShipmentForCampaign[]> {
    const shipments = await prisma.shipment.findMany({
        where: {
            landedCost: null, // No campaign yet
        },
        include: {
            po: {
                select: {
                    poNo: true,
                    supplier: { select: { name: true } },
                },
            },
            stockLots: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
    })


    return shipments.map(s => ({
        id: s.id,
        billOfLading: s.billOfLading,
        poNo: s.po.poNo,
        supplierName: s.po.supplier.name,
        vesselName: s.vesselName,
        cifAmount: Number(s.cifAmount),
        cifCurrency: s.cifCurrency,
        status: s.status,
        eta: s.eta?.toISOString() ?? null,
        lotCount: s.stockLots.length,
    }))
}

// ── List Campaigns ────────────────────────────────
export async function getLandedCostCampaigns(): Promise<LandedCostCampaignRow[]> {
    const campaigns = await prisma.landedCostCampaign.findMany({
        include: {
            shipment: {
                select: {
                    billOfLading: true,
                    vesselName: true,
                    cifAmount: true,
                    po: {
                        select: { supplier: { select: { name: true } } },
                    },
                    stockLots: { select: { id: true } },
                },
            },
            allocations: { select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
    })

    return campaigns.map(c => {
        const total = Number(c.totalImportTax) + Number(c.totalSct) + Number(c.totalVat) + Number(c.totalOtherCost)
        return {
            id: c.id,
            shipmentId: c.shipmentId,
            shipmentBol: c.shipment.billOfLading,
            vesselName: c.shipment.vesselName,
            supplierName: c.shipment.po.supplier.name,
            cifAmount: Number(c.shipment.cifAmount),
            totalImportTax: Number(c.totalImportTax),
            totalSct: Number(c.totalSct),
            totalVat: Number(c.totalVat),
            totalOtherCost: Number(c.totalOtherCost),
            totalCost: total,
            status: c.status,
            allocationCount: c.allocations.length,
            lotCount: c.shipment.stockLots.length,
            createdAt: c.createdAt,
        }
    })
}

// ── Get Campaign Detail ───────────────────────────
export async function getLandedCostCampaignDetail(id: string) {
    const campaign = await prisma.landedCostCampaign.findUnique({
        where: { id },
        include: {
            shipment: {
                select: {
                    billOfLading: true,
                    vesselName: true,
                    cifAmount: true,
                    cifCurrency: true,
                    po: {
                        select: {
                            poNo: true,
                            exchangeRate: true,
                            supplier: { select: { name: true } },
                        },
                    },
                },
            },
            allocations: {
                include: {
                    product: { select: { productName: true, skuCode: true, wineType: true } },
                },
            },
        },
    })
    if (!campaign) return null

    return {
        id: campaign.id,
        shipmentId: campaign.shipmentId,
        shipmentBol: campaign.shipment.billOfLading,
        vesselName: campaign.shipment.vesselName,
        cifAmount: Number(campaign.shipment.cifAmount),
        cifCurrency: campaign.shipment.cifCurrency,
        poNo: campaign.shipment.po.poNo,
        exchangeRate: Number(campaign.shipment.po.exchangeRate),
        supplierName: campaign.shipment.po.supplier.name,
        totalImportTax: Number(campaign.totalImportTax),
        totalSct: Number(campaign.totalSct),
        totalVat: Number(campaign.totalVat),
        totalOtherCost: Number(campaign.totalOtherCost),
        totalCost: Number(campaign.totalImportTax) + Number(campaign.totalSct) + Number(campaign.totalVat) + Number(campaign.totalOtherCost),
        status: campaign.status,
        createdAt: campaign.createdAt,
        allocations: campaign.allocations.map(a => ({
            id: a.id,
            campaignId: a.campaignId,
            productId: a.productId,
            productName: a.product.productName,
            skuCode: a.product.skuCode,
            wineType: a.product.wineType,
            qty: Number(a.qty),
            unitLandedCost: Number(a.unitLandedCost),
            totalCost: Number(a.qty) * Number(a.unitLandedCost),
        })),
    }
}

// ── Create Campaign from Shipment ─────────────────
export async function createLandedCostCampaign(input: {
    shipmentId: string
    totalImportTax: number
    totalSct: number
    totalVat: number
    totalOtherCost: number
}): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
        const existing = await prisma.landedCostCampaign.findUnique({
            where: { shipmentId: input.shipmentId },
        })
        if (existing) return { success: false, error: 'Shipment đã có Landed Cost Campaign' }

        const campaign = await prisma.landedCostCampaign.create({
            data: {
                shipmentId: input.shipmentId,
                totalImportTax: input.totalImportTax,
                totalSct: input.totalSct,
                totalVat: input.totalVat,
                totalOtherCost: input.totalOtherCost,
                status: 'DRAFT',
            },
        })
        revalidatePath('/dashboard/costing')
        return { success: true, id: campaign.id }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Update Campaign Cost Figures ──────────────────
export async function updateLandedCostCampaign(input: {
    id: string
    totalImportTax: number
    totalSct: number
    totalVat: number
    totalOtherCost: number
}): Promise<{ success: boolean; error?: string }> {
    try {
        const campaign = await prisma.landedCostCampaign.findUnique({ where: { id: input.id } })
        if (!campaign) return { success: false, error: 'Campaign không tồn tại' }
        if (campaign.status === 'ALLOCATED') {
            return { success: false, error: 'Campaign đã Finalized — không thể chỉnh sửa' }
        }

        await prisma.landedCostCampaign.update({
            where: { id: input.id },
            data: {
                totalImportTax: input.totalImportTax,
                totalSct: input.totalSct,
                totalVat: input.totalVat,
                totalOtherCost: input.totalOtherCost,
            },
        })
        revalidatePath('/dashboard/costing')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Calculate & Allocate — Proration Engine ───────
// Distributes total cost across products proportionally by qty
export async function calculateLandedCostProration(
    campaignId: string
): Promise<{ success: boolean; allocations?: LandedCostAllocationRow[]; error?: string }> {
    try {
        const campaign = await prisma.landedCostCampaign.findUnique({
            where: { id: campaignId },
        })
        if (!campaign) return { success: false, error: 'Campaign không tồn tại' }
        if (campaign.status === 'ALLOCATED') {
            return { success: false, error: 'Campaign đã Finalized — không thể tính lại' }
        }

        // Get all stock lots from this shipment
        const lots = await prisma.stockLot.findMany({
            where: { shipmentId: campaign.shipmentId },
            include: { product: { select: { productName: true, skuCode: true } } },
        })

        if (lots.length === 0) {
            return { success: false, error: 'Shipment chưa có StockLot nào (cần nhập kho trước)' }
        }

        const totalQty = lots.reduce((s, l) => s + Number(l.qtyReceived), 0)
        const totalCost = Number(campaign.totalImportTax) + Number(campaign.totalSct)
            + Number(campaign.totalVat) + Number(campaign.totalOtherCost)

        // Group by product, sum qty
        const productMap = new Map<string, { qty: number; name: string; sku: string }>()
        for (const lot of lots) {
            const existing = productMap.get(lot.productId)
            if (existing) {
                existing.qty += Number(lot.qtyReceived)
            } else {
                productMap.set(lot.productId, {
                    qty: Number(lot.qtyReceived),
                    name: lot.product.productName,
                    sku: lot.product.skuCode,
                })
            }
        }

        // Delete old allocations and create new
        await prisma.landedCostAllocation.deleteMany({ where: { campaignId } })

        const allocations: LandedCostAllocationRow[] = []
        for (const [productId, data] of productMap) {
            const ratio = data.qty / totalQty
            const allocatedCost = totalCost * ratio
            const unitCost = allocatedCost / data.qty

            const alloc = await prisma.landedCostAllocation.create({
                data: {
                    campaignId,
                    productId,
                    qty: data.qty,
                    unitLandedCost: Math.round(unitCost * 100) / 100,
                },
            })

            allocations.push({
                id: alloc.id,
                campaignId,
                productId,
                productName: data.name,
                skuCode: data.sku,
                qty: data.qty,
                unitLandedCost: Math.round(unitCost * 100) / 100,
                totalCost: Math.round(allocatedCost * 100) / 100,
            })
        }

        // Update campaign status to CONFIRMED
        await prisma.landedCostCampaign.update({
            where: { id: campaignId },
            data: { status: 'CONFIRMED' },
        })

        revalidatePath('/dashboard/costing')
        return { success: true, allocations }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ── Finalize Campaign — Update StockLot costs ─────
export async function finalizeLandedCostCampaign(
    campaignId: string
): Promise<{ success: boolean; error?: string }> {
    try {
        const campaign = await prisma.landedCostCampaign.findUnique({
            where: { id: campaignId },
            include: { allocations: true },
        })
        if (!campaign) return { success: false, error: 'Campaign không tồn tại' }
        if (campaign.status === 'ALLOCATED') {
            return { success: false, error: 'Campaign đã được Finalize trước đó' }
        }
        if (campaign.allocations.length === 0) {
            return { success: false, error: 'Chưa có allocation. Hãy chạy Calculate trước.' }
        }

        await prisma.$transaction(async (tx) => {
            // Update unitLandedCost on StockLots
            for (const alloc of campaign.allocations) {
                await tx.stockLot.updateMany({
                    where: {
                        shipmentId: campaign.shipmentId,
                        productId: alloc.productId,
                    },
                    data: { unitLandedCost: alloc.unitLandedCost },
                })
            }

            // Mark campaign as ALLOCATED (finalized)
            await tx.landedCostCampaign.update({
                where: { id: campaignId },
                data: { status: 'ALLOCATED' },
            })
        })

        revalidatePath('/dashboard/costing')
        revalidatePath('/dashboard/warehouse')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
