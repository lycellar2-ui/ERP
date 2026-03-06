import { QRCodeClient } from './QRCodeClient'
import { getQRCodes, getQRStats } from './actions'

export const revalidate = 30


export default async function QRCodePage() {
    let data = { rows: [] as any[], total: 0 }
    let stats = { total: 0, scanned: 0, unscanned: 0 }
    try {
        const [d, s] = await Promise.all([getQRCodes(), getQRStats()])
        data = d
        stats = s
    } catch (e) {
        console.error('QR page error:', e)
    }
    return <QRCodeClient initialData={data} stats={stats} />
}
