import { Suspense } from 'react'
import { getProductsPageData } from './actions'
import { ProductsClient } from './ProductsClient'
import { AICatalogAnalysis } from './AICatalogAnalysis'

export const metadata = { title: 'Danh Mục Sản Phẩm | Wine ERP' }

export default async function ProductsPage() {
    // Fetch consolidated page data in a single unified action
    const data = await getProductsPageData({ page: 1, pageSize: 20 })

    return (
        <div>
            {/* <AICatalogAnalysis /> */}
            <Suspense fallback={<ProductsPageSkeleton />}>
                <ProductsClient
                    initialRows={data.rows}
                    initialTotal={data.total}
                    initialStats={data.stats}
                    initialCountries={data.countries}
                    initialProducers={data.producers}
                    canEdit={data.canEdit}
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
