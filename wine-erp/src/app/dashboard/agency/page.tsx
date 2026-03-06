export const revalidate = 90

import { AgencyClient } from './AgencyClient'

export const metadata = { title: 'Agency Portal | Wine ERP' }

export default function AgencyPage() {
    return <AgencyClient />
}
