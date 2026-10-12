import { Suspense } from 'react'
import { SopCatalogClient } from './SopCatalogClient'
import SopLoading from './loading'
import { getSopsAction, getOfficialFormsAction, getMarkdownDocsAction } from './actions'

export const metadata = {
    title: 'Quy Trình Vận Hành Tiêu Chuẩn (SOP) | Wine ERP',
    description: 'Hệ thống hóa quy trình nghiệp vụ tiêu chuẩn, sổ tay vận hành và biểu mẫu chứng từ hành chính Wine ERP.',
}

export default async function SopPage() {
    const [sops, forms, markdownDocs] = await Promise.all([
        getSopsAction().catch(() => []),
        getOfficialFormsAction().catch(() => []),
        getMarkdownDocsAction().catch(() => [])
    ])

    return (
        <Suspense fallback={<SopLoading />}>
            <SopCatalogClient
                initialSops={sops}
                initialForms={forms}
                initialMarkdownDocs={markdownDocs}
            />
        </Suspense>
    )
}
