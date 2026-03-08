import { getAllocCampaigns, getAllocStats } from './actions'
import { AllocationClient } from './AllocationClient'

export const metadata = { title: 'Allocation Engine | Wine ERP' }

export default async function AllocationPage() {
    const [campaigns, stats] = await Promise.all([
        getAllocCampaigns(),
        getAllocStats(),
    ])
    return <AllocationClient initialCampaigns={campaigns} stats={stats} />
}
