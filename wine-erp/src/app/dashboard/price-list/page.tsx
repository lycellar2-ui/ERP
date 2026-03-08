import { getPriceLists } from './actions'
import { PriceListClient } from './PriceListClient'

export const metadata = {
    title: 'Bảng Giá | Wine ERP',
}

export default async function PriceListPage() {
    const lists = await getPriceLists()

    return (
        <div className="space-y-6">
            <PriceListClient initialLists={lists} />
        </div>
    )
}
