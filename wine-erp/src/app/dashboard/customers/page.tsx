export const revalidate = 60

import { getCustomers, getCustomerStats } from './actions'
import { CustomersClient } from './CustomersClient'

export const metadata = { title: 'Khách Hàng | Wine ERP' }

export default async function CustomersPage() {
    const [data, stats] = await Promise.all([
        getCustomers({ pageSize: 25 }).catch(() => ({ rows: [] as any[], total: 0 })),
        getCustomerStats().catch(() => ({
            total: 0, active: 0, withCredit: 0, totalCreditLimit: 0, topTypes: [] as any[],
        })),
    ])
    return <CustomersClient initialRows={data.rows} initialTotal={data.total} stats={stats} />
}
