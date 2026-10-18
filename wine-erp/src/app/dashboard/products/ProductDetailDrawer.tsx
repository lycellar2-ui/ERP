'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
    X, Wine, Award, Star, Loader2, Calendar, 
    Layers, Clipboard, CheckCircle2, AlertCircle,
    Boxes, Tag, DollarSign, Edit, FileText, ExternalLink, Download, Eye
} from 'lucide-react'
import { getProductViewDetails, type ProductViewDetails, type ProductRow } from './actions'
import { formatVND } from '@/lib/utils'
import { Badge, Button, Drawer, StatusBadge } from '@/components/ui'
import { WineTypeBadge } from '@/components/WineTypeBadge'
import { useAppLocale } from '@/lib/i18n'
import { PRODUCTS_I18N } from './i18n'

interface ProductDetailDrawerProps {
    open: boolean
    productId: string | null
    initialData?: ProductRow | null
    cachedData?: Promise<ProductViewDetails | null> | ProductViewDetails | null
    onClose: () => void
    canEdit: boolean
    onEditTrigger: (id: string) => void
}

const LOT_TONE_OVERRIDES = { AVAILABLE: 'success', RESERVED: 'info', QUARANTINE: 'warning', DAMAGED: 'danger' } as const
const STATUS_TONE_OVERRIDES = { ALLOCATION_ONLY: 'info' } as const

export function ProductDetailDrawer({ open, productId, initialData, cachedData, onClose, canEdit, onEditTrigger }: ProductDetailDrawerProps) {
    const { locale, formatCurrency, formatNumber } = useAppLocale()
    const L = PRODUCTS_I18N[locale]
    const D = L.detailDrawer
    const [data, setData] = useState<ProductViewDetails | null>(null)
    const [loading, setLoading] = useState(false)
    const [activeImage, setActiveImage] = useState<string | null>(null)
    const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null)

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
            <Drawer open onClose={onClose} size="md" className="bg-lys-bg" title={D.title}>
                <div className="flex flex-col items-center justify-center gap-3 py-24">
                    <Loader2 size={28} className="animate-spin text-lys-teal" aria-hidden />
                    <p className="type-caption text-lys-muted">{D.loadingDetails}</p>
                </div>
            </Drawer>
        )
    }

    const countryName = activeProduct.country ? L.countries[activeProduct.country] ?? activeProduct.country : ''
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
    const effectiveSelfDeclarationUrl = data?.selfDeclarationUrl ?? initialData?.selfDeclarationUrl ?? (activeProduct as any)?.selfDeclarationUrl ?? null
    const effectiveTastingNoteUrl = data?.tastingNoteUrl ?? initialData?.tastingNoteUrl ?? (activeProduct as any)?.tastingNoteUrl ?? null

    return (
        <Drawer
            open
            onClose={() => { if (previewDoc) setPreviewDoc(null); else onClose() }}
            size="md"
            className="bg-lys-bg"
            title={D.title}
            headerExtra={loading ? <Loader2 size={14} className="animate-spin text-lys-teal" aria-label={D.loadingDetails} /> : undefined}
            description={D.description}
            footer={canEdit ? (
                <Button onClick={() => { onClose(); onEditTrigger(activeProduct.id) }}>
                    <Edit size={14} aria-hidden /> {D.editBtn}
                </Button>
            ) : undefined}
        >
                <div className="space-y-6 relative">
                    <div className="flex flex-col md:flex-row gap-5 items-start bg-white/40 p-4 rounded-lg border border-slate-200/30">
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
                                <WineTypeBadge type={activeProduct.wineType} />
                                {activeProduct.status && (
                                    <StatusBadge status={activeProduct.status} label={L.detailStatuses[activeProduct.status] ?? activeProduct.status} toneOverrides={STATUS_TONE_OVERRIDES} />
                                )}
                                {effectiveIsAllocation && <Badge tone="info">Allocation</Badge>}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 border-t border-slate-200/20 text-xs">
                                <div>
                                    <span style={{ color: '#64748B' }}>{D.producer}</span>
                                    <span className="font-semibold block" style={{ color: '#475569' }}>{activeProduct.producerName}</span>
                                </div>
                                <div>
                                    <span style={{ color: '#64748B' }}>{D.availableToSell}</span>
                                    <span className="font-bold text-sm block font-sans" style={{ color: totalStockQty > 0 ? '#15803D' : '#B91C1C' }}>
                                        {formatNumber(totalStockQty)} {D.bottles}
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
                                                <span className="text-[10px] uppercase font-bold text-slate-500 block">{D.bookStock}</span>
                                                <span className="text-xs font-bold font-mono text-slate-900">{formatNumber(totalBookQty)}</span>
                                            </div>
                                            <div className="p-1.5 rounded-lg bg-white border border-slate-200/60">
                                                <span className="text-[10px] uppercase font-bold text-lys-teal block">{D.onHand}</span>
                                                <span className="text-xs font-bold font-mono text-lys-teal">{formatNumber(totalOnHandQty)}</span>
                                            </div>
                                            <div className="p-1.5 rounded-lg bg-white border border-slate-200/60">
                                                <span className="text-[10px] uppercase font-bold text-[#B45309] block">{D.available}</span>
                                                <span className="text-xs font-bold font-mono text-[#B45309]">{formatNumber(totalAvailQty)}</span>
                                                {totalResQty > 0 && <span className="text-[9px] text-sky-700 block">({D.reservedPrefix} {totalResQty})</span>}
                                            </div>
                                        </div>
                                        {totalVarQty !== 0 && (
                                            <div className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border flex items-center justify-between ${
                                                totalVarQty < 0 ? 'text-rose-700 bg-rose-950/40 border-rose-800/60' : 'text-amber-700 bg-amber-950/40 border-amber-800/60'
                                            }`}>
                                                <span className="flex items-center gap-1.5"><AlertCircle size={12} className="shrink-0" /> {D.varianceAlert}</span>
                                                <span className="font-mono">{totalVarQty > 0 ? `+${totalVarQty}` : totalVarQty} {D.bottles}</span>
                                            </div>
                                        )}
                                    </div>
                                )
                            })()}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                            <Layers size={13} /> {D.specsTitle}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 p-4 rounded-lg text-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                            {[
                                { label: D.specOrigin, value: countryName || '—' },
                                { label: D.specAppellation, value: activeProduct.appellationName ?? '—' },
                                { label: D.specAbv, value: activeProduct.abvPercent ? `${activeProduct.abvPercent}°` : '—' },
                                { 
                                    label: D.specVolume, 
                                    value: effectiveVolumeMl ? `${effectiveVolumeMl} ml` : '—'
                                },
                                { label: D.specFormat, value: activeProduct.format },
                                { label: D.specPackaging, value: activeProduct.packagingType === 'OWC' ? D.specOwc : 'Carton' },
                                { label: D.specUnitsPerCase, value: `${activeProduct.unitsPerCase} ${D.bottles}` },
                                { label: D.specClassification, value: activeProduct.classification ?? '—' },
                                { label: D.specVat, value: `${(data as any)?.vatRate ?? (activeProduct as any).vatRate ?? 10}%` },
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
                            <DollarSign size={13} /> {D.pricingTitle}
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-3.5 rounded-lg flex flex-col justify-between" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#64748B' }}>{D.retailPrice}</span>
                                <span className="text-lg font-bold mt-1 font-sans tabular-nums" style={{ color: '#0891B2' }}>
                                    {effectiveRetailPrice ? formatCurrency(effectiveRetailPrice) : D.notSet}
                                </span>
                            </div>
                            <div className="p-3.5 rounded-lg flex flex-col justify-between" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: '#64748B' }}>{D.wholesalePrice}</span>
                                <span className="text-lg font-bold mt-1 font-sans tabular-nums" style={{ color: '#0891B2' }}>
                                    {effectiveWholesalePrice ? formatCurrency(effectiveWholesalePrice) : D.notSet}
                                </span>
                            </div>
                        </div>
                    </div>

                    {(effectiveSelfDeclarationUrl || effectiveTastingNoteUrl) && (
                        <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                <Clipboard size={13} /> {D.docsTitle}
                            </h4>
                            <div className="flex flex-wrap gap-3">
                                {effectiveSelfDeclarationUrl && (
                                    <div className="inline-flex items-center rounded-lg border border-cyan-700/30 bg-cyan-50/60 overflow-hidden text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDoc({
                                                url: effectiveSelfDeclarationUrl,
                                                title: `${D.tcbTitlePrefix} — ${activeProduct.productName}`,
                                            })}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold text-cyan-900 hover:bg-cyan-100/70 transition-colors cursor-pointer"
                                            title={D.viewTcb}
                                        >
                                            <FileText size={13} className="text-cyan-700 shrink-0" />
                                            <span>{D.viewTcb}</span>
                                            <Eye size={12} className="shrink-0 text-cyan-700" />
                                        </button>
                                        <a
                                            href={`${effectiveSelfDeclarationUrl}${effectiveSelfDeclarationUrl.includes('?') ? '&' : '?'}download=true`}
                                            download
                                            className="px-2.5 py-2 border-l border-cyan-700/20 text-cyan-800 hover:bg-cyan-100/70 transition-colors flex items-center justify-center"
                                            title={D.downloadTooltip}
                                        >
                                            <Download size={12} />
                                        </a>
                                    </div>
                                )}
                                {effectiveTastingNoteUrl && (
                                    <div className="inline-flex items-center rounded-lg border border-cyan-700/30 bg-cyan-50/60 overflow-hidden text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setPreviewDoc({
                                                url: effectiveTastingNoteUrl,
                                                title: `Tasting Note — ${activeProduct.productName}`,
                                            })}
                                            className="inline-flex items-center gap-1.5 px-3 py-2 font-semibold text-cyan-900 hover:bg-cyan-100/70 transition-colors cursor-pointer"
                                            title={D.viewTastingNote}
                                        >
                                            <Wine size={13} className="text-cyan-700 shrink-0" />
                                            <span>{D.viewTastingNote}</span>
                                            <Eye size={12} className="shrink-0 text-cyan-700" />
                                        </button>
                                        <a
                                            href={`${effectiveTastingNoteUrl}${effectiveTastingNoteUrl.includes('?') ? '&' : '?'}download=true`}
                                            download
                                            className="px-2.5 py-2 border-l border-cyan-700/20 text-cyan-800 hover:bg-cyan-100/70 transition-colors flex items-center justify-center"
                                            title={D.downloadTooltip}
                                        >
                                            <Download size={12} />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}


                    {effectiveProfile && (
                        <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                <Tag size={13} /> {D.profileTitle}
                            </h4>
                            <div className="p-4 rounded-lg space-y-3 text-xs leading-relaxed" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    {effectiveProfile.grapes && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">{D.grapes}</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.grapes}</span>
                                        </div>
                                    )}
                                    {effectiveProfile.servingTemp && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">{D.servingTemp}</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.servingTemp}</span>
                                        </div>
                                    )}
                                    {effectiveProfile.originDetail && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">{D.originDetail}</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.originDetail}</span>
                                        </div>
                                    )}
                                    {effectiveProfile.certification && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">{D.certification}</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.certification}</span>
                                        </div>
                                    )}
                                    {effectiveProfile.color && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">{D.color}</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.color}</span>
                                        </div>
                                    )}
                                    {effectiveProfile.style && (
                                        <div>
                                            <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">{D.style}</span>
                                            <span style={{ color: '#0F172A' }} className="font-medium">{effectiveProfile.style}</span>
                                        </div>
                                    )}
                                </div>
                                
                                {effectiveProfile.aromas && (
                                    <div className="pt-2 border-t border-slate-200/20">
                                        <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">{D.aromas}</span>
                                        <span style={{ color: '#475569' }}>{effectiveProfile.aromas}</span>
                                    </div>
                                )}
                                
                                {effectiveProfile.palate && (
                                    <div className="pt-2 border-t border-slate-200/20">
                                        <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">{D.palate}</span>
                                        <span style={{ color: '#475569' }}>{effectiveProfile.palate}</span>
                                    </div>
                                )}
                                
                                {effectiveProfile.foodPairings && (
                                    <div className="pt-2 border-t border-slate-200/20">
                                        <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">{D.foodPairings}</span>
                                        <span style={{ color: '#475569' }}>{effectiveProfile.foodPairings}</span>
                                    </div>
                                )}

                                {effectiveProfile.bestSuitedFor && (
                                    <div className="pt-2 border-t border-slate-200/20">
                                        <span style={{ color: '#64748B' }} className="block uppercase text-[10px] font-bold">{D.bestSuitedFor}</span>
                                        <span style={{ color: '#475569' }}>{effectiveProfile.bestSuitedFor}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {loading && !data && (
                        <div className="space-y-3">
                            <h4 className="text-xs uppercase tracking-widest font-bold flex items-center gap-1.5" style={{ color: '#0891B2' }}>
                                <Award size={13} /> {D.awardsTitle}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                                <Award size={13} /> {D.awardsTitle}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {data.awards.map(a => (
                                    <div key={a.id} className="flex items-center gap-3 p-2.5 rounded-lg text-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(180,83,9,0.1)' }}>
                                            <Award size={16} style={{ color: '#B45309' }} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold truncate" style={{ color: '#0F172A' }}>
                                                {a.source}
                                                {a.score && <span className="ml-1.5 text-xs text-lys-teal font-sans font-bold">{a.score}pt</span>}
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
                            <Boxes size={13} /> {D.stockLotsTitle}
                        </h4>
                        
                        {loading && !data ? (
                            <div className="rounded-lg overflow-x-auto" style={{ border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                                <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0' }}>
                                            {[D.colWarehouse, D.colLocation, D.colLotNo, D.colLotStatus, D.colAvailable].map((h, idx) => (
                                                <th key={idx} className="px-3 py-2 uppercase font-semibold text-[10px]" style={{ color: '#64748B' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="animate-pulse">
                                        {[1, 2].map(i => (
                                            <tr key={i} style={{ borderBottom: '1px solid #E2E8F0' }}>
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
                                    <div className="flex flex-col items-center py-8 gap-2 rounded-lg text-center" style={{ border: '1px dashed #E2E8F0', background: '#FFFFFF/30' }}>
                                        <AlertCircle size={24} style={{ color: '#E2E8F0' }} />
                                        <p className="text-xs" style={{ color: '#64748B' }}>{D.emptyStockLots}</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Mobile Stock Lot Cards (<768px) */}
                                        <div className="md:hidden space-y-2">
                                            {data.stockLots.map(lot => {
                                                const bookQty = lot.qtyBook ?? lot.qtyReceived ?? 0
                                                const onHandQty = lot.qtyOnHand ?? lot.qtyAvailable ?? 0
                                                const variance = lot.variance ?? (onHandQty - bookQty)
                                                return (
                                                    <div key={lot.id} className="p-3 rounded-lg bg-white border border-slate-200 space-y-2 text-xs">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div>
                                                                <p className="font-semibold text-slate-900">{lot.warehouseName}</p>
                                                                <p className="text-[11px] font-mono text-slate-500">
                                                                    {lot.locationCode} · {lot.lotNo} · VTG: {lot.vintage ?? 'NV'}
                                                                </p>
                                                            </div>
                                                            <StatusBadge status={lot.status} label={L.lotStatuses[lot.status] ?? lot.status} toneOverrides={LOT_TONE_OVERRIDES} />
                                                        </div>
                                                        <div className="grid grid-cols-3 gap-1.5 text-center pt-1.5 border-t border-slate-100">
                                                            <div>
                                                                <span className="text-[10px] text-slate-500 block">{D.colBook}</span>
                                                                <span className="font-mono font-bold text-slate-700">{formatNumber(bookQty)}</span>
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] text-slate-500 block">{D.colOnHand}</span>
                                                                <span className="font-mono font-bold text-cyan-700">{formatNumber(onHandQty)}</span>
                                                                {variance !== 0 && (
                                                                    <span className={`block text-[9px] font-semibold ${variance < 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                                                                        ({variance > 0 ? `+${variance}` : variance})
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <span className="text-[10px] text-slate-500 block">{D.colAvailable}</span>
                                                                <span className="font-mono font-bold text-amber-700">{formatNumber(lot.qtyAvailable)}</span>
                                                                {lot.qtyReserved > 0 && (
                                                                    <span className="block text-[9px] text-sky-700 font-semibold font-mono">
                                                                        ({D.reservedPrefix} {lot.qtyReserved})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>

                                        {/* Desktop Table (>=768px) */}
                                        <div className="hidden md:block rounded-lg overflow-hidden" style={{ border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                                            <div className="overflow-x-auto" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                                <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                                                    <thead>
                                                        <tr style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10 }}>
                                                            {[D.colWarehouse, D.colLocation, D.colLotNo, D.colVintage, D.colBook, D.colOnHand, D.colAvailable, D.colLotStatus].map((h, idx) => (
                                                                <th key={idx} className={`px-2.5 py-2 uppercase font-semibold text-[10px] ${idx >= 4 && idx <= 6 ? 'text-center' : ''}`} style={{ color: '#64748B' }}>{h}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {data.stockLots.map(lot => {
                                                            const bookQty = lot.qtyBook ?? lot.qtyReceived ?? 0
                                                            const onHandQty = lot.qtyOnHand ?? lot.qtyAvailable ?? 0
                                                            const variance = lot.variance ?? (onHandQty - bookQty)

                                                            return (
                                                                <tr key={lot.id} style={{ borderBottom: '1px solid #E2E8F0' }} className="hover:bg-white/50">
                                                                    <td className="px-2.5 py-2 font-medium" style={{ color: '#0F172A' }}>{lot.warehouseName}</td>
                                                                    <td className="px-2.5 py-2 font-sans font-semibold" style={{ color: '#475569' }}>{lot.locationCode}</td>
                                                                    <td className="px-2.5 py-2 font-sans font-mono text-[11px]" style={{ color: '#64748B' }}>{lot.lotNo}</td>
                                                                    <td className="px-2.5 py-2 font-sans font-semibold font-mono text-center" style={{ color: lot.vintage ? '#0E7490' : '#64748B' }}>{lot.vintage ?? 'NV'}</td>
                                                                    <td className="px-2.5 py-2 text-center font-mono font-bold" style={{ color: '#475569' }}>
                                                                        {formatNumber(bookQty)}
                                                                    </td>
                                                                    <td className="px-2.5 py-2 text-center font-mono font-bold">
                                                                        <span style={{ color: '#0891B2' }}>{formatNumber(onHandQty)}</span>
                                                                        {variance !== 0 && (
                                                                            <span className={`block text-[9px] font-semibold ${variance < 0 ? 'text-rose-700' : 'text-amber-700'}`}>
                                                                                ({variance > 0 ? `+${variance}` : variance})
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-2.5 py-2 text-center font-sans font-bold tabular-nums" style={{ color: '#B45309' }}>
                                                                        {formatNumber(lot.qtyAvailable)}
                                                                        {lot.qtyReserved > 0 && (
                                                                            <span className="block text-[9px] text-sky-700 font-semibold font-mono">
                                                                                ({D.reservedPrefix} {lot.qtyReserved})
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-2.5 py-2">
                                                                        <StatusBadge status={lot.status} label={L.lotStatuses[lot.status] ?? lot.status} toneOverrides={LOT_TONE_OVERRIDES} />
                                                                    </td>
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </>
                                )
                            )
                        )}
                    </div>
                </div>

                {previewDoc && typeof document !== 'undefined' && createPortal(
                    <div
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-6"
                        onClick={() => setPreviewDoc(null)}
                    >
                        <div
                            className="bg-white rounded-lg shadow-2xl border border-slate-200 w-full max-w-5xl h-[88vh] flex flex-col overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
                                <div className="flex items-center gap-2 min-w-0">
                                    <FileText size={16} className="text-cyan-700 shrink-0" />
                                    <h3 className="text-sm font-bold text-slate-900 truncate">{previewDoc.title}</h3>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <a
                                        href={previewDoc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
                                        title={D.openNewTab}
                                    >
                                        <ExternalLink size={12} />
                                        <span className="hidden sm:inline">{D.openNewTab}</span>
                                    </a>
                                    <a
                                        href={`${previewDoc.url}${previewDoc.url.includes('?') ? '&' : '?'}download=true`}
                                        download
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold text-white bg-cyan-700 hover:bg-cyan-800 transition-colors"
                                        title={D.downloadTooltip}
                                    >
                                        <Download size={12} />
                                        <span className="hidden sm:inline">{D.downloadBtn}</span>
                                    </a>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewDoc(null)}
                                        className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200/60 transition-colors cursor-pointer"
                                        aria-label={D.closePreview}
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            </div>
                            <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
                                {/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(previewDoc.url) ? (
                                    <img
                                        src={previewDoc.url}
                                        alt={previewDoc.title}
                                        className="max-w-full max-h-full object-contain p-4"
                                    />
                                ) : (
                                    <iframe
                                        src={previewDoc.url}
                                        title={previewDoc.title}
                                        className="w-full h-full border-0 bg-white"
                                    />
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </Drawer>
    )
}
