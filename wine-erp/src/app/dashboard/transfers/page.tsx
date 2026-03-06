export const revalidate = 30

import { getTransferOrders, getTransferStats } from './actions'
import { TransfersClient } from './TransfersClient'

export const metadata = { title: 'Chuyển Kho | Wine ERP' }

export default async function TransfersPage() {
    const [rows, stats] = await Promise.all([
        getTransferOrders(),
        getTransferStats(),
    ])
    return <TransfersClient initialRows={rows} stats={stats} />
}
