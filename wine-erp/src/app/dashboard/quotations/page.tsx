import { getQuotations, getQuotationStats } from './actions'
import { QuotationClient } from './QuotationClient'

export const metadata = { title: 'Báo Giá | Wine ERP' }

export default async function QuotationsPage() {
    try {
        const [rows, stats] = await Promise.all([getQuotations(), getQuotationStats()])
        return <QuotationClient initialRows={rows} stats={stats} />
    } catch (err: any) {
        console.error('QuotationsPage SSR error:', err)
        // Fallback: render with empty data so page doesn't crash
        return (
            <QuotationClient
                initialRows={[]}
                stats={{ total: 0, draft: 0, sent: 0, accepted: 0, converted: 0, totalValue: 0 }}
            />
        )
    }
}
