import { getPriceLists } from './actions'
import { PriceListClient } from './PriceListClient'
import { getCurrentUser } from '@/lib/session'

export const metadata = {
    title: 'Bảng Giá | Wine ERP',
}

export default async function PriceListPage() {
    const [lists, user] = await Promise.all([
        getPriceLists(),
        getCurrentUser()
    ])

    return (
        <div className="space-y-6">
            <PriceListClient initialLists={lists} currentUser={user} />
        </div>
    )
}
