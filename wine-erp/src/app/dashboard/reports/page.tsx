import { getTopSKUs, getMonthlyRevenue, getRevenueByChannel, getStockValuation, getRevenueByBrand, getTopCustomers, getFinancialSummary, getLowStockAlerts, getSalesRepPerformance } from './actions'
import { getStockVelocityReport, type StockVelocityReportResponse } from './actions-stock-velocity'
import { ReportsClient } from './ReportsClient'

export const metadata = { title: 'Báo Cáo | Wine ERP' }

export default async function ReportsPage() {
    const [
        topSKUs,
        monthlyRevenue,
        channelBreakdown,
        stockVal,
        brandBreakdown,
        topCustomers,
        financialSummary,
        lowStockAlerts,
        salesRepPerformance,
        stockVelocityInitial,
    ] = await Promise.all([
        getTopSKUs(10),
        getMonthlyRevenue(),
        getRevenueByChannel(),
        getStockValuation(),
        getRevenueByBrand(),
        getTopCustomers(5),
        getFinancialSummary(),
        getLowStockAlerts(5),
        getSalesRepPerformance(5),
        getStockVelocityReport({ cycleMonths: 6 }).catch((err: unknown): StockVelocityReportResponse => {
            console.error('[ReportsPage] Error pre-loading stock velocity:', err)
            return { success: false, data: undefined, error: err instanceof Error ? err.message : String(err) }
        }),
    ])
    return (
        <ReportsClient
            topSKUs={topSKUs}
            monthlyRevenue={monthlyRevenue}
            channelBreakdown={channelBreakdown}
            stockValuation={stockVal}
            brandBreakdown={brandBreakdown}
            topCustomers={topCustomers}
            financialSummary={financialSummary}
            lowStockAlerts={lowStockAlerts}
            salesRepPerformance={salesRepPerformance}
            initialVelocityReport={stockVelocityInitial?.success ? stockVelocityInitial.data : undefined}
        />
    )
}
