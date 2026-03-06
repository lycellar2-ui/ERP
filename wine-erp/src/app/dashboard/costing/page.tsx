export const revalidate = 30

import { getCostingProducts } from './actions'
import { CostingClient } from './CostingClient'

export const metadata = { title: 'Tính Giá Vốn | Wine ERP' }

export default async function CostingPage() {
    const products = await getCostingProducts()
    return <CostingClient products={products} />
}
