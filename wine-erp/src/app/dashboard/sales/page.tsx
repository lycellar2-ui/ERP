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

    // Server-side initial data — hydrated into TanStack Query on client
    const data = await getSalesPageData({ page: 1, pageSize: 20 })

    return (
        <SalesClient
            initialData={data}
            userId={user?.id ?? ''}
            userRoles={userRoles}
        />
    )
}
