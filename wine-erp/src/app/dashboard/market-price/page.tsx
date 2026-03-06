export const revalidate = 90

import { getMarketPrices, getMarketPriceStats } from './actions'
import { MarketPriceClient } from './MarketPriceClient'

export const metadata = { title: 'Giá Thị Trường | Wine ERP' }

export default async function MarketPricePage() {
    const [rows, stats] = await Promise.all([
        getMarketPrices(),
        getMarketPriceStats(),
    ])
    return <MarketPriceClient initialRows={rows} stats={stats} />
}
