export const dynamic = 'force-dynamic'

import { getARInvoices, getAPInvoices, getFinanceStats, getARAgingBuckets } from './actions'
import { FinanceClient } from './FinanceClient'
import { getCurrentUser } from '@/lib/session'

export const metadata = {
    title: 'Tài Chính | Wine ERP',
}

export default async function FinancePage() {
    const [ar, ap, stats, aging, user] = await Promise.all([
        getARInvoices({ pageSize: 25 }),
        getAPInvoices({ pageSize: 25 }),
        getFinanceStats(),
        getARAgingBuckets(),
        getCurrentUser(),
    ])

    return (
        <FinanceClient
            initialAR={ar.rows}
            initialAP={ap.rows}
            stats={stats}
            agingBuckets={aging}
            userId={user?.id ?? ''}
        />
    )
}
