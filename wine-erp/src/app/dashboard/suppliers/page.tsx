export const revalidate = 60

import { getSuppliers, getSupplierStats } from './actions'
import { SuppliersClient } from './SuppliersClient'

export const metadata = { title: 'Nhà Cung Cấp | Wine ERP' }

export default async function SuppliersPage() {
    const [data, stats] = await Promise.all([
        getSuppliers({ pageSize: 25 }).catch(() => ({ rows: [] as any[], total: 0 })),
        getSupplierStats().catch(() => ({
            total: 0, active: 0, countries: 0, avgLeadTime: 45, topTypes: [] as any[],
        })),
    ])
    return <SuppliersClient initialRows={data.rows} initialTotal={data.total} stats={stats} />
}
