import { SalesClient } from './SalesClient'
import { getCurrentUser } from '@/lib/session'

export const metadata = {
    title: 'Đơn Bán Hàng | Wine ERP',
    description: "Quản lý Sales Orders – LY's Cellars",
}

export default async function SalesPage() {
    const user = await getCurrentUser()
    const userRoles = user?.roles ?? []

    // Pass default empty initial props. SalesClient will trigger dynamic load on mount.
    const initialRows: any[] = []
    const initialTotal = 0
    const stats = {
        monthRevenue: 0,
        monthOrders: 0,
        pendingApproval: 0,
        draft: 0,
        confirmed: 0,
    }
    const statusCounts = {
        ALL: 0,
    }

    return (
        <SalesClient
            initialRows={initialRows}
            initialTotal={initialTotal}
            stats={stats}
            userId={user?.id ?? ''}
            userRoles={userRoles}
            statusCounts={statusCounts}
        />
    )
}
