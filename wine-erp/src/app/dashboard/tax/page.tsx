export const dynamic = 'force-dynamic'

import { getTaxRates } from './actions'
import { TaxClient } from './TaxClient'

export const metadata = { title: 'Tra Cứu Thuế | Wine ERP' }

export default async function TaxPage() {
    const { rows, total } = await getTaxRates()
    return <TaxClient initialRows={rows} initialTotal={total} />
}
