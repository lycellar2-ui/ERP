import { Suspense } from 'react'
import { getVideoGuidesPageData } from './actions'
import { GuidesClient } from './GuidesClient'

export const metadata = {
    title: 'Hướng Dẫn Sử Dụng (Video R2) | Wine ERP',
    description: 'Thư viện video hướng dẫn thao tác theo từng màn hình trên hệ thống Wine ERP, lưu trữ và phát trực tiếp từ Cloudflare R2.',
}

export default async function GuidesPage() {
    const { guides, canManage } = await getVideoGuidesPageData().catch(() => ({
        guides: [],
        canManage: false,
    }))

    return (
        <Suspense
            fallback={
                <div className="p-6 text-sm text-lys-muted">
                    Đang tải thư viện video hướng dẫn...
                </div>
            }
        >
            <GuidesClient initialGuides={guides} canManage={canManage} />
        </Suspense>
    )
}
