'use server'

import { prisma } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import { cached, revalidateCache } from '@/lib/cache'

// ═══════════════════════════════════════════════════
// KPI — Target Config & Auto-Calculation
// ═══════════════════════════════════════════════════

export interface KpiSummary {
    label: string
    metric: string
    target: number
    actual: number
    unit: string
    progressPct: number
    status: 'ON_TRACK' | 'AT_RISK' | 'BEHIND' | 'EXCEEDED'
    color: string
    forecast?: number
}

export interface KpiTargetRow {
    id: string
    metric: string
    year: number
    month: number | null
    targetValue: number
    unit: string
    salesRepId: string | null
    salesRepName: string | null
}

function calcStatus(pct: number): KpiSummary['status'] {
    if (pct > 110) return 'EXCEEDED'
    if (pct < 70) return 'BEHIND'
    if (pct < 90) return 'AT_RISK'
    return 'ON_TRACK'
}

// Default targets when no DB config exists
const DEFAULT_TARGETS: Record<string, { value: number; unit: string; label: string; color: string }> = {
    REVENUE: { value: 5_000_000_000, unit: 'VND', label: 'Doanh Thu Tháng', color: '#87CBB9' },
    ORDERS: { value: 50, unit: 'đơn', label: 'Số Đơn Bán Hàng', color: '#4A8FAB' },
    NEW_CUSTOMERS: { value: 5, unit: 'KH', label: 'Khách Hàng Mới', color: '#5BA88A' },
    AR_LIMIT: { value: 2_000_000_000, unit: 'VND', label: 'Công Nợ AR (Giới hạn)', color: '#D4A853' },
    STOCK_VALUE: { value: 10_000_000_000, unit: 'VND', label: 'Giá Trị Tồn Kho', color: '#8AAEBB' },
}

// ─── Get KPI Summary (with DB targets) ────────────
export async function getKpiSummary(): Promise<KpiSummary[]> {
    return cached('kpi:summary', async () => {
        const now = new Date()
        const year = now.getFullYear()
        const month = now.getMonth() + 1
        const monthStart = new Date(year, now.getMonth(), 1)
        const daysInMonth = new Date(year, now.getMonth() + 1, 0).getDate()
        const daysElapsed = Math.max(1, now.getDate())
        const forecastMultiplier = daysInMonth / daysElapsed

        // Load custom targets from DB
        const dbTargets = await prisma.kpiTarget.findMany({
            where: {
                year,
                OR: [{ month }, { month: null }], // monthly or annual
                salesRepId: null, // company-wide only for summary
            },
        })

        // Build target map (monthly overrides annual)
        const targetMap = new Map<string, number>()
        for (const t of dbTargets) {
            const existing = targetMap.get(t.metric)
            if (!existing || t.month !== null) {
                targetMap.set(t.metric, Number(t.targetValue))
            }
        }

        function getTarget(metric: string): number {
            return targetMap.get(metric) ?? DEFAULT_TARGETS[metric]?.value ?? 0
        }

        const [monthRevenue, monthOrders, newCustomers, arOutstanding, stockValue] = await Promise.all([
            prisma.salesOrder.aggregate({
                where: {
                    status: { in: ['CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'INVOICED', 'PAID'] },
                    createdAt: { gte: monthStart },
                },
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
        ])

        const revenueActual = Number(monthRevenue._sum?.totalAmount ?? 0)
        const arActual = Number(arOutstanding._sum?.amount ?? 0)
        const stockVal = stockValue.reduce((s, l) => s + Number(l.qtyAvailable) * Number(l.unitLandedCost), 0)

        const tRevenue = getTarget('REVENUE')
        const tOrders = getTarget('ORDERS')
        const tNewCustomers = getTarget('NEW_CUSTOMERS')
        const tARLimit = getTarget('AR_LIMIT')
        const tStockValue = getTarget('STOCK_VALUE')

        return [
            {
                label: DEFAULT_TARGETS.REVENUE.label, metric: 'REVENUE',
                target: tRevenue, actual: revenueActual, unit: 'VND',
                progressPct: tRevenue > 0 ? (revenueActual / tRevenue) * 100 : 0,
                status: calcStatus(tRevenue > 0 ? (revenueActual / tRevenue) * 100 : 0),
                color: DEFAULT_TARGETS.REVENUE.color,
                forecast: Math.round(revenueActual * forecastMultiplier),
            },
            {
                label: DEFAULT_TARGETS.ORDERS.label, metric: 'ORDERS',
                target: tOrders, actual: monthOrders, unit: 'đơn',
                progressPct: tOrders > 0 ? (monthOrders / tOrders) * 100 : 0,
                status: calcStatus(tOrders > 0 ? (monthOrders / tOrders) * 100 : 0),
                color: DEFAULT_TARGETS.ORDERS.color,
                forecast: Math.round(monthOrders * forecastMultiplier),
            },
            {
                label: DEFAULT_TARGETS.NEW_CUSTOMERS.label, metric: 'NEW_CUSTOMERS',
                target: tNewCustomers, actual: newCustomers, unit: 'KH',
                progressPct: tNewCustomers > 0 ? (newCustomers / tNewCustomers) * 100 : 0,
                status: calcStatus(tNewCustomers > 0 ? (newCustomers / tNewCustomers) * 100 : 0),
                color: DEFAULT_TARGETS.NEW_CUSTOMERS.color,
                forecast: Math.round(newCustomers * forecastMultiplier),
            },
            {
                label: DEFAULT_TARGETS.AR_LIMIT.label, metric: 'AR_LIMIT',
                target: tARLimit, actual: arActual, unit: 'VND',
                progressPct: arActual > 0 ? Math.max(0, (1 - arActual / tARLimit) * 100) : 100,
                status: arActual > tARLimit ? 'BEHIND' : arActual > tARLimit * 0.8 ? 'AT_RISK' : 'ON_TRACK',
                color: DEFAULT_TARGETS.AR_LIMIT.color,
            },
            {
                label: DEFAULT_TARGETS.STOCK_VALUE.label, metric: 'STOCK_VALUE',
                target: tStockValue, actual: stockVal, unit: 'VND',
                progressPct: tStockValue > 0 ? (stockVal / tStockValue) * 100 : 0,
                status: calcStatus(tStockValue > 0 ? (stockVal / tStockValue) * 100 : 0),
                color: DEFAULT_TARGETS.STOCK_VALUE.color,
            },
        ]
    }) // end cached
}

// ─── CRUD KPI Targets ─────────────────────────────
export async function getKpiTargets(year: number): Promise<KpiTargetRow[]> {
    return cached(`kpi:targets:${year}`, async () => {
        const targets = await prisma.kpiTarget.findMany({
            where: { year },
            include: { salesRep: { select: { name: true } } },
            orderBy: [{ metric: 'asc' }, { month: 'asc' }],
        })
        return targets.map(t => ({
            id: t.id,
            metric: t.metric,
            year: t.year,
            month: t.month,
            targetValue: Number(t.targetValue),
            unit: t.unit,
            salesRepId: t.salesRepId,
            salesRepName: t.salesRep?.name ?? null,
        }))
    }) // end cached
}

export async function upsertKpiTarget(input: {
    metric: string
    year: number
    month: number | null
    targetValue: number
    unit: string
    salesRepId?: string | null
}): Promise<{ success: boolean; error?: string }> {
    try {
        const existing = await prisma.kpiTarget.findFirst({
            where: {
                metric: input.metric,
                year: input.year,
                month: input.month ?? null,
                salesRepId: input.salesRepId ?? null,
            },
        })
        if (existing) {
            await prisma.kpiTarget.update({
                where: { id: existing.id },
                data: { targetValue: input.targetValue, unit: input.unit },
            })
        } else {
            await prisma.kpiTarget.create({
                data: {
                    metric: input.metric,
                    year: input.year,
                    month: input.month ?? null,
                    targetValue: input.targetValue,
                    unit: input.unit,
                    salesRepId: input.salesRepId ?? null,
                },
            })
        }
        revalidateCache('kpi')
        revalidatePath('/dashboard/kpi')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

export async function deleteKpiTarget(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        await prisma.kpiTarget.delete({ where: { id } })
        revalidateCache('kpi')
        revalidatePath('/dashboard/kpi')
        return { success: true }
    } catch (err: any) {
        return { success: false, error: err.message }
    }
}

// ─── Sales Rep options for dropdown ───────────────
export async function getSalesRepOptions() {
    return prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
    })
}

// ─── Available metric names ─────────────────────
export async function getAvailableMetrics() {
    return Object.entries(DEFAULT_TARGETS).map(([k, v]) => ({ metric: k, label: v.label, unit: v.unit }))
}

// ─── Copy KPI Targets from Previous Year ─────────
export async function copyKpiFromPreviousYear(input: {
    fromYear: number
    toYear: number
    growthMultiplier?: number // e.g., 1.1 for +10% growth
}): Promise<{ success: boolean; copied: number; error?: string }> {
    try {
        const multiplier = input.growthMultiplier ?? 1.0
        const existingTargets = await prisma.kpiTarget.findMany({
            where: { year: input.fromYear },
        })

        if (existingTargets.length === 0) {
            return { success: false, copied: 0, error: `Không tìm thấy KPI nào cho năm ${input.fromYear}` }
        }

        // Check for existing targets in target year
        const existingInTargetYear = await prisma.kpiTarget.count({ where: { year: input.toYear } })
        if (existingInTargetYear > 0) {
            return { success: false, copied: 0, error: `Năm ${input.toYear} đã có ${existingInTargetYear} chỉ tiêu. Hãy xóa trước.` }
        }

        let copied = 0
        for (const t of existingTargets) {
            await prisma.kpiTarget.create({
                data: {
                    metric: t.metric,
                    year: input.toYear,
                    month: t.month,
                    targetValue: Math.round(Number(t.targetValue) * multiplier),
                    unit: t.unit,
                    salesRepId: t.salesRepId,
                },
            })
            copied++
        }

        revalidateCache('kpi')
        revalidatePath('/dashboard/kpi')
        return { success: true, copied }
    } catch (err: any) {
        return { success: false, copied: 0, error: err.message }
    }
}

// ─── Import KPI Targets from Excel Data ──────────
export async function importKpiFromExcel(input: {
    year: number
    targets: {
        metric: string
        month: number | null
        targetValue: number
        unit: string
        salesRepId?: string | null
    }[]
}): Promise<{ success: boolean; imported: number; skipped: number; error?: string }> {
    try {
        let imported = 0
        let skipped = 0

        for (const t of input.targets) {
            // Validate metric name
            if (!DEFAULT_TARGETS[t.metric]) {
                skipped++
                continue
            }

            // Upsert target
            const existing = await prisma.kpiTarget.findFirst({
                where: {
                    metric: t.metric,
                    year: input.year,
                    month: t.month,
                    salesRepId: t.salesRepId ?? null,
                },
            })

            if (existing) {
                await prisma.kpiTarget.update({
                    where: { id: existing.id },
                    data: { targetValue: t.targetValue, unit: t.unit },
                })
            } else {
                await prisma.kpiTarget.create({
                    data: {
                        metric: t.metric,
                        year: input.year,
                        month: t.month,
                        targetValue: t.targetValue,
                        unit: t.unit,
                        salesRepId: t.salesRepId ?? null,
                    },
                })
            }
            imported++
        }

        revalidateCache('kpi')
        revalidatePath('/dashboard/kpi')
        return { success: true, imported, skipped }
    } catch (err: any) {
        return { success: false, imported: 0, skipped: 0, error: err.message }
    }
}
