import {
    getDashboardStats,
    getPLSummary, getCashPosition, getARAgingChart, getPendingApprovalDetails,
    exportDashboardExcel, getCostWaterfall, WaterfallBar, getRevenueYoY,
    getDashboardConfig, type DashboardSection, getMySales, getWarehouseDashboard,
    getTopCustomers, getTopProducts, getRevenueByChannel,
    getDailyRevenueChart, getLegalEntitiesForDashboard, type DashboardFilterOptions,
} from './actions'
import { DashboardFilterBar, type PresetKey } from './DashboardFilterBar'
import { CustomerAnalyticsDashboard } from './CustomerAnalyticsDashboard'
import { DashboardHeaderNav } from './DashboardHeaderNav'
import { CeoOverviewContent } from './CeoOverviewContent'
import { startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { formatDate } from '@/lib/utils'
import { getComplianceWarnings } from './contracts/reg-doc-actions'
import { getKpiSummary } from './kpi/actions'
import { getPendingProposalsForCEO } from './proposals/actions'
import { getCurrentUser } from '@/lib/session'

interface PageProps {
    searchParams?: Promise<{
        preset?: string
        entity?: string
        from?: string
        to?: string
        tab?: string
        customerId?: string
    }>
}

export default async function DashboardPage(props: PageProps) {
    const resolvedParams = props.searchParams ? await props.searchParams : {}
    const preset = (resolvedParams.preset as PresetKey) ?? 'THIS_MONTH'
    const entity = resolvedParams.entity ?? 'ALL'
    const currentTab = resolvedParams.tab === 'customers' ? 'customers' : 'overview'

    const now = new Date()
    let from: Date
    let to: Date
    let displayRangeText = ''

    if (preset === 'TODAY') {
        const start = new Date(now)
        start.setHours(0, 0, 0, 0)
        const end = new Date(now)
        end.setHours(23, 59, 59, 999)
        from = start
        to = end
        displayRangeText = `Hôm nay (${formatDate(now)})`
    } else if (preset === 'YESTERDAY') {
        const yesterday = new Date(now)
        yesterday.setDate(yesterday.getDate() - 1)
        const start = new Date(yesterday)
        start.setHours(0, 0, 0, 0)
        const end = new Date(yesterday)
        end.setHours(23, 59, 59, 999)
        from = start
        to = end
        displayRangeText = `Hôm qua (${formatDate(yesterday)})`
    } else if (preset === '7DAYS') {
        const start = new Date(now)
        start.setDate(start.getDate() - 6)
        start.setHours(0, 0, 0, 0)
        const end = new Date(now)
        end.setHours(23, 59, 59, 999)
        from = start
        to = end
        displayRangeText = `7 ngày qua (${formatDate(start)} – ${formatDate(end)})`
    } else if (preset === 'LAST_MONTH') {
        const lastMonth = subMonths(now, 1)
        from = startOfMonth(lastMonth)
        to = endOfMonth(lastMonth)
        displayRangeText = `Tháng trước (Tháng ${lastMonth.getMonth() + 1}/${lastMonth.getFullYear()})`
    } else if (preset === 'CUSTOM' && resolvedParams.from && resolvedParams.to) {
        from = new Date(`${resolvedParams.from}T00:00:00.000`)
        to = new Date(`${resolvedParams.to}T23:59:59.999`)
        displayRangeText = `${formatDate(from)} – ${formatDate(to)}`
    } else {
        from = startOfMonth(now)
        to = endOfMonth(now)
        displayRangeText = `Tháng này (Tháng ${now.getMonth() + 1}/${now.getFullYear()})`
    }

    const filterOptions: DashboardFilterOptions = {
        from,
        to,
        legalEntityId: entity !== 'ALL' ? entity : undefined,
    }

    const user = await getCurrentUser()
    const roles = user?.roles ?? ['CEO']
    const dashConfig = await getDashboardConfig(roles)
    const has = (s: DashboardSection) => dashConfig.sections.includes(s)

    // Parallel fetch
    const [
        legalEntities,
        dailyRevenueData,
        stats,
        plSummary,
        cashPosition,
        kpiSummary,
        arAging,
        pendingApprovalReqs,
        waterfall,
        yoy,
        topCust,
        topProd,
        channelData,
        mySales,
        warehouseData,
        complianceWarnings,
        pendingProposals,
    ] = await Promise.all([
        getLegalEntitiesForDashboard(),
        getDailyRevenueChart(filterOptions),
        getDashboardStats('month', filterOptions),
        has('pl_summary') ? getPLSummary(filterOptions) : null,
        has('cash_position') ? getCashPosition(filterOptions) : null,
        has('kpi_targets') ? getKpiSummary() : null,
        has('ar_aging') ? getARAgingChart(filterOptions) : null,
        has('pending_approvals') ? getPendingApprovalDetails() : [],
        has('cost_waterfall') ? getCostWaterfall(filterOptions) : [],
        has('revenue_yoy') ? getRevenueYoY() : null,
        getTopCustomers(8, filterOptions),
        has('pl_summary') ? getTopProducts(5, filterOptions) : [],
        has('revenue_chart') ? getRevenueByChannel(filterOptions) : null,
        has('my_sales') && user ? getMySales(user.id) : null,
        has('warehouse_summary') ? getWarehouseDashboard() : null,
        has('legal_compliance') ? getComplianceWarnings() : [],
        has('pending_approvals') ? getPendingProposalsForCEO() : [],
    ])

    // Defaults
    const pl = plSummary ?? { revenue: 0, cogs: 0, grossProfit: 0, expenses: 0, netProfit: 0, grossMargin: 0 }
    const cash = cashPosition ?? { netCashFlow: 0, cashIn: 0, cashOutAP: 0, cashOutExpenses: 0, arOutstanding: 0, apOutstanding: 0 }
    const ar = arAging ?? { invoiceCount: 0, totalOutstanding: 0, buckets: [] as { label: string; amount: number; color: string }[] }
    const wf = Array.isArray(waterfall) ? { bars: [] as WaterfallBar[], revenue: 0, cogs: 0, totalExpenses: 0, netProfit: 0 } : waterfall
    const yoyData = yoy
    const kpis = kpiSummary ?? []

    const topCustomers = Array.isArray(topCust) ? topCust : []
    const topProducts = Array.isArray(topProd) ? topProd : []
    const channels = channelData ?? { total: 0, channels: [] }

    const primaryRevenue = pl.revenue > 0 ? pl.revenue : stats.revenue
    const revenueSource = pl.revenue > 0 ? 'TK 511' : 'SO'
    const arMax = ar.buckets.length > 0 ? Math.max(...ar.buckets.map(b => b.amount), 1) : 1
    const arOverdue = ar.buckets.filter(b => b.label !== 'Chưa đến hạn').reduce((s, b) => s + b.amount, 0)
    const totalPending = pendingProposals.length + stats.pendingSOs.length + (Array.isArray(pendingApprovalReqs) ? pendingApprovalReqs.length : 0)

    const pendingParts: string[] = []
    if (pendingProposals.length > 0) pendingParts.push(`${pendingProposals.length} tờ trình`)
    if (stats.pendingSOs.length > 0) pendingParts.push(`${stats.pendingSOs.length} SO`)
    if (Array.isArray(pendingApprovalReqs) && pendingApprovalReqs.length > 0) pendingParts.push(`${pendingApprovalReqs.length} yêu cầu`)
    const pendingSub = pendingParts.length > 0 ? pendingParts.join(' · ') : 'Không có mục chờ'

    return (
        <div className="space-y-5 max-w-7xl mx-auto">
            {/* Header & Bilingual Tabs */}
            <DashboardHeaderNav
                userName={user?.name}
                roles={roles}
                currentTab={currentTab}
                currentPreset={resolvedParams.preset}
                currentEntity={resolvedParams.entity}
                exportAction={async () => {
                    'use server'
                    await exportDashboardExcel()
                }}
            />

            {currentTab === 'customers' ? (
                <CustomerAnalyticsDashboard
                    topCustomers={topCustomers}
                    initialCustomerId={resolvedParams.customerId}
                />
            ) : (
                <>
                    {/* ═══ FILTER BAR (Bilingual) ═══ */}
                    <DashboardFilterBar
                        currentPreset={preset}
                        currentEntity={entity}
                        currentFrom={resolvedParams.from}
                        currentTo={resolvedParams.to}
                        legalEntities={legalEntities}
                        displayRangeText={displayRangeText}
                    />

                    {/* ═══ CEO OVERVIEW (Bilingual & Interactive) ═══ */}
                    <CeoOverviewContent
                        primaryRevenue={primaryRevenue}
                        revenueSource={revenueSource}
                        stats={stats}
                        pl={pl}
                        cash={cash}
                        ar={ar}
                        arMax={arMax}
                        arOverdue={arOverdue}
                        totalPending={totalPending}
                        pendingSub={pendingSub}
                        pendingProposals={pendingProposals}
                        pendingApprovalReqs={pendingApprovalReqs}
                        topCustomers={topCustomers}
                        topProducts={topProducts}
                        channels={channels}
                        yoyData={yoyData}
                        wf={wf}
                        kpis={kpis}
                        preset={preset}
                        displayRangeText={displayRangeText}
                        complianceWarnings={complianceWarnings}
                        mySales={mySales}
                        warehouseData={warehouseData}
                        dashConfig={dashConfig}
                        dailyRevenueData={dailyRevenueData}
                    />
                </>
            )}
        </div>
    )
}
