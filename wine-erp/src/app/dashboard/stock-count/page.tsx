export const dynamic = 'force-dynamic'

import { getStockCountList, getCountStats } from './actions'
import { StockCountClient } from './StockCountClient'

export const metadata = { title: 'Kiểm Kê | Wine ERP' }

export default async function StockCountPage() {
    const [rows, stats] = await Promise.all([
        getStockCountList(),
        getCountStats(),
    ])
    return <StockCountClient initialRows={rows} stats={stats} />
}
