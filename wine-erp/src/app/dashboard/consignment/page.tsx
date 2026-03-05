export const dynamic = 'force-dynamic'

import { getConsignmentAgreements, getConsignmentStats } from './actions'
import { ConsignmentClient } from './ConsignmentClient'

export const metadata = { title: 'Ký Gửi (CSG) | Wine ERP' }

export default async function ConsignmentPage() {
    const [agreements, stats] = await Promise.all([
        getConsignmentAgreements(),
        getConsignmentStats(),
    ])
    return <ConsignmentClient initialRows={agreements} stats={stats} />
}
