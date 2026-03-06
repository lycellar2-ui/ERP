import { getStampPurchases, getStampSummary } from './actions'
import StampsClient from './StampsClient'

export const revalidate = 90


export const metadata = {
    title: 'Quản Lý Tem Rượu | Wine ERP',
    description: 'Quản lý phôi tem rượu nhập khẩu do Bộ Tài Chính cấp phát',
}

export default async function StampsPage() {
    const [purchases, summary] = await Promise.all([
        getStampPurchases(),
        getStampSummary(),
    ])

    return <StampsClient purchases={purchases} summary={summary} />
}
