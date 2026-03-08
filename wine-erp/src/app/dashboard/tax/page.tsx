import { getTaxRates } from './actions'
import { TaxClient } from './TaxClient'

export const metadata = { title: 'Tra C?u Thu? | Wine ERP' }

export default async function TaxPage() {
    const { rows, total } = await getTaxRates()
    return <TaxClient initialRows={rows} initialTotal={total} />
}
