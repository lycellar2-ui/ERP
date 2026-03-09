'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'

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
    return cached('costing:products', async () => {
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
    }, 30_000) // 30s cache
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

// ═══════════════════════════════════════════════════
// SENSITIVITY ANALYSIS — "What-if" Cost Simulation
// ═══════════════════════════════════════════════════

export type SensitivityScenario = {
    label: string
    exchangeRateChange: number // % change (-20 to +20)
    importTaxChange: number    // % change
    sctChange: number          // % change
}

export type SensitivityResult = {
    skuCode: string
    productName: string
    currentUnitCost: number
    currentMarginPct: number | null
    listPrice: number | null
    scenarios: {
        label: string
        newUnitCost: number
        costDelta: number
        costDeltaPct: number
        newMarginPct: number | null
        marginDelta: number | null
    }[]
}

export async function runSensitivityAnalysis(
    scenarios: SensitivityScenario[]
): Promise<{ success: boolean; results?: SensitivityResult[]; error?: string }> {
    try {
        const products = await getCostingProducts()
        const activeProducts = products.filter(p => p.unitLandedCost > 0)

        // Get base cost components from latest Landed Cost Campaign
        const campaigns = await prisma.landedCostCampaign.findMany({
            where: { status: 'ALLOCATED' },
            include: {
                shipment: {
                    select: {
                        cifAmount: true,
                        po: { select: { exchangeRate: true } },
                    },
                },
                allocations: { select: { productId: true, unitLandedCost: true, qty: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
        })

        // Build per-product cost breakdown from campaigns
        const productCostMap = new Map<string, {
            cifPerUnit: number
            importTaxPct: number
            sctPct: number
            vatPct: number
            exchangeRate: number
        }>()

        for (const c of campaigns) {
            const totalTaxCost = Number(c.totalImportTax) + Number(c.totalSct) + Number(c.totalVat) + Number(c.totalOtherCost)
            const cifVnd = Number(c.shipment.cifAmount) * Number(c.shipment.po.exchangeRate)
            const totalQty = c.allocations.reduce((s, a) => s + Number(a.qty), 0)

            for (const alloc of c.allocations) {
                if (!productCostMap.has(alloc.productId)) {
                    productCostMap.set(alloc.productId, {
                        cifPerUnit: cifVnd > 0 && totalQty > 0 ? (cifVnd / totalQty) : Number(alloc.unitLandedCost) * 0.5,
                        importTaxPct: cifVnd > 0 ? (Number(c.totalImportTax) / cifVnd) * 100 : 0,
                        sctPct: cifVnd > 0 ? (Number(c.totalSct) / cifVnd) * 100 : 35,
                        vatPct: 10,
                        exchangeRate: Number(c.shipment.po.exchangeRate),
                    })
                }
            }
        }

        const results: SensitivityResult[] = activeProducts.map(p => {
            const breakdown = productCostMap.get(p.id)
            const baseExRate = breakdown?.exchangeRate ?? 25000
            const baseCifPerUnit = breakdown?.cifPerUnit ?? p.unitLandedCost * 0.4
            const baseImportPct = breakdown?.importTaxPct ?? 0
            const baseSctPct = breakdown?.sctPct ?? 35
            const baseVatPct = 10

            return {
                skuCode: p.skuCode,
                productName: p.productName,
                currentUnitCost: Math.round(p.unitLandedCost),
                currentMarginPct: p.marginPct ? Math.round(p.marginPct * 10) / 10 : null,
                listPrice: p.listPrice,
                scenarios: scenarios.map(sc => {
                    const newExRate = baseExRate * (1 + sc.exchangeRateChange / 100)
                    const newImportPct = baseImportPct * (1 + sc.importTaxChange / 100)
                    const newSctPct = baseSctPct * (1 + sc.sctChange / 100)

                    // Recalculate: CIF(VND) → +ImportTax → +SCT → +VAT
                    const cifVndUnit = (baseCifPerUnit / baseExRate) * newExRate
                    const importTax = cifVndUnit * (newImportPct / 100)
                    const sctBase = cifVndUnit + importTax
                    const sct = sctBase * (newSctPct / 100)
                    const vatBase = sctBase + sct
                    const vat = vatBase * (baseVatPct / 100)
                    const newUnitCost = Math.round(cifVndUnit + importTax + sct + vat)

                    const costDelta = newUnitCost - Math.round(p.unitLandedCost)
                    const costDeltaPct = p.unitLandedCost > 0 ? Math.round((costDelta / p.unitLandedCost) * 1000) / 10 : 0

                    let newMarginPct: number | null = null
                    let marginDelta: number | null = null
                    if (p.listPrice && newUnitCost > 0) {
                        newMarginPct = Math.round(((p.listPrice - newUnitCost) / p.listPrice) * 1000) / 10
                        marginDelta = p.marginPct ? Math.round((newMarginPct - p.marginPct) * 10) / 10 : null
                    }

                    return {
                        label: sc.label,
                        newUnitCost,
                        costDelta,
                        costDeltaPct,
                        newMarginPct,
                        marginDelta,
                    }
                }),
            }
        })

        return { success: true, results }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// Preset scenarios for quick analysis
export async function getPresetScenarios(): Promise<SensitivityScenario[]> {
    return [
        { label: 'Tỷ giá +5%', exchangeRateChange: 5, importTaxChange: 0, sctChange: 0 },
        { label: 'Tỷ giá +10%', exchangeRateChange: 10, importTaxChange: 0, sctChange: 0 },
        { label: 'Tỷ giá -5%', exchangeRateChange: -5, importTaxChange: 0, sctChange: 0 },
        { label: 'EVFTA giảm NK 50%', exchangeRateChange: 0, importTaxChange: -50, sctChange: 0 },
        { label: 'TTĐB tăng 20%', exchangeRateChange: 0, importTaxChange: 0, sctChange: 20 },
        { label: 'Xấu nhất: FX+10% & TTĐB+20%', exchangeRateChange: 10, importTaxChange: 0, sctChange: 20 },
    ]
}

// ═══════════════════════════════════════════════════
// PRICE SUGGESTION ENGINE — Landed Cost → Giá bán đề xuất
// ═══════════════════════════════════════════════════

const CHANNEL_TARGET_MARGIN: Record<string, number> = {
    HORECA: 45,
    WHOLESALE_DISTRIBUTOR: 35,
    VIP_RETAIL: 50,
    DIRECT_INDIVIDUAL: 40,
}

export type PriceSuggestionRow = {
    productId: string
    skuCode: string
    productName: string
    wineType: string
    unitLandedCost: number
    stockQty: number
    suggestions: {
        channel: string
        channelLabel: string
        targetMarginPct: number
        suggestedPrice: number
        currentListPrice: number | null
        priceDelta: number | null
        currentMarginPct: number | null
    }[]
}

export async function getPriceSuggestions(): Promise<{ success: boolean; rows?: PriceSuggestionRow[]; error?: string }> {
    try {
        const costingProducts = await getCostingProducts()
        const activeProducts = costingProducts.filter(p => p.unitLandedCost > 0 && p.stockQty > 0)

        // Get current price lists for all channels
        const now = new Date()
        const priceLists = await prisma.priceList.findMany({
            where: {
                effectiveDate: { lte: now },
                OR: [{ expiryDate: null }, { expiryDate: { gte: now } }],
            },
            include: { lines: { select: { productId: true, unitPrice: true } } },
            orderBy: { effectiveDate: 'desc' },
        })

        // Build channel → product → price map
        const channelPriceMap: Record<string, Record<string, number>> = {}
        for (const pl of priceLists) {
            const ch = pl.channel
            if (!channelPriceMap[ch]) {
                channelPriceMap[ch] = {}
                for (const line of pl.lines) {
                    channelPriceMap[ch][line.productId] = Number(line.unitPrice)
                }
            }
        }

        const channelEntries = Object.entries(CHANNEL_TARGET_MARGIN)
        const channelLabels: Record<string, string> = {
            HORECA: 'HORECA',
            WHOLESALE_DISTRIBUTOR: 'Đại Lý',
            VIP_RETAIL: 'VIP Retail',
            DIRECT_INDIVIDUAL: 'Trực Tiếp',
        }

        const rows: PriceSuggestionRow[] = activeProducts.map(p => {
            const suggestions = channelEntries.map(([channel, targetMargin]) => {
                // Suggested price = Cost / (1 - targetMargin%)
                const suggestedPrice = Math.round(p.unitLandedCost / (1 - targetMargin / 100))
                const currentListPrice = channelPriceMap[channel]?.[p.id] ?? null
                const priceDelta = currentListPrice !== null ? suggestedPrice - currentListPrice : null
                const currentMarginPct = currentListPrice && p.unitLandedCost > 0
                    ? Math.round(((currentListPrice - p.unitLandedCost) / currentListPrice) * 1000) / 10
                    : null

                return {
                    channel,
                    channelLabel: channelLabels[channel] ?? channel,
                    targetMarginPct: targetMargin,
                    suggestedPrice,
                    currentListPrice,
                    priceDelta,
                    currentMarginPct,
                }
            })

            return {
                productId: p.id,
                skuCode: p.skuCode,
                productName: p.productName,
                wineType: p.wineType,
                unitLandedCost: Math.round(p.unitLandedCost),
                stockQty: p.stockQty,
                suggestions,
            }
        })

        return { success: true, rows }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}
