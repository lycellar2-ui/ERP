export const revalidate = 30

import { Suspense } from 'react'
import { getProducts } from './actions'
import { ProductsClient } from './ProductsClient'

export const metadata = { title: 'Danh M?c S?n Ph?m | Wine ERP' }

export default async function ProductsPage() {
    // Server-side initial fetch
    const { rows, total } = await getProducts({ page: 1, pageSize: 20 }).catch(() => ({
        rows: [],
        total: 0,
    }))

    return (
        <div>
            <Suspense fallback={<ProductsPageSkeleton />}>
                <ProductsClient initialRows={rows} initialTotal={total} />
            </Suspense>
        </div>
    )
}

function ProductsPageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="h-8 w-64 rounded-lg animate-pulse" style={{ background: '#1B2E3D' }} />
            <div className="grid grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-xl animate-pulse" style={{ background: '#1B2E3D' }} />
                ))}
            </div>
            <div className="h-12 rounded-xl animate-pulse" style={{ background: '#1B2E3D' }} />
            <div className="h-96 rounded-2xl animate-pulse" style={{ background: '#1B2E3D' }} />
        </div>
    )
}

