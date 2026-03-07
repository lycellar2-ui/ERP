export const revalidate = 45

import { getShipments, getShipmentStats } from '../procurement/shipment-actions'
import { ShipmentsClient } from './ShipmentsClient'

export const metadata = { title: 'Lô Hàng | Wine ERP' }

export default async function ShipmentsPage() {
    const [{ rows, total }, stats] = await Promise.all([
        getShipments().catch(() => ({ rows: [], total: 0 })),
        getShipmentStats().catch(() => ({ total: 0, booked: 0, onVessel: 0, atPort: 0, customsFiling: 0, cleared: 0, delivered: 0 })),
    ])

    return <ShipmentsClient initialRows={rows} initialTotal={total} stats={stats} />
}
