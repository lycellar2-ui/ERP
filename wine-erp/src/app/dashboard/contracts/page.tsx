export const revalidate = 60

import { getContracts, getContractStats } from './actions'
import { ContractsClient } from './ContractsClient'

export const metadata = { title: 'Hợp Đồng | Wine ERP' }

export default async function ContractsPage() {
    const [{ rows, total }, stats] = await Promise.all([
        getContracts({ pageSize: 20 }),
        getContractStats(),
    ])
    return <ContractsClient initialRows={rows} initialTotal={total} stats={stats} />
}

