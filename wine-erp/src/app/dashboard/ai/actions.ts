'use server'

import { prisma } from '@/lib/db'

// ═══════════════════════════════════════════════════
// AI FEATURES — Demand forecast + Pricing suggestion
// ═══════════════════════════════════════════════════

// Simple moving average demand forecast (no external AI dependency)
export async function forecastDemand(productId: string, monthsAhead: number = 3) {
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

    // Get historical sales data
    const sales = await prisma.salesOrderLine.findMany({
        where: {
            productId,
            so: {
                status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                createdAt: { gte: sixMonthsAgo },
            },
        },
        include: { so: { select: { createdAt: true } } },
    })

    // Group by month
    const monthlyQty: Record<string, number> = {}
    sales.forEach(s => {
        const key = `${s.so.createdAt.getFullYear()}-${String(s.so.createdAt.getMonth() + 1).padStart(2, '0')}`
        monthlyQty[key] = (monthlyQty[key] ?? 0) + Number(s.qtyOrdered)
    })

    const values = Object.values(monthlyQty)
    if (values.length === 0) {
        return {
            productId,
            historicalMonths: 0,
            avgMonthlyDemand: 0,
            trend: 'no_data' as const,
            forecast: Array.from({ length: monthsAhead }, (_, i) => {
                const d = new Date()
                d.setMonth(d.getMonth() + i + 1)
                return {
                    month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                    predicted: 0,
                    confidence: 0,
                }
            }),
        }
    }

    const avg = values.reduce((a, b) => a + b, 0) / values.length

    // Simple trend detection
    let trend: 'growing' | 'declining' | 'stable' | 'no_data' = 'stable'
    if (values.length >= 3) {
        const firstHalf = values.slice(0, Math.floor(values.length / 2))
        const secondHalf = values.slice(Math.floor(values.length / 2))
        const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length
        const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length
        if (avgSecond > avgFirst * 1.15) trend = 'growing'
        else if (avgSecond < avgFirst * 0.85) trend = 'declining'
    }

    // Generate forecast with simple exponential smoothing
    const alpha = 0.3
    let lastSmoothed = values[values.length - 1]
    const forecast = Array.from({ length: monthsAhead }, (_, i) => {
        const predicted = Math.round(lastSmoothed * (trend === 'growing' ? 1.05 : trend === 'declining' ? 0.95 : 1))
        lastSmoothed = alpha * predicted + (1 - alpha) * lastSmoothed
        const d = new Date()
        d.setMonth(d.getMonth() + i + 1)
        return {
            month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            predicted,
            confidence: Math.max(0.3, 0.9 - i * 0.15),
        }
    })

    return {
        productId,
        historicalMonths: values.length,
        avgMonthlyDemand: Math.round(avg),
        trend,
        forecast,
    }
}

// AI pricing suggestion based on market data + costs + demand
export async function suggestPricing(productId: string) {
    // Get current stock costs
    const lots = await prisma.stockLot.findMany({
        where: { productId, status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
        select: { unitLandedCost: true, qtyAvailable: true },
    })

    const totalQty = lots.reduce((s, l) => s + Number(l.qtyAvailable), 0)
    const weightedCost = totalQty > 0
        ? lots.reduce((s, l) => s + Number(l.unitLandedCost) * Number(l.qtyAvailable), 0) / totalQty
        : 0

    // Get market prices
    const marketPrices = await prisma.marketPrice.findMany({
        where: { productId },
        orderBy: { priceDate: 'desc' },
        take: 5,
    })

    const latestMarketPrice = marketPrices.length > 0 ? Number(marketPrices[0].price) : 0
    const avgMarketPrice = marketPrices.length > 0
        ? marketPrices.reduce((s, p) => s + Number(p.price), 0) / marketPrices.length
        : 0

    // Get demand data
    const demand = await forecastDemand(productId, 1)

    // Calculate price tiers
    const margins = [
        { label: 'Aggressive (15%)', pct: 15, price: Math.round(weightedCost / (1 - 0.15)) },
        { label: 'Standard (25%)', pct: 25, price: Math.round(weightedCost / (1 - 0.25)) },
        { label: 'Premium (35%)', pct: 35, price: Math.round(weightedCost / (1 - 0.35)) },
        { label: 'VIP (45%)', pct: 45, price: Math.round(weightedCost / (1 - 0.45)) },
    ]

    // Recommendation logic
    let recommendedTier = 'Standard (25%)'
    if (demand.trend === 'growing' && totalQty < demand.avgMonthlyDemand * 2) {
        recommendedTier = 'Premium (35%)'
    } else if (demand.trend === 'declining') {
        recommendedTier = 'Aggressive (15%)'
    } else if (totalQty > demand.avgMonthlyDemand * 6) {
        recommendedTier = 'Aggressive (15%)'
    }

    return {
        productId,
        unitLandedCost: Math.round(weightedCost),
        currentStock: totalQty,
        latestMarketPrice,
        avgMarketPrice: Math.round(avgMarketPrice),
        demandTrend: demand.trend,
        avgMonthlyDemand: demand.avgMonthlyDemand,
        priceTiers: margins,
        recommendedTier,
        reasoning: generateReasoning(demand.trend, totalQty, demand.avgMonthlyDemand, latestMarketPrice, weightedCost),
    }
}

function generateReasoning(
    trend: string,
    stock: number,
    avgDemand: number,
    marketPrice: number,
    cost: number,
): string {
    const parts: string[] = []

    if (trend === 'growing') parts.push('📈 Nhu cầu đang tăng — có thể áp dụng giá cao hơn.')
    else if (trend === 'declining') parts.push('📉 Nhu cầu đang giảm — xem xét khuyến mãi hoặc giảm giá.')
    else if (trend === 'stable') parts.push('📊 Nhu cầu ổn định.')
    else parts.push('⚠️ Chưa đủ dữ liệu bán hàng để phân tích.')

    if (avgDemand > 0) {
        const monthsOfStock = Math.round(stock / avgDemand)
        if (monthsOfStock > 6) parts.push(`⚠️ Tồn kho ${monthsOfStock} tháng — nên giảm giá đẩy hàng.`)
        else if (monthsOfStock < 2) parts.push(`🔥 Chỉ còn ${monthsOfStock} tháng tồn — có thể tăng giá.`)
    }

    if (marketPrice > 0 && cost > 0) {
        const marketMargin = ((marketPrice - cost) / marketPrice) * 100
        parts.push(`💰 Biên lợi nhuận thị trường: ${marketMargin.toFixed(1)}%.`)
    }

    return parts.join(' ')
}

// ═══════════════════════════════════════════════════
// AI ANOMALY DETECTION — Suspicious transaction alerts
// ═══════════════════════════════════════════════════

export type AnomalyAlert = {
    type: 'unusual_order' | 'duplicate_invoice' | 'negative_stock' | 'expense_spike'
    severity: 'low' | 'medium' | 'high'
    title: string
    description: string
    entityId: string
    detectedAt: Date
}

export async function detectAnomalies(): Promise<AnomalyAlert[]> {
    const alerts: AnomalyAlert[] = []
    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)

    // 1. Unusually large orders (>3x average)
    try {
        const allOrders = await prisma.salesOrder.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { id: true, soNo: true, totalAmount: true, createdAt: true, customer: { select: { name: true } } },
        })
        if (allOrders.length > 3) {
            const avg = allOrders.reduce((s, o) => s + Number(o.totalAmount), 0) / allOrders.length
            const threshold = avg * 3
            for (const order of allOrders) {
                if (Number(order.totalAmount) > threshold) {
                    alerts.push({
                        type: 'unusual_order',
                        severity: 'high',
                        title: `Đơn hàng bất thường: ${order.soNo}`,
                        description: `${order.customer.name} — ₫${Number(order.totalAmount).toLocaleString()} (gấp ${(Number(order.totalAmount) / avg).toFixed(1)}x TB)`,
                        entityId: order.id,
                        detectedAt: now,
                    })
                }
            }
        }
    } catch { }

    // 2. Duplicate AR invoices (same customer + same amount in 7 days)
    try {
        const recentInvoices = await prisma.aRInvoice.findMany({
            where: { createdAt: { gte: thirtyDaysAgo } },
            select: { id: true, invoiceNo: true, amount: true, customerId: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        })
        const seen = new Map<string, typeof recentInvoices[0]>()
        for (const inv of recentInvoices) {
            const key = `${inv.customerId}-${Number(inv.amount)}`
            const prev = seen.get(key)
            if (prev) {
                const daysDiff = Math.abs(inv.createdAt.getTime() - prev.createdAt.getTime()) / (1000 * 60 * 60 * 24)
                if (daysDiff < 7) {
                    alerts.push({
                        type: 'duplicate_invoice',
                        severity: 'medium',
                        title: `Hóa đơn trùng: ${inv.invoiceNo}`,
                        description: `Cùng khách hàng + cùng số tiền ₫${Number(inv.amount).toLocaleString()} trong ${daysDiff.toFixed(0)} ngày`,
                        entityId: inv.id,
                        detectedAt: now,
                    })
                }
            }
            seen.set(key, inv)
        }
    } catch { }

    // 3. Negative stock (should never happen)
    try {
        const negLots = await prisma.stockLot.findMany({
            where: { qtyAvailable: { lt: 0 } },
            select: { id: true, lotNo: true, qtyAvailable: true },
            take: 10,
        })
        for (const lot of negLots) {
            alerts.push({
                type: 'negative_stock',
                severity: 'high',
                title: `Tồn kho âm: ${lot.lotNo}`,
                description: `Số lượng: ${Number(lot.qtyAvailable)} — Cần kiểm tra và điều chỉnh ngay`,
                entityId: lot.id,
                detectedAt: now,
            })
        }
    } catch { }

    // 4. Expense spikes (single expense > 50M without approval)
    try {
        const bigExpenses = await prisma.expense.findMany({
            where: {
                amount: { gt: 50_000_000 },
                status: { in: ['DRAFT', 'PENDING_APPROVAL'] },
                createdAt: { gte: thirtyDaysAgo },
            },
            select: { id: true, expenseNo: true, amount: true, category: true, description: true },
            take: 5,
        })
        for (const exp of bigExpenses) {
            alerts.push({
                type: 'expense_spike',
                severity: 'medium',
                title: `Chi phí lớn chưa duyệt: ${exp.expenseNo}`,
                description: `₫${Number(exp.amount).toLocaleString()} — ${exp.description ?? exp.category}`,
                entityId: exp.id,
                detectedAt: now,
            })
        }
    } catch { }

    return alerts.sort((a, b) =>
        a.severity === 'high' ? -1 : b.severity === 'high' ? 1 : 0
    )
}

// ═══════════════════════════════════════════════════
// OCR — Extract data from customs declarations / invoices
// ═══════════════════════════════════════════════════

export type OCRDeclarationResult = {
    success: boolean
    declarationNo?: string
    date?: string
    importerName?: string
    cifValue?: number
    cifCurrency?: string
    importTax?: number
    specialConsumptionTax?: number
    vatTax?: number
    totalTaxPayable?: number
    hsCode?: string
    rawText?: string
    error?: string
}

export async function ocrCustomsDeclaration(textContent: string): Promise<OCRDeclarationResult> {
    try {
        const { callGemini } = await import('@/lib/ai-service')
        const result = await callGemini({
            prompt: `Trích xuất thông tin từ tờ khai hải quan sau. Trả về JSON (không markdown):
{
  "declarationNo": "số tờ khai",
  "date": "ngày YYYY-MM-DD",
  "importerName": "tên công ty nhập khẩu",
  "cifValue": số CIF (number),
  "cifCurrency": "USD/EUR/...",
  "importTax": thuế nhập khẩu (number VND),
  "specialConsumptionTax": thuế TTĐB (number VND),
  "vatTax": thuế VAT (number VND),
  "totalTaxPayable": tổng thuế (number VND),
  "hsCode": "mã HS"
}

Nội dung tờ khai:
${textContent}`,
            systemPrompt: 'You are an expert at reading Vietnamese customs declarations (tờ khai hải quan). Extract data accurately. Return ONLY valid JSON.',
            temperature: 0.2,
            maxTokens: 1024,
        })

        if (!result.success) return { success: false, error: result.error }

        try {
            const cleaned = (result.text ?? '').replace(/```json\n?/g, '').replace(/```/g, '').trim()
            const parsed = JSON.parse(cleaned)
            return { success: true, ...parsed, rawText: textContent.slice(0, 200) }
        } catch {
            return { success: false, error: 'Không thể parse kết quả OCR', rawText: result.text }
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export type OCRLogisticsResult = {
    success: boolean
    invoiceNo?: string
    supplierName?: string
    costItems?: { description: string; amount: number; currency: string }[]
    totalAmount?: number
    rawText?: string
    error?: string
}

export async function ocrLogisticsInvoice(textContent: string): Promise<OCRLogisticsResult> {
    try {
        const { callGemini } = await import('@/lib/ai-service')
        const result = await callGemini({
            prompt: `Trích xuất chi phí logistics từ hóa đơn sau. Trả về JSON (không markdown):
{
  "invoiceNo": "số hóa đơn",
  "supplierName": "tên nhà cung cấp dịch vụ",
  "costItems": [
    { "description": "THC", "amount": 500, "currency": "USD" },
    { "description": "D/O Fee", "amount": 50, "currency": "USD" },
    { "description": "Trucking", "amount": 8000000, "currency": "VND" }
  ],
  "totalAmount": tổng tiền (number)
}

Nội dung hóa đơn:
${textContent}`,
            systemPrompt: 'You are an expert at reading Vietnamese logistics and shipping invoices. Extract all cost line items. Return ONLY valid JSON.',
            temperature: 0.2,
            maxTokens: 1024,
        })

        if (!result.success) return { success: false, error: result.error }

        try {
            const cleaned = (result.text ?? '').replace(/```json\n?/g, '').replace(/```/g, '').trim()
            const parsed = JSON.parse(cleaned)
            return { success: true, ...parsed, rawText: textContent.slice(0, 200) }
        } catch {
            return { success: false, error: 'Không thể parse kết quả OCR', rawText: result.text }
        }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ═══════════════════════════════════════════════════
// SMART PRODUCT SEARCH — Semantic-like without vectors
// ═══════════════════════════════════════════════════

export type SmartSearchResult = {
    id: string
    skuCode: string
    productName: string
    wineType: string
    country: string
    abvPercent: number | null
    score: number
    reason: string
    unitPrice: number
    qtyAvailable: number
}

const WINE_TYPE_KW: Record<string, string[]> = {
    RED: ['đỏ', 'red', 'cabernet', 'merlot', 'pinot noir', 'shiraz', 'malbec', 'syrah'],
    WHITE: ['trắng', 'white', 'chardonnay', 'sauvignon blanc', 'riesling', 'pinot grigio'],
    ROSE: ['hồng', 'rosé', 'rose'],
    SPARKLING: ['sủi', 'sparkling', 'champagne', 'prosecco'],
    DESSERT: ['ngọt', 'dessert', 'port', 'sherry'],
}

const COUNTRY_KW: Record<string, string> = {
    'pháp': 'France', 'france': 'France', 'ý': 'Italy', 'italy': 'Italy',
    'úc': 'Australia', 'chile': 'Chile', 'tây ban nha': 'Spain',
    'mỹ': 'USA', 'argentina': 'Argentina', 'đức': 'Germany',
}

export async function smartProductSearch(query: string): Promise<SmartSearchResult[]> {
    const q = query.toLowerCase().trim()

    let detectedTypes: string[] = []
    for (const [type, kws] of Object.entries(WINE_TYPE_KW)) {
        if (kws.some(kw => q.includes(kw))) detectedTypes.push(type)
    }

    let detectedCountry: string | null = null
    for (const [kw, country] of Object.entries(COUNTRY_KW)) {
        if (q.includes(kw)) { detectedCountry = country; break }
    }

    const isLight = q.includes('nhẹ') || q.includes('light')
    const isFull = q.includes('nặng') || q.includes('full')

    const where: any = { status: 'ACTIVE', deletedAt: null }
    if (detectedTypes.length > 0) where.wineType = { in: detectedTypes }
    if (detectedCountry) where.country = detectedCountry
    if (isLight) where.abvPercent = { lte: 12.5 }
    if (isFull) where.abvPercent = { gte: 14 }

    const products = await prisma.product.findMany({
        where,
        select: {
            id: true, skuCode: true, productName: true, wineType: true,
            country: true, abvPercent: true,
            stockLots: { where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } }, select: { qtyAvailable: true } },
            priceLines: { select: { unitPrice: true }, take: 1, orderBy: { priceList: { effectiveDate: 'desc' } } },
        },
        take: 50,
    })

    let results = products.map(p => {
        const unitPrice = p.priceLines[0] ? Number(p.priceLines[0].unitPrice) : 0
        const qtyAvailable = p.stockLots.reduce((s, l) => s + Number(l.qtyAvailable), 0)
        let score = 0
        const reasons: string[] = []

        if (detectedTypes.length > 0 && detectedTypes.includes(p.wineType ?? '')) { score += 30; reasons.push(`Loại: ${p.wineType}`) }
        if (detectedCountry && p.country === detectedCountry) { score += 25; reasons.push(`Xuất xứ: ${p.country}`) }
        if (isLight && p.abvPercent && Number(p.abvPercent) <= 12.5) { score += 20; reasons.push(`ABV ${p.abvPercent}% (nhẹ)`) }
        if (isFull && p.abvPercent && Number(p.abvPercent) >= 14) { score += 20; reasons.push(`ABV ${p.abvPercent}% (nặng)`) }

        const words = q.split(/\s+/)
        for (const w of words) {
            if (w.length > 2 && p.productName.toLowerCase().includes(w)) { score += 10; reasons.push(`"${w}"`) }
        }
        if (qtyAvailable > 0) score += 5

        return {
            id: p.id, skuCode: p.skuCode, productName: p.productName,
            wineType: p.wineType ?? 'OTHER', country: p.country ?? '',
            abvPercent: p.abvPercent ? Number(p.abvPercent) : null,
            score, reason: reasons.join(' • ') || 'Khớp cơ bản',
            unitPrice, qtyAvailable,
        }
    })

    return results.filter(r => r.score > 0).sort((a, b) => b.score - a.score).slice(0, 20)
}

// ═══════════════════════════════════════════════════
// CEO MONTHLY SUMMARY
// ═══════════════════════════════════════════════════

export async function generateCEOSummary() {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    const [revAgg, orderCount, newCust, arAgg, stockLots, overdueCount, pendingExp] = await Promise.all([
        prisma.salesOrder.aggregate({
            where: { status: { in: ['CONFIRMED', 'DELIVERED', 'INVOICED', 'PAID'] }, createdAt: { gte: monthStart } },
            _sum: { totalAmount: true },
        }),
        prisma.salesOrder.count({ where: { createdAt: { gte: monthStart } } }),
        prisma.customer.count({ where: { createdAt: { gte: monthStart }, deletedAt: null } }),
        prisma.aRInvoice.aggregate({
            where: { status: { in: ['UNPAID', 'PARTIALLY_PAID', 'OVERDUE'] } },
            _sum: { amount: true },
        }),
        prisma.stockLot.findMany({
            where: { status: 'AVAILABLE', qtyAvailable: { gt: 0 } },
            select: { qtyAvailable: true, unitLandedCost: true },
        }),
        prisma.aRInvoice.count({ where: { status: 'OVERDUE' } }),
        prisma.expense.count({ where: { status: 'PENDING_APPROVAL' } }),
    ])

    const alerts: string[] = []
    if (overdueCount > 0) alerts.push(`⚠ ${overdueCount} hóa đơn quá hạn`)
    if (pendingExp > 0) alerts.push(`📋 ${pendingExp} chi phí chờ duyệt`)

    return {
        period: `${now.getMonth() + 1}/${now.getFullYear()}`,
        revenue: Number(revAgg._sum?.totalAmount ?? 0),
        orderCount,
        newCustomers: newCust,
        arOutstanding: Number(arAgg._sum?.amount ?? 0),
        stockValue: stockLots.reduce((s, l) => s + Number(l.qtyAvailable) * Number(l.unitLandedCost), 0),
        alerts,
    }
}
