export const revalidate = 60

import { getSuppliers } from './actions'
import { SuppliersClient } from './SuppliersClient'

export const metadata = { title: 'Nhà Cung Cấp | Wine ERP' }

export default async function SuppliersPage() {
    const data = await getSuppliers({ pageSize: 25 }).catch(() => ({ rows: [], total: 0 }))
    return <SuppliersClient initialRows={data.rows} initialTotal={data.total} />
}

