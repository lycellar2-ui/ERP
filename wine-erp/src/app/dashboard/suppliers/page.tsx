export const dynamic = 'force-dynamic'

import { getSuppliers } from './actions'
import { SuppliersClient } from './SuppliersClient'

export const metadata = { title: 'Nhà Cung Cấp | Wine ERP' }

export default async function SuppliersPage() {
    const rows = await getSuppliers().catch(() => [])
    return <SuppliersClient initialRows={rows} />
}

