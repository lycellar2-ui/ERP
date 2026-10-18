import { Suspense } from 'react'
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
        <Suspense fallback={<div className="p-6 text-sm text-gray-400">Đang tải Tờ Trình...</div>}>
            <ProposalsClient
                initialProposals={proposals}
                stats={stats}
                userId={user?.id ?? 'system'}
                userName={user?.name ?? 'User'}
                userRoles={user?.roles ?? ['CEO']}
            />
        </Suspense>
    )
}
