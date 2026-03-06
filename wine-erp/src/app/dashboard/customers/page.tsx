export const revalidate = 60

import { getCustomers } from './actions'
import { CustomersClient } from './CustomersClient'

export const metadata = { title: 'Khách Hàng | Wine ERP' }

export default async function CustomersPage() {
    const data = await getCustomers({ pageSize: 25 }).catch(() => ({ rows: [], total: 0 }))
    return <CustomersClient initialRows={data.rows} initialTotal={data.total} />
}

