import { getWarehouses, getWMSStats } from './actions'
import { WarehouseClient } from './WarehouseClient'
import { getCurrentUser, hasRole } from '@/lib/session'

export const metadata = { title: 'Kho Hàng (WMS) | Wine ERP' }

export default async function WarehousePage() {
    let warehouses: any[] = []
    try {
        warehouses = await getWarehouses()
    } catch (err) {
        console.error('[WMS] getWarehouses FAILED:', err)
    }

    const [stats, user] = await Promise.all([
        getWMSStats().catch(() => ({ warehouses: 0, totalLots: 0, availableBottles: 0, reservedBottles: 0, inventoryValue: 0, quarantinedCount: 0, lowStockCount: 0, slowMovingCount: 0 })),
        getCurrentUser(),
    ])

    const isAdmin = user ? hasRole(user, 'CEO', 'THU_KHO') : false

    return <WarehouseClient initialWarehouses={warehouses} stats={stats} isAdmin={isAdmin} />
}

