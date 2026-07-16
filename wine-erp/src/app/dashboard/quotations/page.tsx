import { QuotationClient } from './QuotationClient'
import { getQuotations, getQuotationStats } from './actions'

export const metadata = { title: 'Báo Giá | Wine ERP' }

export default async function QuotationsPage() {
    // SSR initial data — hydrated into client TanStack cache
    const [rows, stats] = await Promise.all([
        getQuotations().catch(() => []),
        getQuotationStats().catch(() => ({ total: 0, draft: 0, sent: 0, accepted: 0, converted: 0, totalValue: 0 })),
    ])

    return <QuotationClient initialData={{ rows, stats }} />
}
