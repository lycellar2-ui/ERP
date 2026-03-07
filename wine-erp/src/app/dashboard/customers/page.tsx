import { Suspense } from 'react'
import { getCustomers, getCustomerStats, getCustomerChannels, getSalesRepList } from './actions'
import { CustomersClient } from './CustomersClient'

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
        <Suspense fallback={<CustomersPageSkeleton />}>
            <CustomersClient
                initialRows={data.rows}
                initialTotal={data.total}
                stats={stats}
                channels={channels}
                salesReps={salesReps}
            />
        </Suspense>
    )
}

function CustomersPageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="h-8 w-64 rounded-lg animate-pulse" style={{ background: '#1B2E3D' }} />
            <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#1B2E3D' }} />
                ))}
            </div>
            <div className="h-12 rounded-xl animate-pulse" style={{ background: '#1B2E3D' }} />
            <div className="h-96 rounded-2xl animate-pulse" style={{ background: '#1B2E3D' }} />
        </div>
    )
}
