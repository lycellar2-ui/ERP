import { getTopSKUs, getMonthlyRevenue, getRevenueByChannel, getStockValuation, getRevenueByBrand } from './actions'
import { ReportsClient } from './ReportsClient'

export const metadata = { title: 'Báo Cáo | Wine ERP' }

export default async function ReportsPage() {
    const [topSKUs, monthlyRevenue, channelBreakdown, stockVal, brandBreakdown] = await Promise.all([
        getTopSKUs(10),
        getMonthlyRevenue(),
        getRevenueByChannel(),
        getStockValuation(),
        getRevenueByBrand(),
    ])
    return (
        <ReportsClient
            topSKUs={topSKUs}
            monthlyRevenue={monthlyRevenue}
            channelBreakdown={channelBreakdown}
            stockValuation={stockVal}
            brandBreakdown={brandBreakdown}
        />
    )
}

