import { getCurrentUser } from '@/lib/session'
import { getTransferOrders, getTransferStats } from './actions'
import { TransfersClient } from './TransfersClient'

export const metadata = { title: 'Chuyển Kho | Wine ERP' }

export default async function TransfersPage() {
    const [user, rows, stats] = await Promise.all([
        getCurrentUser(),
        getTransferOrders(),
        getTransferStats(),
    ])
    return <TransfersClient initialRows={rows} stats={stats} currentUserRoles={user?.roles || []} />
}
