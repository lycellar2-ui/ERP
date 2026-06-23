import { SalesClient } from './SalesClient'
import { getCurrentUser } from '@/lib/session'
import { getSalesPageData } from './actions'

export const metadata = {
    title: 'Đơn Bán Hàng | Wine ERP',
    description: "Quản lý Sales Orders – LY's Cellars",
}

export default async function SalesPage() {
    const user = await getCurrentUser()
    const userRoles = user?.roles ?? []

    // Pre-fetch initial data on server (defaults to page 1, 20 items)
    const data = await getSalesPageData({ page: 1, pageSize: 20 })

    return (
        <SalesClient
            initialRows={data.rows}
            initialTotal={data.total}
            stats={data.stats}
            userId={user?.id ?? ''}
            userRoles={userRoles}
            statusCounts={data.statusCounts}
        />
    )
}
