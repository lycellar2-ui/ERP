import { getOpportunities, getPipelineStats } from './actions'
import { PipelineClient } from './PipelineClient'
import { AIPipelineAnalysis } from './AIPipelineAnalysis'

export const metadata = { title: 'Sales Pipeline | Wine ERP' }

export default async function PipelinePage() {
    const [rows, stats] = await Promise.all([getOpportunities(), getPipelineStats()])
    return (
        <div className="space-y-4">
            <AIPipelineAnalysis />
            <PipelineClient initialRows={rows} stats={stats} />
        </div>
    )
}
