import { getOpportunities, getPipelineStats } from './actions'
import { PipelineClient } from './PipelineClient'

export const revalidate = 60


export const metadata = { title: 'Sales Pipeline | Wine ERP' }

export default async function PipelinePage() {
    const [rows, stats] = await Promise.all([getOpportunities(), getPipelineStats()])
    return <PipelineClient initialRows={rows} stats={stats} />
}
