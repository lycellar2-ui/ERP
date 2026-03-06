export const revalidate = 30

import { AgencyClient } from './AgencyClient'

export const metadata = { title: 'Agency Portal | Wine ERP' }

export default function AgencyPage() {
    return <AgencyClient />
}
