import { verifyQRCode } from '@/app/dashboard/qr-codes/actions'
import { notFound } from 'next/navigation'

export default async function VerifyPage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params
    const result = await verifyQRCode(code)

    if (!result.valid) return notFound()

    const data = result as any
    const product = data.product!
    const lot = data.lot!

    return (
        <div style={{
            minHeight: '100vh', background: 'linear-gradient(135deg, #0A1926 0%, #1B2E3D 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            fontFamily: '"Inter", sans-serif',
        }}>
            <div style={{
                maxWidth: '440px', width: '100%', background: '#1B2E3D',
                borderRadius: '16px', border: '1px solid #2A4355', overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    background: data.isFirstScan
                        ? 'linear-gradient(135deg, rgba(91,168,138,0.2), rgba(135,203,185,0.1))'
                        : 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(139,26,46,0.1))',
                    padding: '24px', textAlign: 'center',
                    borderBottom: '1px solid #2A4355',
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                        {data.isFirstScan ? '✅' : '⚠️'}
                    </div>
                    <h1 style={{
                        color: data.isFirstScan ? '#5BA88A' : '#D4A853',
                        fontSize: '18px', fontWeight: 700,
                        fontFamily: '"Cormorant Garamond", Georgia, serif',
                    }}>
                        {data.isFirstScan ? 'Sản Phẩm Chính Hãng' : 'Đã Được Quét Trước Đó'}
                    </h1>
                    <p style={{ color: '#4A6A7A', fontSize: '12px', marginTop: '4px' }}>
                        {data.isFirstScan
                            ? 'Đây là lần quét đầu tiên — Sản phẩm xác nhận chính hãng'
                            : `Sản phẩm đã được quét ${data.scanCount} lần — Lần đầu: ${new Date(data.firstScannedAt!).toLocaleDateString('vi-VN')}`}
                    </p>
                </div>

                {/* Product Info */}
                <div style={{ padding: '20px' }}>
                    <h2 style={{
                        color: '#E8F1F2', fontSize: '20px', fontWeight: 700,
                        fontFamily: '"Cormorant Garamond", Georgia, serif',
                        marginBottom: '16px',
                    }}>
                        {product.name}
                    </h2>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        {[
                            { label: 'Mã SKU', value: product.sku },
                            { label: 'Vintage', value: product.vintage },
                            { label: 'Xuất xứ', value: product.country },
                            { label: 'Loại rượu', value: product.wineType },
                            { label: 'Mã Lô', value: lot.lotNo },
                            { label: 'Lô nhập', value: lot.shipmentNo },
                            { label: 'Ngày nhập', value: lot.importDate },
                            { label: 'Kho', value: lot.warehouse },
                        ].map(item => (
                            <div key={item.label} style={{ padding: '8px 12px', background: '#142433', borderRadius: '8px' }}>
                                <p style={{ color: '#4A6A7A', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {item.label}
                                </p>
                                <p style={{ color: '#E8F1F2', fontSize: '13px', fontWeight: 600, fontFamily: '"DM Mono", monospace' }}>
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 20px', borderTop: '1px solid #2A4355',
                    textAlign: 'center', background: '#142433',
                }}>
                    <p style={{ color: '#4A6A7A', fontSize: '10px', letterSpacing: '0.5px' }}>
                        LYS CELLARS — Hệ Thống Truy Xuất Nguồn Gốc
                    </p>
                    <p style={{ color: '#2A4355', fontSize: '9px', marginTop: '4px', fontFamily: '"DM Mono"' }}>
                        QR: {code}
                    </p>
                </div>
            </div>
        </div>
    )
}
