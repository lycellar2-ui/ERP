'use client'

import { useState, useEffect } from 'react'
import { 
    X, Wine, Award, Star, Loader2, Calendar, 
    Layers, Clipboard, CheckCircle2, AlertCircle,
    Boxes, Tag, DollarSign, Edit
} from 'lucide-react'
import { getProductViewDetails, type ProductViewDetails, type ProductRow } from './actions'
import { formatVND } from '@/lib/utils'

interface ProductDetailDrawerProps {
    open: boolean
    productId: string | null
    initialData?: ProductRow | null
    cachedData?: Promise<ProductViewDetails | null> | ProductViewDetails | null
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
    RED: { label: 'Vang đỏ', color: '#E05252', bg: 'rgba(224,82,82,0.15)' },
    WHITE: { label: 'Vang trắng', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
    ROSE: { label: 'Vang hồng', color: '#D4607A', bg: 'rgba(212,96,122,0.15)' },
    SPARKLING: { label: 'Vang nổ', color: '#7AC4C4', bg: 'rgba(122,196,196,0.15)' },
    FORTIFIED: { label: 'Fortified', color: '#0891B2', bg: 'rgba(168,130,204,0.15)' },
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
    DISCONTINUED: { label: 'Ngừng kinh doanh', color: '#64748B', bg: 'rgba(74,106,122,0.15)' },
    ALLOCATION_ONLY: { label: 'Phân bổ (Allocation)', color: '#0891B2', bg: 'rgba(8, 145, 178, 0.08)' },
}

export function ProductDetailDrawer({ open, productId, initialData, cachedData, onClose, canEdit, onEditTrigger }: ProductDetailDrawerProps) {
    const [data, setData] = useState<ProductViewDetails | null>(null)
    const [loading, setLoading] = useState(false)
    const [activeImage, setActiveImage] = useState<string | null>(null)
    const [animate, setAnimate] = useState(false)

    useEffect(() => {
        if (open) {
            const raf = requestAnimationFrame(() => {
                setAnimate(true)
            })
            return () => cancelAnimationFrame(raf)
        } else {
            setAnimate(false)
        }
    }, [open])

    useEffect(() => {
        if (!open || !productId) return

        setLoading(true)
        setData(null)
        setActiveImage(initialData?.primaryImageUrl || null)

        const handleDetails = (details: ProductViewDetails | null) => {
            if (details) {
                setData(details)
                const primary = details.media.find(m => m.isPrimary)?.url ?? details.media[0]?.url ?? null
                setActiveImage(primary)
            }
            setLoading(false)
        }

        if (cachedData) {
            if (cachedData instanceof Promise) {
                cachedData
                    .then(handleDetails)
                    .catch(err => {
                        console.error('[ProductDetailDrawer] Cache promise error:', err)
                        setLoading(false)
                    })
            } else {
                handleDetails(cachedData)
            }
        } else {
            getProductViewDetails(productId)
                .then(handleDetails)
                .catch(err => {
                    console.error('[ProductDetailDrawer] Error fetching product view:', err)
                    setLoading(false)
                })
        }
    }, [open, productId, initialData, cachedData])

    if (!open) return null

    const activeProduct = data || initialData

    if (!activeProduct) {
        return (
            <>
                <div
                    className="fixed inset-0 z-40 transition-opacity duration-300"
                    style={{ background: 'rgba(10,5,2,0.7)', opacity: animate ? 1 : 0 }}
                    onClick={onClose}
                />
                <div
                    className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden transition-transform duration-300 items-center justify-center gap-3"
                    style={{
                        width: 'min(640px, 95vw)',
                        background: '#F8FAFC',
                        borderLeft: '1px solid #E2E8F0',
                        transform: animate ? 'translateX(0)' : 'translateX(100%)',
                    }}
                >
                    <Loader2 size={32} className="animate-spin text-[#0891B2]" />
                    <p className="text-xs" style={{ color: '#64748B' }}>Đang tải chi tiết...</p>
                </div>
            </>
        )
    }

    const flag = activeProduct.country ? COUNTRY_FLAGS[activeProduct.country] ?? '🌍' : '🌍'
    const countryName = activeProduct.country ? COUNTRY_NAMES[activeProduct.country] ?? activeProduct.country : ''
    const wineTypeBadge = activeProduct.wineType ? WINE_TYPE_CONFIG[activeProduct.wineType] : null
    const statusBadge = activeProduct.status ? STATUS_CONFIG[activeProduct.status] : null
    const totalStockQty = 'totalStock' in activeProduct 
        ? (activeProduct as any).totalStock 
        : (data ? data.stockLots.reduce((sum, l) => sum + l.qtyAvailable, 0) : 0)
    // Use initialData fields when detail data hasn't loaded yet
    const effectiveVolumeMl = data?.volumeMl ?? activeProduct.volumeMl ?? null
    const effectiveHsCode = data?.hsCode ?? activeProduct.hsCode ?? null
    const effectiveRetailPrice = data?.retailPrice ?? activeProduct.retailPrice ?? null
    const effectiveWholesalePrice = data?.wholesalePrice ?? activeProduct.wholesalePrice ?? null
    const effectiveIsAllocation = data?.isAllocationEligible ?? activeProduct.isAllocationEligible ?? false
    const effectiveProfile = data?.profile ?? activeProduct.profile ?? null

    return (
        <>
            <div
                className="fixed inset-0 z-40 transition-opacity duration-300"
                style={{ background: 'rgba(10,5,2,0.7)', opacity: animate ? 1 : 0 }}
                onClick={onClose}
            />

            <div
                className="fixed top-0 right-0 h-full z-50 flex flex-col overflow-hidden transition-transform duration-300"
                style={{
                    width: 'min(640px, 95vw)',
                    background: '#F8FAFC',
                    borderLeft: '1px solid #E2E8F0',
                    transform: animate ? 'translateX(0)' : 'translateX(100%)',
                }}
            >
                <div className="flex items-center justify-between px-6 py-4 flex-shrink-0"
                    style={{ borderBottom: '1px solid #E2E8F0' }}>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(8, 145, 178, 0.08)' }}>
                            <Wine size={16} style={{ color: '#0891B2' }} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg flex items-center gap-2" style={{ color: '#0F172A' }}>
                                Chi Tiết Sản Phẩm
                                {loading && <Loader2 size={14} className="animate-spin text-[#0891B2]" />}
                            </h3>
                            <p className="text-xs" style={{ color: '#64748B' }}>Xem thông tin chi tiết và tồn kho sản phẩm</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg transition-colors" style={{ color: '#64748B' }}
                        onMouseEnter={e => (e.currentTarget.style.background = '#FFFFFF')}
                        onMouseLeave={e => (e.currentTarget.style.background = '')}>
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 relative">
                    <div className="flex flex-col md:flex-row gap-5 items-start bg-white/40 p-4 rounded-xl border border-slate-200/30">
                        <div className="w-full md:w-36 h-48 rounded-lg flex-shrink-0 flex flex-col items-center justify-center relative bg-white border border-slate-200/60 overflow-hidden">
                            {activeImage ? (
                                <img src={activeImage} alt={activeProduct.productName} className="h-full object-contain p-2" />
                            ) : (
                                <Wine size={48} style={{ color: '#E2E8F0' }} />
                            )}
                        </div>

                        <div className="flex-1 space-y-2 min-w-0">
                            <h2 className="text-xl font-bold leading-snug" style={{ color: '#0F172A' }}>
                                {activeProduct.productName}
                            </h2>
                            <p className="text-xs font-sans tracking-wide" style={{ color: '#0891B2' }}>{activeProduct.skuCode}</p>
                            
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
                                {effectiveIsAllocation && (
                                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold" style={{ color: '#0891B2', background: 'rgba(135,203,185,0.1)' }}>
                                        Allocation
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-200/20 text-xs">
                                <div>
                                    <span style={{ color: '#64748B' }}>Nhà sản xuất: </span>
                                    <span className="font-semibold block" style={{ color: '#475569' }}>{activeProduct.producerName}</span>
                                </div>
                                <div>
                                    <span style={{ color: '#64748B' }}>Khả dụng bán: </span>
                                    <span className="font-bold text-sm block font-sans" style={{ color: totalStockQty > 0 ? '#5BA88A' : '#E05252' }}>
                                        {totalStockQty.toLocaleString()} chai
                                    </span>
                                </div>
                            </div>

                            {data && data.stockLots.length > 0 && (() => {
                                const totalBookQty = data.stockLots.reduce((sum, l) => sum + (l.qtyBook ?? l.qtyReceived ?? 0), 0)
                                const totalOnHandQty = data.stockLots.reduce((sum, l) => sum + (l.qtyOnHand ?? l.qtyAvailable ?? 0), 0)
                                const totalAvailQty = data.stockLots.reduce((sum, l) => sum + (l.qtyAvailable ?? 0), 0)
                                const totalResQty = data.stockLots.reduce((sum, l) => sum + (l.qtyReserved ?? 0), 0)
                                const totalVarQty = totalOnHandQty - totalBookQty

                                return (
                                    <div className="pt-2 space-y-1.5">
                                        <div className="grid grid-cols-3 gap-1.5 text-center">
                                            <div className="p-1.5 rounded-lg bg-white border border-slate-200/60">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tồn Sổ</span>
                                                <span className="text-xs font-bold font-mono text-slate-200">{totalBookQty.toLocaleString()}</span>
                                            </div>
                                            <div className="p-1.5 rounded-lg bg-white border border-slate-200/60">
                                                <span className="text-[10px] uppercase font-bold text-[#0891B2] block">On-hand</span>
                                                <span className="text-xs font-bold font-mono text-[#0891B2]">{totalOnHandQty.toLocaleString()}</span>
                                            </div>
                                            <div className="p-1.5 rounded-lg bg-white border border-slate-200/60">
                                                <span className="text-[10px] uppercase font-bold text-[#D4A853] block">Khả Dụng</span>
                                                <span className="text-xs font-bold font-mono text-[#D4A853]">{totalAvailQty.toLocaleString()}</span>
                                                {totalResQty > 0 && <span className="text-[9px] text-sky-400 block">(Đặt: {totalResQty})</span>}
                                            </div>
                                        </div>
                                        {totalVarQty !== 0 && (
                                            <div className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border flex items-center justify-between ${
                                                totalVarQty < 0 ? 'text-rose-400 bg-rose-950/40 border-rose-800/60' : 'text-amber-400 bg-amber-950/40 border-amber-800/60'
                                            }`}>
                                                <span>⚠️ Lệch Sổ sách & On-hand:</span>
                                                <span className="font-mono">{totalVarQty > 0 ? `+${totalVarQty}` : totalVarQty} chai</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                            <Layers size={13} /> Thông Số Kỹ Thuật
                        </h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 rounded-xl text-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            {[
                                { label: 'Xuất xứ', value: `${flag} ${countryName}` },
                                { label: 'Vùng trồng (Appellation)', value: activeProduct.appellationName ?? '—' },
                                { label: 'Độ cồn (ABV)', value: activeProduct.abvPercent ? `${activeProduct.abvPercent}°` : '—' },
                                { 
                                    label: 'Dung tích', 
                                    value: effectiveVolumeMl ? `${effectiveVolumeMl} ml` : '—'
                                },
                                { label: 'Quy cách đóng chai', value: activeProduct.format },
                                { label: 'Loại thùng đóng gói', value: activeProduct.packagingType === 'OWC' ? 'OWC (Thùng Gỗ)' : 'Carton' },
                                { label: 'Số chai mỗi thùng', value: `${activeProduct.unitsPerCase} chai` },
                                { label: 'Phân hạng rượu', value: activeProduct.classification ?? '—' },
                                { label: 'Thuế suất VAT', value: `${(data as any)?.vatRate ?? (activeProduct as any).vatRate ?? 10}%` },
                            ].map((spec, i) => (
                                <div key={i} className="flex justify-between py-1.5 border-b border-slate-200/20 last:border-b-0">
                                    <span style={{ color: '#64748B' }}>{spec.label}</span>
                                    <span className="font-semibold text-right flex items-center justify-end font-sans tabular-nums" style={{ color: '#0F172A' }}>{spec.value}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                            <DollarSign size={13} /> Giá Bán Theo Kênh (VND)
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-3.5 rounded-xl flex flex-col justify-between" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#64748B' }}>Giá Bán Lẻ Niêm Yết</span>
                                <span className="text-lg font-bold mt-1 font-sans tabular-nums" style={{ color: '#0891B2' }}>
                                    {effectiveRetailPrice ? formatVND(effectiveRetailPrice) : 'Chưa thiết lập'}
                                </span>
                            </div>
                            <div className="p-3.5 rounded-xl flex flex-col justify-between" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#64748B' }}>Giá Bán Buôn (Wholesale)</span>
                                <span className="text-lg font-bold mt-1 font-sans tabular-nums" style={{ color: '#0891B2' }}>
                                    {effectiveWholesalePrice ? formatVND(effectiveWholesalePrice) : 'Chưa thiết lập'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {((activeProduct as any)?.selfDeclarationUrl || (activeProduct as any)?.tastingNoteUrl) && (
                        <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                <Clipboard size={13} /> Tài Liệu & Đường Link
                            </h4>
                            <div className="flex flex-wrap gap-3">
                                {(activeProduct as any)?.selfDeclarationUrl && (
                                    <a
                                        href={(activeProduct as any).selfDeclarationUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
                                        style={{ background: 'rgba(8, 145, 178, 0.08)', border: '1px solid rgba(8, 145, 178, 0.25)', color: '#0891B2' }}
                                    >
                                        📄 Xem bản Tự Công Bố ↗
                                    </a>
                                )}
                                {(activeProduct as any)?.tastingNoteUrl && (
                                    <a
                                        href={(activeProduct as any).tastingNoteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors"
                                        style={{ background: 'rgba(74,143,171,0.12)', border: '1px solid rgba(74,143,171,0.3)', color: '#7AC4C4' }}
                                    >
                                        🍷 Xem Tasting Note ↗
                                    </a>
                                )}
                            </div>
                        </div>
                    )}


                    {effectiveProfile && (
                        <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                <Tag size={13} /> Đặc Tính Sản Phẩm (Wine Profile)
                            </h4>
                            <div className="p-4 rounded-xl space-y-3 text-xs leading-relaxed" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <div className="grid grid-cols-2 gap-4">
                                    {effectiveProfile.grapes && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">Giống nho</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.grapes}</span>
                                        </div>
                                    )}
                                    {effectiveProfile.servingTemp && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">Nhiệt độ phục vụ</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.servingTemp}</span>
                                        </div>
                                    )}
                                    {effectiveProfile.originDetail && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">Xuất xứ chi tiết</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.originDetail}</span>
                                        </div>
                                    )}
                                    {effectiveProfile.certification && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">Chứng chỉ</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.certification}</span>
                                        </div>
                                    )}
                                    {effectiveProfile.color && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">Màu sắc</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.color}</span>
                                        </div>
                                    )}
                                    {effectiveProfile.style && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">Phong cách</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.style}</span>
                                        </div>
                                    )}
                                </div>
                                
                                {effectiveProfile.aromas && (
                                    <div className="pt-2 border-t border-slate-200/20">
                                        <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">Hương thơm (Nose)</span>
                                        <span style={{ color: '#475569' }}>{effectiveProfile.aromas}</span>
                                    </div>
                                )}
                                
                                {effectiveProfile.palate && (
                                    <div className="pt-2 border-t border-slate-200/20">
                                        <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">Vị giác (Palate)</span>
                                        <span style={{ color: '#475569' }}>{effectiveProfile.palate}</span>
                                    </div>
                                )}
                                
                                {effectiveProfile.foodPairings && (
                                    <div className="pt-2 border-t border-slate-200/20">
                                        <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">Món ăn kèm</span>
                                        <span style={{ color: '#475569' }}>{effectiveProfile.foodPairings}</span>
                                    </div>
                                )}

                                {effectiveProfile.bestSuitedFor && (
                                    <div className="pt-2 border-t border-slate-200/20">
                                        <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">Phù hợp với</span>
                                        <span style={{ color: '#475569' }}>{effectiveProfile.bestSuitedFor}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {loading && !data && (
                        <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                <Award size={13} /> Giải Thưởng & Điểm Số
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {[1, 2].map(i => (
                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg animate-pulse" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                        <div className="w-8 h-8 rounded-lg bg-[#E2E8F0]/20 flex-shrink-0" />
                                        <div className="flex-1 space-y-1.5">
                                            <div className="h-3 bg-[#E2E8F0]/30 rounded w-3/4" />
                                            <div className="h-2 bg-[#E2E8F0]/30 rounded w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {data && data.awards.length > 0 && (
                        <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                <Award size={13} /> Giải Thưởng & Điểm Số
                            </h4>
                            <div className="grid grid-cols-2 gap-2">
                                {data.awards.map(a => (
                                    <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg text-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(212,168,83,0.1)' }}>
                                            <Award size={16} style={{ color: '#D4A853' }} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold truncate" style={{ color: '#0F172A' }}>
                                                {a.source}
                                                {a.score && <span className="ml-1.5 text-xs text-[#0891B2] font-sans font-bold">{a.score}pt</span>}
                                            </p>
                                            <p className="text-[10px] mt-0.5" style={{ color: '#64748B' }}>
                                                {a.medalLabel ?? ''} {a.vintage ? `(Vintage: ${a.vintage})` : ''}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                            <Boxes size={13} /> Chi Tiết Tồn Kho Vật Lý
                        </h4>
                        
                        {loading && !data ? (
                            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                                <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                            {['Kho', 'Vị Trí', 'Mã Lô', 'Trạng Thái', 'Tồn Kho'].map((h, idx) => (
                                                <th key={idx} className="px-3 py-2 uppercase font-semibold text-[10px]" style={{ color: '#64748B' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="animate-pulse">
                                        {[1, 2].map(i => (
                                            <tr key={i} style={{ borderBottom: '1px solid rgba(42,67,85,0.3)' }}>
                                                <td className="px-3 py-3"><div className="h-3 bg-[#E2E8F0]/30 rounded w-24" /></td>
                                                <td className="px-3 py-3"><div className="h-3 bg-[#E2E8F0]/30 rounded w-12" /></td>
                                                <td className="px-3 py-3"><div className="h-3 bg-[#E2E8F0]/30 rounded w-16" /></td>
                                                <td className="px-3 py-3"><div className="h-3 bg-[#E2E8F0]/30 rounded w-16" /></td>
                                                <td className="px-3 py-3 text-right"><div className="h-3 bg-[#E2E8F0]/30 rounded w-8 ml-auto" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            data && (
                                data.stockLots.length === 0 ? (
                                    <div className="flex flex-col items-center py-8 gap-2 rounded-xl text-center" style={{ border: '1px dashed #E2E8F0', background: '#FFFFFF/30' }}>
                                        <AlertCircle size={24} style={{ color: '#E2E8F0' }} />
                                        <p className="text-xs" style={{ color: '#64748B' }}>Không có hàng tồn kho khả dụng cho sản phẩm này.</p>
                                    </div>
                                ) : (
                                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                                        <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                            <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                                                <thead>
                                                    <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10 }}>
                                                        {['Kho', 'Vị Trí', 'Mã Lô', 'VTG', 'Tồn Sổ', 'On-hand', 'Khả Dụng', 'Trạng Thái'].map((h, idx) => (
                                                            <th key={idx} className={`px-2.5 py-2 uppercase font-semibold text-[10px] ${idx >= 4 && idx <= 6 ? 'text-center' : ''}`} style={{ color: '#64748B' }}>{h}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {data.stockLots.map(lot => {
                                                        const statusCfg = LOT_STATUS[lot.status] ?? { label: lot.status, color: '#475569', bg: 'rgba(168,152,128,0.1)' }
                                                        const bookQty = lot.qtyBook ?? lot.qtyReceived ?? 0
                                                        const onHandQty = lot.qtyOnHand ?? lot.qtyAvailable ?? 0
                                                        const variance = lot.variance ?? (onHandQty - bookQty)

                                                        return (
                                                            <tr key={lot.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.3)' }} className="hover:bg-white/50">
                                                                <td className="px-2.5 py-2 font-medium" style={{ color: '#0F172A' }}>{lot.warehouseName}</td>
                                                                <td className="px-2.5 py-2 font-sans font-semibold" style={{ color: '#475569' }}>{lot.locationCode}</td>
                                                                <td className="px-2.5 py-2 font-sans font-mono text-[11px]" style={{ color: '#64748B' }}>{lot.lotNo}</td>
                                                                <td className="px-2.5 py-2 font-sans font-semibold font-mono text-center" style={{ color: lot.vintage ? '#87CBB9' : '#64748B' }}>{lot.vintage ?? 'NV'}</td>
                                                                <td className="px-2.5 py-2 text-center font-mono font-bold" style={{ color: '#475569' }}>
                                                                    {bookQty.toLocaleString()}
                                                                </td>
                                                                <td className="px-2.5 py-2 text-center font-mono font-bold">
                                                                    <span style={{ color: '#0891B2' }}>{onHandQty.toLocaleString()}</span>
                                                                    {variance !== 0 && (
                                                                        <span className={`block text-[9px] font-semibold ${variance < 0 ? 'text-rose-400' : 'text-amber-400'}`}>
                                                                            ({variance > 0 ? `+${variance}` : variance})
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-2.5 py-2 text-center font-sans font-bold tabular-nums" style={{ color: '#D4A853' }}>
                                                                    {lot.qtyAvailable.toLocaleString()}
                                                                    {lot.qtyReserved > 0 && (
                                                                        <span className="block text-[9px] text-sky-400 font-semibold font-mono">
                                                                            (Đặt: {lot.qtyReserved})
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-2.5 py-2">
                                                                    <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold inline-block" style={{ color: statusCfg.color, background: statusCfg.bg }}>
                                                                        {statusCfg.label}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        )
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )
                            )
                        )}
                    </div>
                </div>

                {activeProduct && canEdit && (
                    <div className="px-6 py-4 flex-shrink-0 flex justify-end gap-3" style={{ borderTop: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                        <button
                            onClick={() => {
                                onClose()
                                onEditTrigger(activeProduct.id)
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                            style={{ background: '#0891B2', color: '#FFFFFF' }}
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
