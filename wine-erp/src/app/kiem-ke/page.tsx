import type { Metadata } from 'next'
import { getShowroomCount } from './actions'
import { ShowroomCountClient } from './ShowroomCountClient'

export const metadata: Metadata = {
    title: 'Kiểm kê showroom',
    description: 'Kiểm kê nhanh rượu và POSM tại showroom LY\'s Cellars',
}

export const dynamic = 'force-dynamic'

export default async function KiemKePage() {
    const res = await getShowroomCount()
    return <ShowroomCountClient initial={res.success ? res.data ?? null : null} initialError={res.success ? null : res.error} />
}
