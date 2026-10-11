import {
    getStampPurchases,
    getStampSummary,
    getStampLinkingOptions,
    getStampLogbook,
    getReceivedPOsForStamps,
    getPOStampAllocations,
} from './actions'
import StampsClient from './StampsClient'

export const metadata = {
    title: 'Quản Lý Tem Rượu | Wine ERP',
    description: 'Quản lý phôi tem, dải số seri, sổ theo dõi tem điện tử và phân bổ tem rượu theo đơn hàng PO',
}

export default async function StampsPage() {
    const [purchases, summary, linkingOptions, initialLogbook, initialPOs, initialPOAllocations] = await Promise.all([
        getStampPurchases(),
        getStampSummary(),
        getStampLinkingOptions(),
        getStampLogbook(),
        getReceivedPOsForStamps(),
        getPOStampAllocations(),
    ])

    return (
        <StampsClient
            purchases={purchases}
            summary={summary}
            linkingOptions={linkingOptions}
            initialLogbook={initialLogbook}
            initialPOs={initialPOs}
            initialPOAllocations={initialPOAllocations}
        />
    )
}

