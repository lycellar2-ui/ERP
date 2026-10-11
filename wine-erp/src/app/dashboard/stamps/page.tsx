import { getStampPurchases, getStampSummary, getStampLinkingOptions, getStampLogbook } from './actions'
import StampsClient from './StampsClient'

export const metadata = {
    title: 'Quản Lý Tem Rượu | Wine ERP',
    description: 'Quản lý phôi tem, sổ theo dõi tem và phân bổ tem rượu nhập khẩu',
}

export default async function StampsPage() {
    const [purchases, summary, linkingOptions, initialLogbook] = await Promise.all([
        getStampPurchases(),
        getStampSummary(),
        getStampLinkingOptions(),
        getStampLogbook(),
    ])

    return (
        <StampsClient
            purchases={purchases}
            summary={summary}
            linkingOptions={linkingOptions}
            initialLogbook={initialLogbook}
        />
    )
}

