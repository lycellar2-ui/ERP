'use server'

import { prisma, withRetry } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'
import ExcelJS from 'exceljs'

export type StockRiskStatus = 'OUT_OF_STOCK' | 'CRITICAL' | 'OPTIMAL' | 'ABUNDANT' | 'OVERSTOCK' | 'NO_SALES'

export interface MonthSalesData {
    month: string
    salesQty: number
    tastingQty: number
    isHistorical: boolean
}

export interface StockVelocityItem {
    id: string
    skuCode: string
    productName: string
    producerName: string
    producerGroup: string
    wineType: string
    vintage: number | null
    stockTT: number
    stockGVM: number
    stockSR: number
    totalStock: number
    historicalTotal: number
    historicalTastingTotal: number
    allMonths: MonthSalesData[]
    avgMonthlySales: number
    stockMonths: number
    riskStatus: StockRiskStatus
    incomingQty: number
    incomingPo: string | null
    incomingEtd: string | null
    incomingEta: string | null
    note: string | null
}

export interface StockVelocitySummary {
    totalProducts: number
    totalStockQty: number
    criticalCount: number
    optimalCount: number
    abundantCount: number
    overstockCount: number
    outOfStockCount: number
    totalSalesLastMonth: number
    allMonthKeys: string[]
    historicalMonthKeys: string[]
    liveMonthKeys: string[]
    cycleMonths: number
}

export interface StockVelocityReportResult {
    items: StockVelocityItem[]
    summary: StockVelocitySummary
}

export interface StockVelocityReportResponse {
    success: boolean
    data?: StockVelocityReportResult
    error?: string
}

const CANONICAL_PRODUCERS = [
    'SARTORI',
    'EUGENIO COLLAVINI',
    'ETHICA WINES',
    'MAISON BOUEY',
    'DOMAINE DE LA TOUR BLANCHE',
    'FAMILLE LANCON - LA SOLITUDE',
    'PARDON & FILS',
    'SAGET LA PERRIERE',
    'DVP DOMAINE ET VINS DE PROPRIETE',
    'DOMAINE DU METEORE',
    'VINA SAN ESTEBAN',
    'BERTON VINEYARD',
    'BODEGAS PANIZA',
    'CAVAS MAREVIA',
    'Josh Scott',
    'Calabria',
]

const EXCEL_PRODUCER_MAP: Record<string, string> = {
    L10001: 'SARTORI', L10004: 'SARTORI', L10005: 'SARTORI', L10006: 'SARTORI', L10007: 'SARTORI',
    L10008: 'SARTORI', L10009: 'SARTORI', L10010: 'SARTORI', L10011: 'SARTORI', L10012: 'SARTORI',
    L10013: 'SARTORI', L10014: 'SARTORI', L10037: 'SARTORI', L10038: 'SARTORI',
    L10015: 'EUGENIO COLLAVINI', L10016: 'EUGENIO COLLAVINI', L10017: 'EUGENIO COLLAVINI', L10018: 'EUGENIO COLLAVINI',
    L10019: 'EUGENIO COLLAVINI', L10020: 'EUGENIO COLLAVINI', L10021: 'EUGENIO COLLAVINI', L10022: 'EUGENIO COLLAVINI',
    L10023: 'EUGENIO COLLAVINI', L10024: 'EUGENIO COLLAVINI', L10025: 'EUGENIO COLLAVINI', L10026: 'EUGENIO COLLAVINI',
    L10027: 'EUGENIO COLLAVINI', L10035: 'EUGENIO COLLAVINI', L10036: 'EUGENIO COLLAVINI',
    L10028: 'ETHICA WINES', L10029: 'ETHICA WINES', L10030: 'ETHICA WINES', L10031: 'ETHICA WINES',
    L10032: 'ETHICA WINES', L10033: 'ETHICA WINES', L10034: 'ETHICA WINES',
    L20001: 'MAISON BOUEY', L20002: 'MAISON BOUEY', L20003: 'MAISON BOUEY', L20004: 'MAISON BOUEY',
    L20006: 'MAISON BOUEY', L20007: 'MAISON BOUEY', L20029: 'MAISON BOUEY', L20030: 'MAISON BOUEY',
    L20031: 'MAISON BOUEY', L20032: 'MAISON BOUEY', L20068: 'MAISON BOUEY', L20069: 'MAISON BOUEY',
    L20009: 'DOMAINE DE LA TOUR BLANCHE', L20010: 'DOMAINE DE LA TOUR BLANCHE', L20011: 'DOMAINE DE LA TOUR BLANCHE',
    L20012: 'DOMAINE DE LA TOUR BLANCHE', L20013: 'DOMAINE DE LA TOUR BLANCHE', L20014: 'DOMAINE DE LA TOUR BLANCHE',
    L20015: 'DOMAINE DE LA TOUR BLANCHE',
    L20016: 'FAMILLE LANCON - LA SOLITUDE', L20017: 'FAMILLE LANCON - LA SOLITUDE', L20018: 'FAMILLE LANCON - LA SOLITUDE',
    L20019: 'FAMILLE LANCON - LA SOLITUDE', L20070: 'FAMILLE LANCON - LA SOLITUDE',
    L20020: 'PARDON & FILS', L20021: 'PARDON & FILS', L20022: 'PARDON & FILS', L20023: 'PARDON & FILS',
    L20024: 'PARDON & FILS', L20025: 'PARDON & FILS', L20026: 'PARDON & FILS', L20028: 'PARDON & FILS',
    L20033: 'SAGET LA PERRIERE', L20034: 'SAGET LA PERRIERE', L20035: 'SAGET LA PERRIERE', L20036: 'SAGET LA PERRIERE',
    L20037: 'SAGET LA PERRIERE', L20038: 'SAGET LA PERRIERE', L20064: 'SAGET LA PERRIERE', L20065: 'SAGET LA PERRIERE',
    L20066: 'SAGET LA PERRIERE', L20067: 'SAGET LA PERRIERE',
    L20039: 'DVP DOMAINE ET VINS DE PROPRIETE', L20040: 'DVP DOMAINE ET VINS DE PROPRIETE', L20041: 'DVP DOMAINE ET VINS DE PROPRIETE',
    L20042: 'DVP DOMAINE ET VINS DE PROPRIETE', L20043: 'DVP DOMAINE ET VINS DE PROPRIETE', L20044: 'DVP DOMAINE ET VINS DE PROPRIETE',
    L20045: 'DVP DOMAINE ET VINS DE PROPRIETE', L20046: 'DVP DOMAINE ET VINS DE PROPRIETE',
    L20047: 'DOMAINE DU METEORE', L20048: 'DOMAINE DU METEORE', L20049: 'DOMAINE DU METEORE', L20050: 'DOMAINE DU METEORE',
    L20051: 'DOMAINE DU METEORE', L20052: 'DOMAINE DU METEORE', L20053: 'DOMAINE DU METEORE', L20054: 'DOMAINE DU METEORE',
    L20055: 'DOMAINE DU METEORE', L20056: 'DOMAINE DU METEORE', L20057: 'DOMAINE DU METEORE', L20058: 'DOMAINE DU METEORE',
    L20059: 'DOMAINE DU METEORE', L20060: 'DOMAINE DU METEORE', L20061: 'DOMAINE DU METEORE', L20062: 'DOMAINE DU METEORE',
    L20063: 'DOMAINE DU METEORE', L20071: 'DOMAINE DU METEORE', L20072: 'DOMAINE DU METEORE',
    L30001: 'VINA SAN ESTEBAN', L30002: 'VINA SAN ESTEBAN', L30003: 'VINA SAN ESTEBAN', L30005: 'VINA SAN ESTEBAN',
    L40001: 'BERTON VINEYARD', L40002: 'BERTON VINEYARD', L40003: 'BERTON VINEYARD', L40004: 'BERTON VINEYARD',
    L40005: 'BERTON VINEYARD', L40006: 'BERTON VINEYARD', L40007: 'BERTON VINEYARD', L40008: 'BERTON VINEYARD',
    L40009: 'BERTON VINEYARD',
    L50001: 'BODEGAS PANIZA',
    L50002: 'CAVAS MAREVIA',
    L60001: 'Josh Scott', L60002: 'Josh Scott', L60003: 'Josh Scott', L60004: 'Josh Scott', L60005: 'Josh Scott',
    L40010: 'Calabria', L40011: 'Calabria', L40012: 'Calabria', L40013: 'Calabria', L40014: 'Calabria',
}

const EXCEL_SKU_NOTES: Record<string, string> = {
    L10001: 'discontinued',
    L10004: 'discontinued',
    L10005: 'discontinued',
    L10006: 'discontinued',
    L10009: 'discontinued',
    L10010: 'discontinued',
    L10012: 'discontinued',
    L10013: 'discontinued',
    L20001: 'Đổi tên và nhãn rượu mới',
    L20002: 'Đổi tên và nhãn rượu mới',
    L20032: 'Giữ hàng cho La badiane',
    L20009: 'discontinued',
    L20016: 'Check Vintage',
    L20017: 'Check Vintage',
    L20044: 'Giữ hàng cho luklak',
    L50002: 'Giữ hàng cho Same',
}

const EXCEL_INCOMING_FALLBACK: Record<string, { qty: number; po: string; etd: string; eta: string }> = {
    L10023: { qty: 360, po: '', etd: '', eta: '' },
    L10025: { qty: 240, po: '', etd: '', eta: '' },
    L10035: { qty: 360, po: '', etd: '', eta: '' },
    L10036: { qty: 210, po: '', etd: '', eta: '' },
    L10029: { qty: 240, po: '', etd: '', eta: '' },
    L30001: { qty: 1680, po: 'PO 840*2', etd: 'Departured', eta: '01/07/2026' },
    L30002: { qty: 240, po: 'PO 240', etd: 'Departured', eta: '01/07/2026' },
    L30003: { qty: 840, po: 'PO 840', etd: 'Departured', eta: '01/07/2026' },
    L60001: { qty: 288, po: 'PO 288', etd: '22/06/2026', eta: '08/10/2026' },
    L60002: { qty: 348, po: 'PO 348', etd: '22/06/2026', eta: '08/10/2026' },
    L60003: { qty: 468, po: 'PO 468', etd: '22/06/2026', eta: '08/10/2026' },
    L60004: { qty: 408, po: 'PO 408', etd: '22/06/2026', eta: '08/10/2026' },
    L60005: { qty: 120, po: 'PO 120', etd: '22/06/2026', eta: '08/10/2026' },
}

// ── GET STOCK VELOCITY REPORT DATA ──────────────────────────────────────────
export async function getStockVelocityReport(options?: { cycleMonths?: number }): Promise<StockVelocityReportResponse> {
    try {
        const cycle = options?.cycleMonths ?? 6

        const [
            prodRows,
            lotsRows,
            doRows,
            histRows,
            liveRows,
            incomingRows
        ] = await Promise.all([
            // 1. Products
            withRetry(() => prisma.$queryRawUnsafe<any[]>(`
                SELECT p.id, p."skuCode", p."productName", p."wineType", p."producerId", pr.name as "producerName"
                FROM products p
                LEFT JOIN producers pr ON p."producerId" = pr.id
                WHERE p.status = 'ACTIVE' OR p."skuCode" IN (SELECT DISTINCT "skuCode" FROM historical_monthly_sales)
                ORDER BY p."skuCode" ASC
            `)),

            // 2. Stock lots by warehouse & vintage
            withRetry(() => prisma.$queryRawUnsafe<any[]>(`
                SELECT sl."productId", p."skuCode", w.code as "whCode", sl.vintage,
                       SUM(sl."qtyAvailable") as "qtyAvail"
                FROM stock_lots sl
                JOIN products p ON sl."productId" = p.id
                JOIN locations l ON sl."locationId" = l.id
                JOIN warehouses w ON l."warehouseId" = w.id
                WHERE sl.status IN ('AVAILABLE', 'RESERVED')
                GROUP BY sl."productId", p."skuCode", w.code, sl.vintage
            `)),

            // 3. Draft DO quantities
            withRetry(() => prisma.$queryRawUnsafe<any[]>(`
                SELECT dol."productId", w.code as "whCode",
                       SUM(dol."qtyPicked") as "draftQty"
                FROM delivery_order_lines dol
                JOIN delivery_orders d ON dol."doId" = d.id
                JOIN locations l ON dol."locationId" = l.id
                JOIN warehouses w ON l."warehouseId" = w.id
                WHERE d.status IN ('DRAFT', 'PICKING', 'PACKED')
                GROUP BY dol."productId", w.code
            `)),

            // 4. Historical monthly sales
            withRetry(() => prisma.$queryRawUnsafe<any[]>(`
                SELECT "skuCode", month, "salesQty", "tastingQty"
                FROM historical_monthly_sales
                ORDER BY month ASC
            `)),

            // 5. Live ERP sales (from 2026-08-01 onwards)
            withRetry(() => prisma.$queryRawUnsafe<any[]>(`
                SELECT p."skuCode", to_char(so."createdAt", 'YYYY-MM') as month,
                       SUM(sol."qtyOrdered") as sales_qty
                FROM sales_order_lines sol
                JOIN sales_orders so ON sol."soId" = so.id
                JOIN products p ON sol."productId" = p.id
                WHERE so.status != 'CANCELLED' AND so."createdAt" >= '2026-08-01 00:00:00'
                GROUP BY p."skuCode", to_char(so."createdAt", 'YYYY-MM')
                ORDER BY month ASC
            `)),

            // 6. Incoming stock from PO / Shipments
            withRetry(() => prisma.$queryRawUnsafe<any[]>(`
                SELECT pol."productId", p."skuCode", po."poNo", s.etd, s.eta, po."estimatedDelivery",
                       SUM(pol."qtyOrdered") as incoming_qty
                FROM purchase_order_lines pol
                JOIN purchase_orders po ON pol."poId" = po.id
                JOIN products p ON pol."productId" = p.id
                LEFT JOIN shipments s ON s."poId" = po.id
                WHERE po.status IN ('APPROVED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED')
                GROUP BY pol."productId", p."skuCode", po."poNo", s.etd, s.eta, po."estimatedDelivery"
            `)).catch(() => [])
        ])

        // Generate month keys
        const historicalMonthKeysSet = new Set<string>()
        histRows.forEach(r => historicalMonthKeysSet.add(r.month))
        const historicalMonthKeys = Array.from(historicalMonthKeysSet).sort()

        const liveMonthKeysSet = new Set<string>()
        liveRows.forEach(r => liveMonthKeysSet.add(r.month))
        // Always include at least 2026-08, 2026-09, 2026-10 if not present
        ;['2026-08', '2026-09', '2026-10'].forEach(m => liveMonthKeysSet.add(m))
        const liveMonthKeys = Array.from(liveMonthKeysSet).sort()

        const allMonthKeys = [...historicalMonthKeys, ...liveMonthKeys]

        // Determine the months to use for calculating average sales (last `cycle` months)
        const calculationMonths = allMonthKeys.slice(-cycle)

        // Build lookup maps
        // Stock by SKU & Warehouse
        const stockMap = new Map<string, { tt: number; gvm: number; sr: number; vintage: number | null }>()
        for (const lot of lotsRows) {
            const sku = lot.skuCode
            if (!stockMap.has(sku)) {
                stockMap.set(sku, { tt: 0, gvm: 0, sr: 0, vintage: lot.vintage ? Number(lot.vintage) : null })
            }
            const entry = stockMap.get(sku)!
            const qty = Number(lot.qtyAvail || 0)
            if (lot.whCode === 'WH-TA-TT') {
                entry.tt += qty
            } else if (lot.whCode === 'WH-TA-GVM') {
                entry.gvm += qty
            } else {
                entry.sr += qty
            }
            if (lot.vintage && !entry.vintage) {
                entry.vintage = Number(lot.vintage)
            }
        }

        // Add draft DOs
        for (const d of doRows) {
            const prod = prodRows.find(p => p.id === d.productId)
            if (!prod) continue
            const sku = prod.skuCode
            if (!stockMap.has(sku)) {
                stockMap.set(sku, { tt: 0, gvm: 0, sr: 0, vintage: null })
            }
            const entry = stockMap.get(sku)!
            const qty = Number(d.draftQty || 0)
            if (d.whCode === 'WH-TA-TT') entry.tt += qty
            else if (d.whCode === 'WH-TA-GVM') entry.gvm += qty
            else entry.sr += qty
        }

        // Historical sales map: Map<`${sku}_${month}`, { sales: number, taste: number }>
        const histSalesMap = new Map<string, { sales: number; taste: number }>()
        for (const r of histRows) {
            histSalesMap.set(`${r.skuCode}_${r.month}`, {
                sales: Number(r.salesQty || 0),
                taste: Number(r.tastingQty || 0),
            })
        }

        // Live sales map: Map<`${sku}_${month}`, number>
        const liveSalesMap = new Map<string, number>()
        for (const r of liveRows) {
            liveSalesMap.set(`${r.skuCode}_${r.month}`, Number(r.sales_qty || 0))
        }

        // Incoming stock map
        const incomingMap = new Map<string, { qty: number; poNo: string | null; etd: string | null; eta: string | null }>()
        for (const r of incomingRows) {
            incomingMap.set(r.skuCode, {
                qty: Number(r.incoming_qty || 0),
                poNo: r.poNo || null,
                etd: r.etd ? new Date(r.etd).toLocaleDateString('vi-VN') : null,
                eta: (r.eta || r.estimatedDelivery) ? new Date(r.eta || r.estimatedDelivery).toLocaleDateString('vi-VN') : null,
            })
        }

        // Transform products into report items
        const items: StockVelocityItem[] = []
        let totalStockQty = 0
        let criticalCount = 0
        let optimalCount = 0
        let abundantCount = 0
        let overstockCount = 0
        let outOfStockCount = 0

        // Latest live month
        const latestMonth = liveMonthKeys[liveMonthKeys.length - 1] || '2026-10'
        let totalSalesLastMonth = 0

        for (const prod of prodRows) {
            const sku = prod.skuCode
            const stockInfo = stockMap.get(sku) || { tt: 0, gvm: 0, sr: 0, vintage: null }
            const totalStock = stockInfo.tt + stockInfo.gvm + stockInfo.sr
            totalStockQty += totalStock

            let historicalTotal = 0
            let historicalTastingTotal = 0
            const allMonths: MonthSalesData[] = []

            // Fill historical
            for (const hm of historicalMonthKeys) {
                const hData = histSalesMap.get(`${sku}_${hm}`) || { sales: 0, taste: 0 }
                historicalTotal += hData.sales
                historicalTastingTotal += hData.taste
                allMonths.push({
                    month: hm,
                    salesQty: hData.sales,
                    tastingQty: hData.taste,
                    isHistorical: true,
                })
            }

            // Fill live
            for (const lm of liveMonthKeys) {
                const lSales = liveSalesMap.get(`${sku}_${lm}`) || 0
                if (lm === latestMonth) {
                    totalSalesLastMonth += lSales
                }
                allMonths.push({
                    month: lm,
                    salesQty: lSales,
                    tastingQty: 0,
                    isHistorical: false,
                })
            }

            // Calculate average monthly sales in chosen cycle
            let cycleSalesSum = 0
            for (const cm of calculationMonths) {
                const found = allMonths.find(m => m.month === cm)
                if (found) {
                    cycleSalesSum += found.salesQty
                }
            }
            const avgMonthlySales = Number((cycleSalesSum / calculationMonths.length).toFixed(1))

            // Calculate Stock of Month (Runout time)
            let stockMonths = 0
            let riskStatus: StockRiskStatus = 'OPTIMAL'

            if (totalStock <= 0) {
                stockMonths = 0
                riskStatus = 'OUT_OF_STOCK'
                outOfStockCount++
            } else if (avgMonthlySales <= 0) {
                stockMonths = 999
                riskStatus = 'NO_SALES'
                overstockCount++
            } else {
                stockMonths = Number((totalStock / avgMonthlySales).toFixed(1))
                if (stockMonths < 2) {
                    riskStatus = 'CRITICAL'
                    criticalCount++
                } else if (stockMonths <= 6) {
                    riskStatus = 'OPTIMAL'
                    optimalCount++
                } else if (stockMonths <= 12) {
                    riskStatus = 'ABUNDANT'
                    abundantCount++
                } else {
                    riskStatus = 'OVERSTOCK'
                    overstockCount++
                }
            }

            const liveIncoming = incomingMap.get(sku)
            const fallbackIncoming = EXCEL_INCOMING_FALLBACK[sku]

            const incomingQty = liveIncoming ? liveIncoming.qty : (fallbackIncoming ? fallbackIncoming.qty : 0)
            const incomingPo = liveIncoming ? liveIncoming.poNo : (fallbackIncoming ? fallbackIncoming.po : null)
            const incomingEtd = liveIncoming ? liveIncoming.etd : (fallbackIncoming ? fallbackIncoming.etd : null)
            const incomingEta = liveIncoming ? liveIncoming.eta : (fallbackIncoming ? fallbackIncoming.eta : null)

            const producerGroup = EXCEL_PRODUCER_MAP[sku] || prod.producerName || 'Khác'
            const note = EXCEL_SKU_NOTES[sku] || null

            items.push({
                id: prod.id,
                skuCode: sku,
                productName: prod.productName,
                producerName: prod.producerName || 'Khác',
                producerGroup,
                wineType: prod.wineType || 'RED',
                vintage: stockInfo.vintage,
                stockTT: stockInfo.tt,
                stockGVM: stockInfo.gvm,
                stockSR: stockInfo.sr,
                totalStock,
                historicalTotal,
                historicalTastingTotal,
                allMonths,
                avgMonthlySales,
                stockMonths,
                riskStatus,
                incomingQty,
                incomingPo,
                incomingEtd,
                incomingEta,
                note,
            })
        }

        // Sort items exactly according to Excel stock report producer bands
        items.sort((a, b) => {
            const aGroupIdx = CANONICAL_PRODUCERS.indexOf(a.producerGroup)
            const bGroupIdx = CANONICAL_PRODUCERS.indexOf(b.producerGroup)

            const aIdx = aGroupIdx !== -1 ? aGroupIdx : 999
            const bIdx = bGroupIdx !== -1 ? bGroupIdx : 999

            if (aIdx !== bIdx) return aIdx - bIdx
            if (a.producerGroup !== b.producerGroup) return a.producerGroup.localeCompare(b.producerGroup)
            return a.skuCode.localeCompare(b.skuCode)
        })

        return {
            success: true,
            data: {
                items,
                summary: {
                    totalProducts: items.length,
                    totalStockQty,
                    criticalCount,
                    optimalCount,
                    abundantCount,
                    overstockCount,
                    outOfStockCount,
                    totalSalesLastMonth,
                    allMonthKeys,
                    historicalMonthKeys,
                    liveMonthKeys,
                    cycleMonths: cycle,
                },
            },
        }
    } catch (err: unknown) {
        console.error('[getStockVelocityReport] Critical error:', err)
        const message = err instanceof Error ? err.message : String(err)
        return {
            success: false,
            error: message,
        }
    }
}

// ── UPLOAD & SYNC HISTORICAL STOCK EXCEL ────────────────────────────────────
export async function uploadHistoricalStockExcel(formData: FormData): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
        const file = formData.get('file') as File
        if (!file) {
            return { success: false, error: 'Không tìm thấy file tải lên.' }
        }

        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const wb = XLSX.read(buffer, { type: 'buffer' })

        const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('stock')) || wb.SheetNames[0]
        const ws = wb.Sheets[sheetName]
        if (!ws) {
            return { success: false, error: 'File Excel không có trang tính "Stock".' }
        }

        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as (string | number | undefined)[][]

        const monthCols = [
            { month: '2023-01', salesCol: 7, tasteCol: -1 },
            { month: '2023-02', salesCol: 8, tasteCol: -1 },
            { month: '2023-03', salesCol: 9, tasteCol: -1 },
            { month: '2023-04', salesCol: 10, tasteCol: -1 },
            { month: '2023-05', salesCol: 11, tasteCol: -1 },
            { month: '2023-06', salesCol: 12, tasteCol: -1 },
            { month: '2023-07', salesCol: 13, tasteCol: -1 },
            { month: '2023-08', salesCol: 14, tasteCol: -1 },
            { month: '2023-09', salesCol: 15, tasteCol: -1 },
            { month: '2023-10', salesCol: 16, tasteCol: 17 },
            { month: '2023-11', salesCol: 18, tasteCol: 19 },
            { month: '2023-12', salesCol: 20, tasteCol: 21 },
            { month: '2024-01', salesCol: 22, tasteCol: 23 },
            { month: '2024-02', salesCol: 24, tasteCol: 25 },
            { month: '2024-03', salesCol: 26, tasteCol: 27 },
            { month: '2024-04', salesCol: 28, tasteCol: 29 },
            { month: '2024-05', salesCol: 30, tasteCol: 31 },
            { month: '2024-06', salesCol: 32, tasteCol: 33 },
            { month: '2024-07', salesCol: 34, tasteCol: 35 },
            { month: '2024-08', salesCol: 36, tasteCol: 37 },
            { month: '2024-09', salesCol: 38, tasteCol: 39 },
            { month: '2024-10', salesCol: 40, tasteCol: 41 },
            { month: '2024-11', salesCol: 42, tasteCol: 43 },
            { month: '2024-12', salesCol: 44, tasteCol: 45 },
            { month: '2025-01', salesCol: 46, tasteCol: 47 },
            { month: '2025-02', salesCol: 48, tasteCol: 49 },
            { month: '2025-03', salesCol: 50, tasteCol: 51 },
            { month: '2025-04', salesCol: 52, tasteCol: 53 },
            { month: '2025-05', salesCol: 54, tasteCol: 55 },
            { month: '2025-06', salesCol: 56, tasteCol: 57 },
            { month: '2025-07', salesCol: 58, tasteCol: 59 },
            { month: '2025-08', salesCol: 60, tasteCol: 61 },
            { month: '2025-09', salesCol: 62, tasteCol: 63 },
            { month: '2025-10', salesCol: 64, tasteCol: 65 },
            { month: '2025-11', salesCol: 66, tasteCol: 67 },
            { month: '2025-12', salesCol: 68, tasteCol: 69 },
            { month: '2026-01', salesCol: 70, tasteCol: 71 },
            { month: '2026-02', salesCol: 72, tasteCol: 73 },
            { month: '2026-03', salesCol: 74, tasteCol: 75 },
            { month: '2026-04', salesCol: 76, tasteCol: 77 },
            { month: '2026-05', salesCol: 78, tasteCol: 79 },
            { month: '2026-06', salesCol: 80, tasteCol: 81 },
            { month: '2026-07', salesCol: 82, tasteCol: 83 },
        ]

        const records: { skuCode: string; productName: string; month: string; salesQty: number; tastingQty: number }[] = []

        for (let r = 7; r <= Math.min(rows.length - 1, 200); r++) {
            const row = rows[r]
            if (!row) continue
            let code = (row[0] || '').toString().trim()
            const name = (row[1] || '').toString().trim()

            if (!code && !name) continue
            if (code && !code.startsWith('L') && !code.startsWith('Total')) continue

            if (!code && name.includes('Calabria The Wall Shiraz')) code = 'L40010'
            if (!code && name.includes('Calabria The Wall Chardonnay')) code = 'L40011'
            if (!code && name.includes('Calabria Guiding Star Shiraz')) code = 'L40012'
            if (!code && name.includes('Calabria Guiding Star Chardonnay')) code = 'L40013'
            if (!code && name.includes('Calabria Guiding Star Moscato')) code = 'L40014'

            if (!code.startsWith('L')) continue

            for (const mc of monthCols) {
                const salesVal = Number(row[mc.salesCol] || 0)
                const tasteVal = mc.tasteCol >= 0 ? Number(row[mc.tasteCol] || 0) : 0

                records.push({
                    skuCode: code,
                    productName: name,
                    month: mc.month,
                    salesQty: isNaN(salesVal) ? 0 : salesVal,
                    tastingQty: isNaN(tasteVal) ? 0 : tasteVal,
                })
            }
        }

        if (records.length === 0) {
            return { success: false, error: 'Không tìm thấy dòng dữ liệu sản phẩm hợp lệ trong file.' }
        }

        const CHUNK_SIZE = 200
        for (let i = 0; i < records.length; i += CHUNK_SIZE) {
            const chunk = records.slice(i, i + CHUNK_SIZE)
            const values: string[] = []
            const params: (string | number)[] = []
            let pIdx = 1

            for (const rec of chunk) {
                values.push(`(gen_random_uuid()::text, $${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, 'EXCEL_STOCK_REPORT', NOW(), NOW())`)
                params.push(rec.skuCode, rec.productName, rec.month, rec.salesQty, rec.tastingQty)
                pIdx += 5
            }

            const query = `
                INSERT INTO historical_monthly_sales (id, "skuCode", "productName", "month", "salesQty", "tastingQty", "source", "updatedAt", "createdAt")
                VALUES ${values.join(', ')}
                ON CONFLICT ("skuCode", "month")
                DO UPDATE SET "salesQty" = EXCLUDED."salesQty",
                              "tastingQty" = EXCLUDED."tastingQty",
                              "productName" = COALESCE(EXCLUDED."productName", historical_monthly_sales."productName"),
                              "updatedAt" = NOW()
            `
            await withRetry(() => prisma.$executeRawUnsafe(query, ...params))
        }

        revalidatePath('/dashboard/reports')
        return { success: true, count: records.length }
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Lỗi không xác định khi nhập file Excel'
        return { success: false, error: message }
    }
}

// ── EXPORT STOCK VELOCITY REPORT TO EXCEL ───────────────────────────────────
export async function exportStockVelocityExcel(options?: { cycleMonths?: number }): Promise<{ base64: string; filename: string }> {
    const res = await getStockVelocityReport(options)
    if (!res.success || !res.data) {
        throw new Error(res.error || 'Không thể tạo dữ liệu báo cáo để xuất Excel')
    }
    const { items, summary } = res.data

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Wine ERP'
    wb.created = new Date()

    const ws = wb.addWorksheet('Stock & Velocity Report', {
        views: [{ state: 'frozen', xSplit: 4, ySplit: 2 }],
    })

    // Header styling
    const headerFill: ExcelJS.Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE2E8F0' },
    }
    const headerFont: Partial<ExcelJS.Font> = {
        name: 'Segoe UI',
        size: 9,
        bold: true,
        color: { argb: 'FF1E293B' },
    }
    const borderStyle: Partial<ExcelJS.Borders> = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    }

    // Build columns
    const columns: Partial<ExcelJS.Column>[] = [
        { header: 'Mã hàng (SKU)', key: 'skuCode', width: 14 },
        { header: 'Tên sản phẩm', key: 'productName', width: 34 },
        { header: 'Nhà sản xuất', key: 'producerName', width: 22 },
        { header: 'Tổng tồn', key: 'totalStock', width: 12 },
        { header: 'Kho Thường Tín', key: 'stockTT', width: 14 },
        { header: 'Kho G.V.Minh', key: 'stockGVM', width: 14 },
        { header: 'Kho Ký gửi/SR', key: 'stockSR', width: 14 },
        { header: `TB Bán (${summary.cycleMonths}T)`, key: 'avgMonthlySales', width: 14 },
        { header: 'Số tháng bán', key: 'stockMonths', width: 14 },
        { header: 'Tình trạng tồn', key: 'riskStatus', width: 16 },
        { header: 'Tổng bán cũ (< T8/26)', key: 'historicalTotal', width: 16 },
    ]

    // Add columns for recent months (e.g., live months)
    for (const lm of summary.liveMonthKeys) {
        columns.push({
            header: `Bán ${lm}`,
            key: `sales_${lm}`,
            width: 12,
        })
    }

    // Incoming columns
    columns.push(
        { header: 'Hàng sắp về', key: 'incomingQty', width: 13 },
        { header: 'Số đơn PO', key: 'incomingPo', width: 14 },
        { header: 'Dự kiến về (ETA)', key: 'incomingEta', width: 15 }
    )

    ws.columns = columns

    // Apply header style
    const headerRow = ws.getRow(1)
    headerRow.height = 28
    headerRow.eachCell(cell => {
        cell.fill = headerFill
        cell.font = headerFont
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = borderStyle
    })

    // Status label mapper
    const statusLabels: Record<StockRiskStatus, string> = {
        CRITICAL: 'Nguy cơ thiếu (<2T)',
        OPTIMAL: 'Tối ưu (2-6T)',
        ABUNDANT: 'Dồi dào (6-12T)',
        OVERSTOCK: 'Tồn đọng (>12T)',
        OUT_OF_STOCK: 'Hết hàng (0)',
        NO_SALES: 'Chưa phát sinh bán',
    }

    // Add data rows
    items.forEach(item => {
        const rowData: Record<string, string | number> = {
            skuCode: item.skuCode,
            productName: item.productName,
            producerName: item.producerName,
            totalStock: item.totalStock,
            stockTT: item.stockTT,
            stockGVM: item.stockGVM,
            stockSR: item.stockSR,
            avgMonthlySales: item.avgMonthlySales,
            stockMonths: item.stockMonths === 999 ? '∞' : item.stockMonths,
            riskStatus: statusLabels[item.riskStatus],
            historicalTotal: item.historicalTotal,
            incomingQty: item.incomingQty || '',
            incomingPo: item.incomingPo || '',
            incomingEta: item.incomingEta || '',
        }

        // Add live month sales
        summary.liveMonthKeys.forEach(lm => {
            const mData = item.allMonths.find(m => m.month === lm)
            rowData[`sales_${lm}`] = mData ? mData.salesQty : 0
        })

        const row = ws.addRow(rowData)
        row.height = 20
        row.eachCell((cell, colNum) => {
            cell.font = { name: 'Segoe UI', size: 9 }
            cell.border = borderStyle
            if (colNum >= 4 && colNum <= 9) {
                cell.alignment = { vertical: 'middle', horizontal: 'right' }
            } else {
                cell.alignment = { vertical: 'middle', horizontal: colNum === 1 ? 'center' : 'left' }
            }
        })
    })

    const buffer = await wb.xlsx.writeBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const filename = `Bao_Cao_Ton_Kho_Nhip_Do_Ban_${new Date().toISOString().slice(0, 10)}.xlsx`

    return { base64, filename }
}
