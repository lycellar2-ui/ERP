import { QuotationClient } from './QuotationClient'
import { getQuotations, getQuotationStats } from './actions'
import { getCurrentUser } from '@/lib/session'

export const metadata = { title: 'Báo Giá | Wine ERP' }

export default async function QuotationsPage() {
    // SSR initial data — hydrated into client TanStack cache
    const [rows, stats, user] = await Promise.all([
        getQuotations().catch(() => []),
        getQuotationStats().catch(() => ({ total: 0, draft: 0, sent: 0, accepted: 0, converted: 0, totalValue: 0 })),
        getCurrentUser().catch(() => null),
    ])

    return <QuotationClient initialData={{ rows, stats }} userRoles={user?.roles ?? []} />
}
