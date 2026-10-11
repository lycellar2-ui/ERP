import { Suspense } from 'react'
import { SopCatalogClient } from './SopCatalogClient'
import SopLoading from './loading'
import { getSopsAction, getOfficialFormsAction } from './actions'

export const metadata = {
    title: 'Quy Trình Chuẩn & Biểu Mẫu (SOP) | Wine ERP',
    description: 'Trung tâm tổng hợp quy trình vận hành chuẩn doanh nghiệp (SOP Knowledge Hub) và thư viện biểu mẫu chính thức.',
}

export default async function SopPage() {
    const [sops, forms] = await Promise.all([
        getSopsAction().catch(() => []),
        getOfficialFormsAction().catch(() => [])
    ])

    return (
        <Suspense fallback={<SopLoading />}>
            <SopCatalogClient initialSops={sops} initialForms={forms} />
        </Suspense>
    )
}
