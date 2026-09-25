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
            minHeight: '100vh', background: 'linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
            fontFamily: '"Inter", sans-serif',
        }}>
            <div style={{
                maxWidth: '440px', width: '100%', background: '#FFFFFF',
                borderRadius: '16px', border: '1px solid #E2E8F0', overflow: 'hidden',
            }}>
                {/* Header */}
                <div style={{
                    background: data.isFirstScan
                        ? 'linear-gradient(135deg, rgba(91,168,138,0.2), rgba(135,203,185,0.1))'
                        : 'linear-gradient(135deg, rgba(212,168,83,0.2), rgba(139,26,46,0.1))',
                    padding: '24px', textAlign: 'center',
                    borderBottom: '1px solid #E2E8F0',
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '8px' }}>
                        {data.isFirstScan ? '✅' : '⚠️'}
                    </div>
                    <h1 className="font-brand" style={{ color: data.isFirstScan ? '#5BA88A' : '#D4A853', fontSize: '18px', fontWeight: 700 }}>
                        {data.isFirstScan ? 'Sản Phẩm Chính Hãng' : 'Đã Được Quét Trước Đó'}
                    </h1>
                    <p style={{ color: '#64748B', fontSize: '12px', marginTop: '4px' }}>
                        {data.isFirstScan
                            ? 'Đây là lần quét đầu tiên — Sản phẩm xác nhận chính hãng'
                            : `Sản phẩm đã được quét ${data.scanCount} lần — Lần đầu: ${new Date(data.firstScannedAt!).toLocaleDateString('vi-VN')}`}
                    </p>
                </div>

                {/* Product Info */}
                <div style={{ padding: '20px' }}>
                    <h2 className="font-brand" style={{ color: '#0F172A', fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>
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
                            <div key={item.label} style={{ padding: '8px 12px', background: '#FFFFFF', borderRadius: '8px' }}>
                                <p style={{ color: '#64748B', fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    {item.label}
                                </p>
                                <p className="font-mono" style={{ color: '#0F172A', fontSize: '13px', fontWeight: 600 }}>
                                    {item.value}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div style={{
                    padding: '16px 20px', borderTop: '1px solid #E2E8F0',
                    textAlign: 'center', background: '#FFFFFF',
                }}>
                    <p style={{ color: '#64748B', fontSize: '10px', letterSpacing: '0.5px' }}>
                        LYS CELLARS — Hệ Thống Truy Xuất Nguồn Gốc
                    </p>
                    <p style={{ color: '#E2E8F0', fontSize: 12, marginTop: '4px' }}>
                        QR: {code}
                    </p>
                </div>
            </div>
        </div>
    )
}
