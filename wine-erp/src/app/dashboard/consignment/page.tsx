import { getConsignmentAgreements, getConsignmentStats } from './actions'
import { ConsignmentClient } from './ConsignmentClient'
import { getCurrentUser } from '@/lib/session'

export const metadata = { title: 'Ký Gửi (CSG) | Wine ERP' }

export default async function ConsignmentPage() {
    const [agreements, stats, user] = await Promise.all([
        getConsignmentAgreements(),
        getConsignmentStats(),
        getCurrentUser(),
    ])
    return (
        <ConsignmentClient
            initialRows={agreements}
            stats={stats}
            userId={user?.id || ''}
            userRoles={user?.roles || []}
        />
    )
}
