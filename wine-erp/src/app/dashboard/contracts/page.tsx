import { getContracts, getContractStats } from './actions'
import { getRegulatedDocs, getRegDocStats } from './reg-doc-actions'
import { ContractsPage } from './ContractsPage'

export const metadata = { title: 'Hợp Đồng & Pháp Lý | Wine ERP' }

export default async function Page() {
    const [
        { rows: contractRows, total: contractTotal },
        contractStats,
        { rows: regDocRows, total: regDocTotal },
        regDocStats,
    ] = await Promise.all([
        getContracts({ pageSize: 20 }),
        getContractStats(),
        getRegulatedDocs({ pageSize: 20 }),
        getRegDocStats(),
    ])

    return (
        <ContractsPage
            contractRows={contractRows}
            contractTotal={contractTotal}
            contractStats={contractStats}
            regDocRows={regDocRows}
            regDocTotal={regDocTotal}
            regDocStats={regDocStats}
        />
    )
}
