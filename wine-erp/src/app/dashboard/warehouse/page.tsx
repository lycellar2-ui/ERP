export const revalidate = 45

import { getWarehouses, getWMSStats } from './actions'
import { WarehouseClient } from './WarehouseClient'

export const metadata = { title: 'Kho Hàng (WMS) | Wine ERP' }

export default async function WarehousePage() {
    const [warehouses, stats] = await Promise.all([
        getWarehouses().catch(() => []),
        getWMSStats().catch(() => ({ warehouses: 0, totalLots: 0, availableBottles: 0, reservedBottles: 0 })),
    ])

    return <WarehouseClient initialWarehouses={warehouses} stats={stats} />
}

