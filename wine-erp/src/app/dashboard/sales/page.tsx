import { SalesClient } from './SalesClient'
import { getCurrentUser } from '@/lib/session'

export const metadata = {
    title: 'Đơn Bán Hàng | Wine ERP',
    description: "Quản lý Sales Orders – LY's Cellars",
}

export default async function SalesPage() {
    const user = await getCurrentUser()
    return (
        <SalesClient
            userId={user?.id ?? ''}
            userRoles={user?.roles ?? []}
        />
    )
}
