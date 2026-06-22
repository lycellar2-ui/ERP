import { getQuotations, getQuotationStats } from './actions'
import { QuotationClient } from './QuotationClient'

export const metadata = { title: 'Báo Giá | Wine ERP' }

export default async function QuotationsPage() {
    let rows: any[] = []
    let stats = { total: 0, draft: 0, sent: 0, accepted: 0, converted: 0, totalValue: 0 }

    try {
        const [fetchedRows, fetchedStats] = await Promise.all([getQuotations(), getQuotationStats()])
        rows = fetchedRows
        stats = fetchedStats
    } catch (err: any) {
        console.error('QuotationsPage SSR error:', err)
    }

    return <QuotationClient initialRows={rows} stats={stats} />
}
