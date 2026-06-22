'use client'

import { useState, useEffect } from 'react'
import { 
    X, Wine, Award, Star, Loader2, Calendar, 
    Layers, Clipboard, CheckCircle2, AlertCircle,
    Boxes, Tag, DollarSign, Edit
} from 'lucide-react'
import { getProductViewDetails, type ProductViewDetails } from './actions'
import { formatVND } from '@/lib/utils'

interface ProductDetailDrawerProps {
    open: boolean
    productId: string | null
    onClose: () => void
    canEdit: boolean
    onEditTrigger: (id: string) => void
}

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
    GE: '🇬🇪', HU: '🇭🇺', GR: '🇬🇷', AT: '🇦🇹', RO: '🇷🇴', MX: '🇲🇽', JP: '🇯🇵',
}

const COUNTRY_NAMES: Record<string, string> = {
    FR: 'Pháp', IT: 'Ý', ES: 'TBN', PT: 'BĐN', DE: 'Đức',
    US: 'Mỹ', AU: 'Úc', NZ: 'NZ', AR: 'Argentina', CL: 'Chile', ZA: 'Nam Phi',
    GE: 'Georgia', HU: 'Hungary', GR: 'Hy Lạp', AT: 'Áo', RO: 'Romania', MX: 'Mexico', JP: 'Nhật',
}

const WINE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    RED: { label: 'Vang Đỏ', color: '#E05252', bg: 'rgba(224,82,82,0.15)' },
    WHITE: { label: 'Vang Trắng', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
    ROSE: { label: 'Rosé', color: '#D4607A', bg: 'rgba(212,96,122,0.15)' },
    SPARKLING: { label: 'Sâm panh', color: '#7AC4C4', bg: 'rgba(122,196,196,0.15)' },
    FORTIFIED: { label: 'Fortified', color: '#87CBB9', bg: 'rgba(168,130,204,0.15)' },
    DESSERT: { label: 'Dessert', color: '#D4963A', bg: 'rgba(212,150,58,0.12)' },
}

const LOT_STATUS: Record<string, { label: string; color: string; bg: string }> = {
    AVAILABLE: { label: 'Sẵn sàng', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    RESERVED: { label: 'Đã đặt trước', color: '#4A8FAB', bg: 'rgba(74,143,171,0.15)' },
    QUARANTINE: { label: 'Cách ly', color: '#D4A853', bg: 'rgba(212,168,83,0.15)' },
    DAMAGED: { label: 'Hư hỏng', color: '#8B1A2E', bg: 'rgba(139,26,46,0.15)' },
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    ACTIVE: { label: 'Đang kinh doanh', color: '#5BA88A', bg: 'rgba(91,168,138,0.15)' },
    DISCONTINUED: { label: 'Ngừng kinh doanh', color: '#4A6A7A', bg: 'rgba(74,106,122,0.15)' },
    ALLOCATION_ONLY: { label: 'Phân bổ (Allocation)', color: '#87CBB9', bg: 'rgba(135,203,185,0.15)' },
}

export function ProductDetailDrawer({ open, productId, onClose, canEdit, onEditTrigger }: ProductDetailDrawerProps) {
    const [data, setData] = useState<ProductViewDetails | null>(null)
    const [loading, setLoading] = useState(false)
    const [activeImage, setActiveImage] = useState<string | null>(null)

    useEffect(() => {
        if (!open || !productId) return

        setLoading(true)
        setData(null)
        setActiveImage(null)

        getProductViewDetails(productId)
            .then(details => {
                if (details) {
                    setData(details)
                    const primary = details.media.find(m => m.isPrimary)?.url ?? details.media[0]?.url ?? null
                    setActiveImage(primary)
                }
            })
            .catch(err => {
                console.error('[ProductDetailDrawer] Error fetching product view:', err)
            })
            .finally(() => {
                setLoading(false)
            })
    }, [open, productId])

    if (!open) return null

    const flag = data ? COUNTRY_FLAGS[data.country] ?? '🌍' : '🌍'
    const countryName = data ? COUNTRY_NAMES[data.country] ?? data.country : ''
    const wineTypeBadge = data ? WINE_TYPE_CONFIG[data.wineType] : null
    const statusBadge = data ? STATUS_CONFIG[data.status] : null
    const totalStockQty = data ? data.stockLots.reduce((sum, l) => sum + l.qtyAvailable, 0) : 0

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 z-40 transition-opacity duration-300"
                style={{ background: 'rgba(10,5,2,0.7)', opacity: open ? 1 : 0 }}
                onClick={onClose}
            />

            {/* Slide-in Panel */}
            <div
                className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden transition-transform duration-300"
                style={{
                    width: 'min(640px, 95vw)',
                    background: '#0D1E2B',
                    borderLeft: '1px solid #2A4355',
                    transform: open ? 'translateX(0)' : 'translateX(100%)',
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                    style={{ borderBottom: '1px solid #2A4355' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(135,203,185,0.15)' }}>
                            <Wine size={16} style={{ color: '#87CBB9' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                                Chi Tiết Sản Phẩm
                            </h3>
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Xem thông tin chi tiết và tồn kho sản phẩm</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: '#4A6A7A' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#1B2E3D')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body (scrollable) */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 relative">
                    {loading && (
                        <div className="absolute inset-0 bg-[#0D1E2B]/80 flex flex-col items-center justify-center gap-3 z-30">
                            <Loader2 size={32} className="animate-spin text-[#87CBB9]" />
                            <p className="text-xs" style={{ color: '#4A6A7A' }}>Đang tải chi tiết...</p>
                        </div>
                    )}

                    {data && (
                        <>
                            {/* Visual Showcase: Image & Title */}
                            <div className="flex flex-col md:flex-row gap-5 items-start bg-[#142433]/40 p-4 rounded-xl border border-[#2A4355]/30">
                                {/* Image view */}
                                <div className="w-full md:w-36 h-48 rounded-lg flex-shrink-0 flex flex-col items-center justify-center relative bg-[#142433] border border-[#2A4355]/60 overflow-hidden">
                                    {activeImage ? (
                                        <img src={activeImage} alt={data.productName} className="h-full object-contain p-2" />
                                    ) : (
                                        <Wine size={48} style={{ color: '#2A4355' }} />
                                    )}
                                </div>

                                <div className="flex-1 space-y-2 min-w-0">
                                    <h2 className="text-xl font-bold leading-snug" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                                        {data.productName}
                                    </h2>
                                    <p className="text-xs font-mono" style={{ color: '#87CBB9' }}>{data.skuCode}</p>
                                    
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {wineTypeBadge && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ color: wineTypeBadge.color, background: wineTypeBadge.bg }}>
                                                {wineTypeBadge.label}
                                            </span>
                                        )}
                                        {statusBadge && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ color: statusBadge.color, background: statusBadge.bg }}>
                                                {statusBadge.label}
                                            </span>
                                        )}
                                        {data.isAllocationEligible && (
                                            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ color: '#87CBB9', background: 'rgba(135,203,185,0.1)' }}>
                                                Allocation
                                            </span>
                                        )}
                                    </div>

                                    {/* Quick stock/producer summary */}
                                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#2A4355]/20 text-xs">
                                        <div>
                                            <span style={{ color: '#4A6A7A' }}>Nhà sản xuất: </span>
                                            <span className="font-semibold block" style={{ color: '#8AAEBB' }}>{data.producerName}</span>
                                        </div>
                                        <div>
                                            <span style={{ color: '#4A6A7A' }}>Tổng tồn kho: </span>
                                            <span className="font-bold text-sm block" style={{ color: totalStockQty > 0 ? '#5BA88A' : '#E05252' }}>
                                                {totalStockQty.toLocaleString()} chai
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Basic specs */}
                            <div className="space-y-3">
                                <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#87CBB9' }}>
                                    <Layers size={13} /> Thông Số Kỹ Thuật
                                </h4>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 rounded-xl text-xs" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                    {[
                                        { label: 'Xuất xứ', value: `${flag} ${countryName}` },
                                        { label: 'Vùng trồng (Appellation)', value: data.appellationName ?? '—' },
                                        { label: 'Niên vụ (Vintage)', value: data.vintage ?? 'Không niên vụ (NV)' },
                                        { label: 'Độ cồn (ABV)', value: data.abvPercent ? `${data.abvPercent}°` : '—' },
                                        { label: 'Dung tích', value: `${data.volumeMl} ml` },
                                        { label: 'Quy cách đóng chai', value: data.format },
                                        { label: 'Loại thùng đóng gói', value: data.packagingType === 'OWC' ? 'OWC (Thùng Gỗ)' : 'Carton' },
                                        { label: 'Số chai mỗi thùng', value: `${data.unitsPerCase} chai` },
                                        { label: 'Mã HS Code', value: data.hsCode },
                                        { label: 'Mã vạch EAN', value: data.barcodeEan ?? '—' },
                                        { label: 'Phân hạng rượu', value: data.classification ?? '—' },
                                    ].map((spec, i) => (
                                        <div key={i} className="flex justify-between py-1.5 border-b border-[#2A4355]/20 last:border-b-0">
                                            <span style={{ color: '#4A6A7A' }}>{spec.label}</span>
                                            <span className="font-semibold text-right" style={{ color: '#E8F1F2' }}>{spec.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Section: Price Lists */}
                            <div className="space-y-3">
                                <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#87CBB9' }}>
                                    <DollarSign size={13} /> Giá Bán Theo Kênh (VND)
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="p-3.5 rounded-xl flex flex-col justify-between" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                        <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#4A6A7A' }}>Giá Bán Lẻ Niêm Yết</span>
                                        <span className="text-lg font-bold mt-1 font-mono" style={{ color: '#87CBB9' }}>
                                            {data.retailPrice ? formatVND(data.retailPrice) : 'Chưa thiết lập'}
                                        </span>
                                    </div>
                                    <div className="p-3.5 rounded-xl flex flex-col justify-between" style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                                        <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#4A6A7A' }}>Giá Bán Buôn (Wholesale)</span>
                                        <span className="text-lg font-bold mt-1 font-mono" style={{ color: '#87CBB9' }}>
                                            {data.wholesalePrice ? formatVND(data.wholesalePrice) : 'Chưa thiết lập'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Section: Tasting Notes */}
                            {data.tastingNotes && (
                                <div className="space-y-3">
                                    <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#87CBB9' }}>
                                        <Tag size={13} /> Ghi Chú Nếm Rượu (Tasting Notes)
                                    </h4>
                                    <div className="p-4 rounded-xl text-xs leading-relaxed italic whitespace-pre-wrap" style={{ background: '#142433', border: '1px solid #2A4355', color: '#8AAEBB' }}>
                                        "{data.tastingNotes}"
                                    </div>
                                </div>
                            )}

                            {/* Section: Awards */}
                            {data.awards.length > 0 && (
                                <div className="space-y-3">
                                    <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#87CBB9' }}>
                                        <Award size={13} /> Giải Thưởng & Điểm Số
                                    </h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        {data.awards.map(a => (
                                            <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg text-xs" style={{ background: '#142433', border: '1px solid #2A4355' }}>
                                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,168,83,0.1)' }}>
                                                    <Award size={16} style={{ color: '#D4A853' }} />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold truncate" style={{ color: '#E8F1F2' }}>
                                                        {a.source}
                                                        {a.score && <span className="ml-1.5 text-xs text-[#87CBB9] font-mono">{a.score}pt</span>}
                                                    </p>
                                                    <p className="text-[10px] mt-0.5" style={{ color: '#4A6A7A' }}>
                                                        {a.medalLabel ?? ''} {a.vintage ? `(Vintage: ${a.vintage})` : ''}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Section: Warehouse Stock Breakdown */}
                            <div className="space-y-3">
                                <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#87CBB9' }}>
                                    <Boxes size={13} /> Chi Tiết Tồn Kho Vật Lý
                                </h4>
                                
                                {data.stockLots.length === 0 ? (
                                    <div className="flex flex-col items-center py-8 gap-2 rounded-xl text-center" style={{ border: '1px dashed #2A4355', background: '#142433/30' }}>
                                        <AlertCircle size={24} style={{ color: '#2A4355' }} />
                                        <p className="text-xs" style={{ color: '#4A6A7A' }}>Không có hàng tồn kho khả dụng cho sản phẩm này.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
                                        <div style={{ maxHeight: '250px', overflowY: 'auto' }}>
                                            <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355', position: 'sticky', top: 0, zIndex: 10 }}>
                                                        {['Kho', 'Vị Trí', 'Mã Lô', 'Trạng Thái', 'Tồn Kho'].map((h, idx) => (
                                                            <th key={idx} className="px-3 py-2 uppercase font-semibold text-[10px]" style={{ color: '#4A6A7A' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.stockLots.map(lot => {
                                                        const statusCfg = LOT_STATUS[lot.status] ?? { label: lot.status, color: '#8AAEBB', bg: 'rgba(168,152,128,0.1)' }
                                                        return (
                                                            <tr key={lot.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.3)' }}>
                                                                <td className="px-3 py-2 font-medium" style={{ color: '#E8F1F2' }}>{lot.warehouseName}</td>
                                                                <td className="px-3 py-2 font-mono font-bold" style={{ color: '#8AAEBB' }}>{lot.locationCode}</td>
                                                                <td className="px-3 py-2 font-mono" style={{ color: '#4A6A7A' }}>{lot.lotNo}</td>
                                                                <td className="px-3 py-2">
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold inline-block" style={{ color: statusCfg.color, background: statusCfg.bg }}>
                                                                        {statusCfg.label}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: '#87CBB9' }}>
                                                                    {lot.qtyAvailable.toLocaleString()}
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Actions */}
                {data && canEdit && (
                    <div className="px-6 py-4 flex-shrink-0 flex justify-end gap-3" style={{ borderTop: '1px solid #2A4355', background: '#142433' }}>
                        <button
                            onClick={() => {
                                onClose()
                                onEditTrigger(data.id)
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                            style={{ background: '#87CBB9', color: '#0A1926' }}
                            onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                            onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}
                        >
                            <Edit size={14} /> Chỉnh Sửa Thông Tin
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}
