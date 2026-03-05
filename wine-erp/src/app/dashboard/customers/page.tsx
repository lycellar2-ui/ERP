export const dynamic = 'force-dynamic'

import { getCustomers } from './actions'
import { CustomersClient } from './CustomersClient'

export const metadata = { title: 'Khách Hàng | Wine ERP' }

export default async function CustomersPage() {
    const rows = await getCustomers().catch(() => [])
    return <CustomersClient initialRows={rows} />
}

