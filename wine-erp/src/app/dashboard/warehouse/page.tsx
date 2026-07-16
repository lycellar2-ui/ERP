import { WarehouseClient } from './WarehouseClient'
import { getCurrentUser, hasRole } from '@/lib/session'

export const metadata = { title: 'Kho Hàng (WMS) | Wine ERP' }

export default async function WarehousePage() {
    const user = await getCurrentUser()
    const isAdmin = user ? hasRole(user, 'CEO', 'THU_KHO') : false
    return <WarehouseClient isAdmin={isAdmin} />
}
