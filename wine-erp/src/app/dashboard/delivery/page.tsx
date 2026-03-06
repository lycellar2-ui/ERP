export const revalidate = 30

import { getDeliveryRoutes, getDeliveryStats } from './actions'
import { DeliveryClient } from './DeliveryClient'

export const metadata = { title: 'Vận Chuyển | Wine ERP' }

export default async function DeliveryPage() {
    const [{ rows, total }, stats] = await Promise.all([
        getDeliveryRoutes({ pageSize: 20 }),
        getDeliveryStats(),
    ])
    return <DeliveryClient initialRows={rows} initialTotal={total} stats={stats} />
}

