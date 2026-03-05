export const dynamic = 'force-dynamic'

import { getReturnOrders, getReturnStats } from './actions'
import { ReturnsClient } from './ReturnsClient'

export const metadata = { title: 'Trả Hàng & Credit Note | Wine ERP' }

export default async function ReturnsPage() {
    const [rows, stats] = await Promise.all([
        getReturnOrders(),
        getReturnStats(),
    ])
    return <ReturnsClient initialRows={rows} stats={stats} />
}
