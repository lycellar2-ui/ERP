import { Suspense } from 'react'
import { getProducts, getProductStats, getProductCountries, getProductVintages, getProducers } from './actions'
import { ProductsClient } from './ProductsClient'
import { AICatalogAnalysis } from './AICatalogAnalysis'
import { getCurrentUser, hasPermission } from '@/lib/session'

export const metadata = { title: 'Danh Mục Sản Phẩm | Wine ERP' }

export default async function ProductsPage() {
    // Server-side: fetch paginated rows + aggregated stats + filter options in parallel
    const [user, { rows, total }, stats, countries, vintages, producers] = await Promise.all([
        getCurrentUser().catch(() => null),
        getProducts({ page: 1, pageSize: 20 }).catch(() => ({
            rows: [] as any[],
            total: 0,
        })),
        getProductStats().catch(() => ({
            total: 0, active: 0, outOfStock: 0, topTypes: [] as any[],
        })),
        getProductCountries().catch(() => []),
        getProductVintages().catch(() => []),
        getProducers().catch(() => []),
    ])

    const canEdit = user ? hasPermission(user, 'MDM', 'WRITE') : false

    return (
        <div>
            {/* <AICatalogAnalysis /> */}
            <Suspense fallback={<ProductsPageSkeleton />}>
                <ProductsClient
                    initialRows={rows}
                    initialTotal={total}
                    stats={stats}
                    countries={countries}
                    vintages={vintages}
                    producers={producers}
                    canEdit={canEdit}
                />
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
