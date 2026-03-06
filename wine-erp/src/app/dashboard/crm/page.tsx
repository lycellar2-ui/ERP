export const dynamic = 'force-dynamic'

import { getCRMCustomers, getCRMStats } from './actions'
import { CRMClient } from './CRMClient'

export const metadata = {
    title: 'CRM – Quan Hệ Khách Hàng | Wine ERP',
}

export default async function CRMPage() {
    const [{ rows, total }, stats] = await Promise.all([
        getCRMCustomers({ page: 1, pageSize: 30 }),
        getCRMStats(),
    ])

    return <CRMClient initialRows={rows} initialTotal={total} stats={stats} />
}

