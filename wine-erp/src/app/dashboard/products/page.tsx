import { ProductsClient } from './ProductsClient'
import { getCurrentUser } from '@/lib/session'

export const metadata = { title: 'Danh Mục Sản Phẩm | Wine ERP' }

export default async function ProductsPage() {
    const user = await getCurrentUser()
    const canEdit = user?.roles?.some(r =>
        ['CEO', 'Sales Manager', 'SALES_MGR', 'Sales Admin', 'SALES_ADMIN'].includes(r)
    ) ?? false

    return <ProductsClient canEdit={canEdit} />
}
