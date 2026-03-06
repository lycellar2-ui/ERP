export const dynamic = 'force-dynamic'

import { getKpiSummary } from './actions'
import { KpiClient } from './KpiClient'

export const metadata = { title: 'KPI Chỉ Tiêu | Wine ERP' }

export default async function KpiPage() {
    const year = new Date().getFullYear()
    const month = new Date().getMonth() + 1
    const summaries = await getKpiSummary()
    return <KpiClient summaries={summaries} year={year} month={month} />
}

