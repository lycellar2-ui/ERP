import { getQuotations, getQuotationStats } from './actions'
import { QuotationClient } from './QuotationClient'

export const revalidate = 60


export const metadata = { title: 'Báo Giá | Wine ERP' }

export default async function QuotationsPage() {
    const [rows, stats] = await Promise.all([getQuotations(), getQuotationStats()])
    return <QuotationClient initialRows={rows} stats={stats} />
}
