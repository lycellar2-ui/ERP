export const revalidate = 45

import { getSalesOrders, getSalesStats, getSOStatusCounts } from './actions'
import { SalesClient } from './SalesClient'
import { getCurrentUser } from '@/lib/session'

export const metadata = {
    title: 'Đơn Bán Hàng | Wine ERP',
    description: "Quản lý Sales Orders – LY's Cellars",
}

export default async function SalesPage() {
    const [{ rows, total }, stats, user, statusCounts] = await Promise.all([
        getSalesOrders({ page: 1, pageSize: 20 }),
        getSalesStats(),
        getCurrentUser(),
        getSOStatusCounts(),
    ])

    return <SalesClient initialRows={rows} initialTotal={total} stats={stats} userId={user?.id ?? ''} statusCounts={statusCounts} />
}
