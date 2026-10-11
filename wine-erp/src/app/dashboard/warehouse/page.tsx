import { getWarehouses, getWMSStats } from './actions'
import { WarehouseClient } from './WarehouseClient'
import { getCurrentUser, hasRole } from '@/lib/session'

export const metadata = { title: 'Kho Hàng (WMS) | Wine ERP' }

export default async function WarehousePage() {
    const [warehouses, stats, user] = await Promise.all([
        getWarehouses().catch(() => [] as any[]),
        getWMSStats().catch(() => ({ warehouses: 0, totalLots: 0, availableBottles: 0, reservedBottles: 0, inventoryValue: 0, quarantinedCount: 0, lowStockCount: 0, slowMovingCount: 0 })),
        getCurrentUser(),
    ])

    const isAdmin = user ? hasRole(user, 'CEO', 'ADMIN', 'TRO_LY', 'Trợ Lý', 'THU_KHO', 'Thủ Kho') : false
    const canSeeCost = user ? hasRole(user, 'CEO', 'ADMIN', 'TRO_LY', 'Trợ Lý', 'CBO', 'KE_TOAN', 'Kế Toán') : false

    return <WarehouseClient initialWarehouses={warehouses} initialStats={stats} isAdmin={isAdmin} canSeeCost={canSeeCost} />
}
