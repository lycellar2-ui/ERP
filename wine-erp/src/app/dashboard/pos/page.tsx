import POSClient from './POSClient'

export const revalidate = 30


export const metadata = { title: 'POS — Bán Hàng Tại Quầy' }

export default function POSPage() {
    return <POSClient />
}
