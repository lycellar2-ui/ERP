import type { Metadata } from 'next'
import { getAllMedia, getMediaStats } from './actions'
import { MediaClient } from './MediaClient'

export const metadata: Metadata = {
    title: 'Thư Viện Ảnh | Wine ERP',
}

export default async function MediaPage() {
    const [{ items, total }, stats] = await Promise.all([
        getAllMedia({ page: 1, pageSize: 24 }),
        getMediaStats(),
    ])

    return <MediaClient initialItems={items} initialTotal={total} stats={stats} />
}
