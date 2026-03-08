export const revalidate = 30

import { getProposals, getProposalStats } from './actions'
import { getCurrentUser } from '@/lib/session'
import ProposalsClient from './ProposalsClient'

export default async function ProposalsPage() {
    const [proposals, stats, user] = await Promise.all([
        getProposals(),
        getProposalStats(),
        getCurrentUser(),
    ])

    return (
        <ProposalsClient
            initialProposals={proposals}
            stats={stats}
            userId={user?.id ?? 'system'}
            userName={user?.name ?? 'User'}
            userRoles={user?.roles ?? ['CEO']}
        />
    )
}
