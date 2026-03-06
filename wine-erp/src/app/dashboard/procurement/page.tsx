export const revalidate = 45

import { getPurchaseOrders, getPOStats } from './actions'
import { ProcurementClient } from './ProcurementClient'

export const metadata = { title: 'Đơn Mua Hàng | Wine ERP' }

export default async function ProcurementPage() {
    const [{ rows, total }, stats] = await Promise.all([
        getPurchaseOrders({ page: 1, pageSize: 20 }).catch(() => ({ rows: [], total: 0 })),
        getPOStats().catch(() => ({ total: 0, draft: 0, approved: 0, inTransit: 0 })),
    ])

    return <ProcurementClient initialRows={rows} initialTotal={total} stats={stats} />
}

