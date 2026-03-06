export const dynamic = 'force-dynamic'

import { getSalesOrders, getSalesStats } from './actions'
import { SalesClient } from './SalesClient'

export const metadata = {
    title: 'Đơn Bán Hàng | Wine ERP',
    description: "Quản lý Sales Orders – LY's Cellars",
}

export default async function SalesPage() {
    const [{ rows, total }, stats] = await Promise.all([
        getSalesOrders({ page: 1, pageSize: 20 }),
        getSalesStats(),
    ])

    return <SalesClient initialRows={rows} initialTotal={total} stats={stats} />
}
