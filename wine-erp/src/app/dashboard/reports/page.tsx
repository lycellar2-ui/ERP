import { getTopSKUs, getMonthlyRevenue, getRevenueByChannel, getStockValuation, getRevenueByBrand, getTopCustomers, getFinancialSummary, getLowStockAlerts, getSalesRepPerformance } from './actions'
import { ReportsClient } from './ReportsClient'

export const metadata = { title: 'Báo Cáo | Wine ERP' }

export default async function ReportsPage() {
    const [topSKUs, monthlyRevenue, channelBreakdown, stockVal, brandBreakdown, topCustomers, financialSummary, lowStockAlerts, salesRepPerformance] = await Promise.all([
        getTopSKUs(10),
        getMonthlyRevenue(),
        getRevenueByChannel(),
        getStockValuation(),
        getRevenueByBrand(),
        getTopCustomers(5),
        getFinancialSummary(),
        getLowStockAlerts(5),
        getSalesRepPerformance(5),
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
        />
    )
}
