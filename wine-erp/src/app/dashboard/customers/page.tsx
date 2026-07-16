import { CustomersClient } from './CustomersClient'
import { getCustomers, getCustomerStats, getCustomerChannels, getSalesRepList } from './actions'

export const metadata = { title: 'Khách Hàng | Wine ERP' }

export default async function CustomersPage() {
    const [data, stats, channels, salesReps] = await Promise.all([
        getCustomers({ pageSize: 25 }).catch(() => ({ rows: [] as any[], total: 0 })),
        getCustomerStats().catch(() => ({
            total: 0, active: 0, withCredit: 0, totalCreditLimit: 0, topTypes: [] as any[],
        })),
        getCustomerChannels().catch(() => []),
        getSalesRepList().catch(() => []),
    ])

    return (
        <CustomersClient
            initialData={{ rows: data.rows, total: data.total, stats, channels, salesReps }}
        />
    )
}
