'use client'

import { useState, useEffect } from 'react'
import {
    Warehouse, Package, BarChart3, Plus, Search, MapPin,
    Thermometer, Box, X, Save, Loader2, AlertCircle, CheckCircle2,
    ChevronRight, Layers, PackagePlus, Truck, ShieldAlert, Trash2,
    DollarSign, AlertTriangle, Clock, Wine, ArrowUpDown, TrendingDown, Download, ChevronDown,
    ArrowRightLeft, ClipboardList, LayoutGrid, ArrowLeft, RefreshCw, BellRing, BellOff, Volume2
} from 'lucide-react'
import { toast } from 'sonner'
import {
    playNotificationSound,
    requestBrowserNotificationPermission,
    sendDesktopNotification
} from '@/lib/web-notifications'
import {
    WarehouseRow, StockLotRow, LocationRow,
    createWarehouse, editWarehouse, createLocation, getStockInventory, getLocations,
    getQuarantinedLots, moveToQuarantine, releaseFromQuarantine, writeOffStock,
    getWarehouses, getWMSStats, getLatestPendingDO
} from './actions'
import { getLegalEntities } from '../sales/actions'
import { useAppLocale } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Button, Badge, StatCard, StatGrid } from '@/components/ui'
import { type Tone } from '@/lib/ui/status'
import { WAREHOUSE_I18N, getLotStatusLabel, getWineTypeLabel } from './i18n'
import { GoodsReceiptTab } from './GoodsReceiptTab'
import { DeliveryOrderTab } from './DeliveryOrderTab'
import { LocationManager } from './LocationManager'
import { StockMovementTab } from './StockMovementTab'
import { WarehouseMapTab } from './WarehouseMapTab'
import { TransfersTab } from './TransfersTab'
import { StockCountTab } from './StockCountTab'
import { SampleInventoryTab } from './SampleInventoryTab'
import { ReplenishmentTab } from './ReplenishmentTab'

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
    AT: '🇦🇹', GR: '🇬🇷', HU: '🇭🇺', GE: '🇬🇪', RO: '🇷🇴',
    IL: '🇮🇱', LB: '🇱🇧', UY: 'UY', BR: '🇧🇷', MX: '🇲🇽',
    CN: '🇨🇳', JP: '🇯🇵', GB: '🇬🇧', CH: '🇨🇭', HR: '🇭🇷',
    SI: '🇸🇮', MD: '🇲🇩', BG: '🇧🇬', TR: '🇹🇷', MA: '🇲🇦',
}

const WINE_TYPE_COLOR: Record<string, string> = {
    RED: '#C74B50', WHITE: '#E2C275', ROSE: '#D4607A',
    SPARKLING: '#7AC4C4', FORTIFIED: '#B87333', DESSERT: '#D4963A',
}

const getLotStatusConfig = (status: string, locale: any) => {
    const label = getLotStatusLabel(status, locale)
    switch (status) {
        case 'AVAILABLE': return { label, color: '#16A34A' }
        case 'RESERVED': return { label, color: '#2563EB' }
        case 'QUARANTINE': return { label, color: '#B47816' }
        case 'CONSUMED': return { label, color: '#64748B' }
        case 'DAMAGED': return { label, color: '#B91C1C' }
        default: return { label, color: '#64748B' }
    }
}

// ── Create Warehouse Modal ─────────────────────────
function CreateWarehouseModal({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: () => void
}) {
    const { locale } = useAppLocale()
    const t = WAREHOUSE_I18N[locale].createModal
    const [form, setForm] = useState({ code: '', name: '', address: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    if (!open) return null

    const handleSave = async () => {
        if (!form.code || !form.name) return setError(t.errorRequired)
        setSaving(true)
        try {
            await createWarehouse({ code: form.code.toUpperCase(), name: form.name, address: form.address || null })
            onCreated()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(15, 23, 42, 0.4)' }} onClick={onClose}>
            <div className="rounded-lg p-6 space-y-5 w-full max-w-md shadow-2xl"
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
                        {t.title}
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" style={{ color: '#64748B' }}><X size={18} /></button>
                </div>

                {error && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(185,28,28,0.1)', color: '#B91C1C' }}>{error}</div>}

                {[
                    { key: 'code', label: t.codeLabel, placeholder: t.codePlaceholder },
                    { key: 'name', label: t.nameLabel, placeholder: t.namePlaceholder },
                    { key: 'address', label: t.addressLabel, placeholder: t.addressPlaceholder },
                ].map(f => (
                    <div key={f.key}>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#475569' }}>{f.label}</label>
                        <input className="w-full px-3 py-2.5 rounded-lg text-base sm:text-sm outline-none"
                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                            value={(form as any)[f.key]} placeholder={f.placeholder}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                    </div>
                ))}

                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                        style={{ color: '#475569', border: '1px solid #CBD5E1', background: '#F1F5F9' }}>{t.cancel}</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold shadow-md"
                        style={{ background: '#D97706', color: '#FFFFFF' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? t.saving : t.save}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Days-in-stock badge ───────────────────────────
function DaysInStockBadge({ receivedDate }: { receivedDate: Date }) {
    const { locale } = useAppLocale()
    const days = Math.floor((Date.now() - new Date(receivedDate).getTime()) / 86400000)
    const color = days > 180 ? '#B91C1C' : days > 90 ? '#B47816' : '#64748B'
    const suffix = WAREHOUSE_I18N[locale].table.daysSuffix
    return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ color, background: `${color}15` }}>
            {days}{suffix}
        </span>
    )
}

// ── Stock table ───────────────────────────────────
function StockTable({ lots, sortConfig, onSort }: {
    lots: StockLotRow[]
    sortConfig: { key: string; dir: 'asc' | 'desc' }
    onSort: (key: string) => void
}) {
    const { locale, formatCurrency, formatDate: formatDateLocale } = useAppLocale()
    const t = WAREHOUSE_I18N[locale].table

    if (lots.length === 0) {
        return (
            <div className="flex flex-col items-center py-16 gap-3 rounded-lg" style={{ border: '1px dashed #CBD5E1', background: '#FFFFFF' }}>
                <Box size={32} style={{ color: '#94A3B8' }} />
                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>{t.emptyTitle}</p>
                <p className="text-xs" style={{ color: '#64748B' }}>{t.emptySubtitle}</p>
            </div>
        )
    }

    const headers = [
        { key: 'skuCode', label: t.thSku, align: 'left' as const },
        { key: 'productName', label: t.thProduct, align: 'left' as const },
        { key: 'vintage', label: t.thVintage, align: 'center' as const },
        { key: 'lotNo', label: t.thLot, align: 'left' as const },
        { key: 'locationCode', label: t.thLocation, align: 'left' as const },
        { key: 'receivedDate', label: t.thReceivedDate, align: 'left' as const },
        { key: 'qtyBook', label: t.thBookQty, align: 'center' as const },
        { key: 'qtyOnHand', label: t.thOnHandQty, align: 'center' as const },
        { key: 'qtyAvailable', label: t.thAvailable, align: 'center' as const },
        { key: 'value', label: t.thLotValue, align: 'right' as const },
        { key: 'status', label: t.thStatus, align: 'center' as const },
    ]

    return (
        <div className="rounded-lg overflow-hidden shadow-xs border border-slate-200" style={{ background: '#FFFFFF' }}>
            {/* Desktop Table View (Compact Row Height for Maximum Row Density) */}
            <div className="hidden md:block overflow-y-auto" style={{ maxHeight: 'calc(100vh - 290px)' }}>
                <table className="w-full text-left border-collapse text-xs">
                    <thead>
                        <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', position: 'sticky', top: 0, zIndex: 10 }}>
                            {headers.map(h => (
                                <th key={h.key} className={`px-3 py-2 text-[11px] uppercase tracking-wider font-extrabold cursor-pointer select-none whitespace-nowrap text-${h.align}`}
                                    style={{ color: sortConfig.key === h.key ? '#B47816' : '#64748B' }}
                                    onClick={() => onSort(h.key)}>
                                    <span className="inline-flex items-center gap-1">
                                        {h.label}
                                        {sortConfig.key === h.key && (
                                            <ArrowUpDown size={10} style={{ color: '#B47816' }} />
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {lots.map(lot => {
                            const flag = COUNTRY_FLAGS[lot.country] ?? '🌍'
                            const wineColor = WINE_TYPE_COLOR[lot.wineType] ?? '#64748B'
                            const statusCfg = getLotStatusConfig(lot.status, locale)
                            const baseQty = lot.qtyOnHand > 0 ? lot.qtyOnHand : (lot.qtyReceived > 0 ? lot.qtyReceived : 1)
                            const pctRemaining = Math.min(100, Math.max(0, (lot.qtyAvailable / baseQty) * 100))
                            const lotValue = lot.qtyAvailable * lot.unitLandedCost
                            const bookQty = lot.qtyBook ?? lot.qtyReceived
                            const onHandQty = lot.qtyOnHand ?? lot.qtyAvailable
                            const variance = lot.variance ?? (onHandQty - bookQty)

                            return (
                                <tr key={lot.id} className="group transition-colors hover:bg-amber-50/40">
                                    <td className="px-3 py-1.5 font-mono font-extrabold text-slate-800 whitespace-nowrap">
                                        {lot.skuCode}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="shrink-0">{flag}</span>
                                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wineColor }} />
                                            <p className="font-bold text-slate-900 truncate max-w-[240px] text-xs">{lot.productName}</p>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                        {lot.vintage ? (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-md font-mono inline-block" style={{ background: 'rgba(180,83,9,0.15)', color: '#B47816' }}>
                                                {lot.vintage}
                                            </span>
                                        ) : (
                                            <span className="text-xs font-semibold px-2 py-0.5 rounded-md font-mono inline-block bg-slate-100 text-slate-600 border border-slate-200">NV</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-1.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                        {lot.lotNo}
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-md font-mono" style={{ background: '#F1F5F9', color: '#334155' }}>
                                            {lot.locationCode}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-slate-600 font-mono">{formatDateLocale(lot.receivedDate)}</span>
                                            <DaysInStockBadge receivedDate={lot.receivedDate} />
                                        </div>
                                    </td>
                                    {/* Cột 1: Tồn Sổ Sách */}
                                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                        <span className="text-xs font-bold font-mono text-slate-700 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-md inline-block">
                                            {bookQty.toLocaleString()}
                                        </span>
                                    </td>
                                    {/* Cột 2: Tồn On-hand & Cảnh báo lệch */}
                                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                        <div className="flex flex-col items-center">
                                            <span className="text-xs font-black font-mono text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md inline-block">
                                                {onHandQty.toLocaleString()}
                                            </span>
                                            {variance !== 0 && (
                                                <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded mt-0.5 border ${
                                                    variance < 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200'
                                                }`} title={t.varianceTitle(variance, onHandQty, bookQty)}>
                                                    {t.varianceBadge(variance)}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    {/* Cột 3: Tồn Khả Dụng & Đã giữ chỗ */}
                                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 justify-center">
                                            <div className="text-center min-w-[45px]">
                                                <span className="text-xs font-bold font-mono" style={{ color: pctRemaining < 20 ? '#B91C1C' : pctRemaining < 50 ? '#B47816' : '#16A34A' }}>
                                                    {lot.qtyAvailable.toLocaleString()}
                                                </span>
                                                {lot.qtyReserved > 0 && (
                                                    <span className="block text-[9px] text-blue-600 font-bold whitespace-nowrap">
                                                        {t.reservedLabel(lot.qtyReserved)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="w-7 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: '#E2E8F0' }}>
                                                <div className="h-full rounded-full" style={{
                                                    width: `${pctRemaining}%`,
                                                    background: pctRemaining < 20 ? '#B91C1C' : pctRemaining < 50 ? '#B47816' : '#16A34A',
                                                }} />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                        {lotValue > 0 ? (
                                            <span className="text-xs font-mono font-semibold text-slate-900">
                                                {formatCurrency(lotValue)}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-[#94A3B8]">—</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full inline-flex items-center gap-1 whitespace-nowrap"
                                            style={{ color: statusCfg.color, background: `${statusCfg.color}15`, border: `1px solid ${statusCfg.color}30` }}>
                                            {statusCfg.label}
                                        </span>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card List View (< 768px) */}
            <div className="block md:hidden p-3 space-y-3">
                {lots.map(lot => {
                    const flag = COUNTRY_FLAGS[lot.country] ?? '🌍'
                    const wineColor = WINE_TYPE_COLOR[lot.wineType] ?? '#64748B'
                    const statusCfg = getLotStatusConfig(lot.status, locale)
                    const bookQty = lot.qtyBook ?? lot.qtyReceived
                    const onHandQty = lot.qtyOnHand ?? lot.qtyAvailable
                    const variance = lot.variance ?? (onHandQty - bookQty)

                    return (
                        <div key={lot.id} className="p-4 rounded-lg space-y-2.5 shadow-2xs bg-white border border-slate-200 text-slate-900">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200">
                                    {lot.lotNo}
                                </span>
                                <span className="text-xs font-bold font-mono px-2.5 py-1 rounded-lg bg-slate-50 text-emerald-700 border border-slate-200">
                                    {lot.locationCode}
                                </span>
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-slate-900 leading-tight">{lot.productName}</h4>
                                <p className="text-[11px] mt-1 flex items-center gap-1.5 text-slate-500 font-medium">
                                    {flag} <span className="w-2 h-2 rounded-full" style={{ background: wineColor }} />
                                    SKU: <strong className="text-slate-800 font-mono">{lot.skuCode}</strong> {lot.vintage ? `· Vintage: ${lot.vintage}` : '· NV'}
                                </p>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-100 text-xs">
                                <div className="text-center bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                                    <span className="text-slate-500 text-[10px] uppercase font-bold block">{t.tagBook}</span>
                                    <span className="font-bold font-mono text-xs text-slate-800">
                                        {bookQty.toLocaleString()}
                                    </span>
                                </div>
                                <div className="text-center bg-emerald-50 p-1.5 rounded-lg border border-emerald-200">
                                    <span className="text-emerald-700 text-[10px] uppercase font-bold block">{t.tagOnHand}</span>
                                    <span className="font-extrabold font-mono text-xs text-emerald-800">
                                        {onHandQty.toLocaleString()}
                                    </span>
                                    {variance !== 0 && (
                                        <span className={`text-[9px] font-bold block ${variance < 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                                            ({variance > 0 ? `+${variance}` : variance})
                                        </span>
                                    )}
                                </div>
                                <div className="text-center bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                                    <span className="text-amber-700 text-[10px] uppercase font-bold block">{t.tagAvailable}</span>
                                    <span className="font-extrabold font-mono text-xs text-amber-900">
                                        {lot.qtyAvailable.toLocaleString()}
                                    </span>
                                    {lot.qtyReserved > 0 && (
                                        <span className="text-[9px] text-blue-600 block font-semibold">
                                            {t.reservedLabel(lot.qtyReserved)}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                                <span className="text-slate-500 font-mono">{formatDateLocale(lot.receivedDate)}</span>
                                <span className="font-bold px-2 py-0.5 rounded-full text-[10px] uppercase border"
                                    style={{ color: statusCfg.color, background: `${statusCfg.color}15`, borderColor: `${statusCfg.color}30` }}>
                                    {statusCfg.label}
                                </span>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

// ── Quarantine & Write-Off Panel ──────────────────
function QuarantinePanel({ lots, loading, onRefresh }: { lots: any[]; loading: boolean; onRefresh: () => void }) {
    const { locale, formatDate: formatDateLocale } = useAppLocale()
    const t = WAREHOUSE_I18N[locale].quarantinePanel
    const [processing, setProcessing] = useState<string | null>(null)

    const handleRelease = async (lotId: string, action: 'RESTORE' | 'WRITE_OFF') => {
        setProcessing(lotId)
        await releaseFromQuarantine(lotId, action)
        onRefresh()
        setProcessing(null)
    }

    if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#B45309' }} /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg shadow-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#0F172A' }}>
                    <ShieldAlert size={16} style={{ color: '#B91C1C' }} /> {t.title}
                    {lots.length > 0 && (
                        <span className="ml-2 text-xs px-2.5 py-0.5 rounded-full font-bold"
                            style={{ background: 'rgba(185,28,28,0.1)', color: '#B91C1C' }}>
                            {t.lotsCount(lots.length)}
                        </span>
                    )}
                </h3>
                <button onClick={onRefresh} className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:bg-slate-100 cursor-pointer"
                    style={{ border: '1px solid #CBD5E1', color: '#475569', background: '#F1F5F9' }}>
                    {t.refresh}
                </button>
            </div>

            {lots.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2 rounded-lg shadow-xs" style={{ border: '1px dashed #CBD5E1', background: '#FFFFFF' }}>
                    <CheckCircle2 size={28} style={{ color: '#16A34A' }} />
                    <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>{t.empty}</p>
                </div>
            ) : (
                <div className="rounded-lg overflow-hidden shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    {/* Desktop Table View (>= 768px) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                    {[t.thLot, t.thProduct, t.thQty, t.thLocation, t.thReceivedDate, ''].map((h, idx) => (
                                        <th key={idx} className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]" style={{ color: '#64748B' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {lots.map((lot: any) => (
                                    <tr key={lot.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                        <td className="px-4 py-3 font-mono text-xs text-slate-600">{lot.lotNo}</td>
                                        <td className="px-4 py-3 font-semibold" style={{ color: '#0F172A' }}>{lot.product?.productName || lot.productId}</td>
                                        <td className="px-4 py-3 font-mono font-bold" style={{ color: '#0F172A' }}>{Number(lot.qtyAvailable).toLocaleString()}</td>
                                        <td className="px-4 py-3 font-mono text-[#64748B]">{lot.location?.locationCode || '—'}</td>
                                        <td className="px-4 py-3 text-[#64748B]">{formatDateLocale(lot.receivedDate)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => handleRelease(lot.id, 'RESTORE')} disabled={processing === lot.id}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs transition-all hover:brightness-105"
                                                    style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.25)' }}>
                                                    {processing === lot.id ? '...' : t.restore}
                                                </button>
                                                <button onClick={() => handleRelease(lot.id, 'WRITE_OFF')} disabled={processing === lot.id}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs transition-all hover:brightness-105"
                                                    style={{ background: 'rgba(185,28,28,0.12)', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.25)' }}>
                                                    <Trash2 size={11} className="inline mr-0.5" />{t.writeOff}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Card View (< 768px) */}
                    <div className="block md:hidden p-3 space-y-3">
                        {lots.map((lot: any) => (
                            <div key={lot.id} className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        {t.thLot}: {lot.lotNo}
                                    </span>
                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                        {lot.location?.locationCode || t.unassigned}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 text-xs leading-snug">
                                        {lot.product?.productName || lot.productId}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-slate-500 mt-1">
                                        <span>{t.thReceivedDate}: {formatDateLocale(lot.receivedDate)}</span>
                                        <span className="font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                            {t.quarantineCountBadge(Number(lot.qtyAvailable))}
                                        </span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                    <button
                                        onClick={() => handleRelease(lot.id, 'RESTORE')}
                                        disabled={processing === lot.id}
                                        className="w-full flex items-center justify-center py-2 text-xs font-bold rounded-lg transition-all min-h-[40px]"
                                        style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.25)' }}
                                    >
                                        {processing === lot.id ? '...' : t.restore}
                                    </button>
                                    <button
                                        onClick={() => handleRelease(lot.id, 'WRITE_OFF')}
                                        disabled={processing === lot.id}
                                        className="w-full flex items-center justify-center py-2 text-xs font-bold rounded-lg transition-all min-h-[40px]"
                                        style={{ background: 'rgba(185,28,28,0.12)', color: '#B91C1C', border: '1px solid rgba(185,28,28,0.25)' }}
                                    >
                                        <Trash2 size={12} className="inline mr-1" />
                                        {t.writeOff}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

// ── Main WMS Client Component ───────────────────────
type WMSTab = 'inventory' | 'gr' | 'do' | 'locations' | 'quarantine' | 'nxt' | 'map' | 'transfer' | 'stock-count' | 'sample' | 'replenishment'

interface Props {
    initialWarehouses?: WarehouseRow[]
    initialStats?: {
        warehouses: number; totalLots: number
        availableBottles: number; reservedBottles: number
        inventoryValue: number; quarantinedCount: number
        lowStockCount: number; slowMovingCount: number
    }
    isAdmin: boolean
}

export function WarehouseClient({ initialWarehouses, initialStats, isAdmin }: Props) {
    const { locale, formatCurrency, formatDate: formatDateLocale } = useAppLocale()
    const t = WAREHOUSE_I18N[locale]
    const [warehouses, setWarehouses] = useState<WarehouseRow[]>(initialWarehouses ?? [])
    const [stats, setStats] = useState(initialStats ?? {
        warehouses: 0, totalLots: 0,
        availableBottles: 0, reservedBottles: 0,
        inventoryValue: 0, quarantinedCount: 0,
        lowStockCount: 0, slowMovingCount: 0,
    })
    const [selectedWH, setSelectedWH] = useState<string | null>(null)
    const [lots, setLots] = useState<StockLotRow[]>([])
    const [lotsLoading, setLotsLoading] = useState(false)
    const [selectedLocations, setSelectedLocations] = useState<LocationRow[]>([])
    const [quarantineLots, setQuarantineLots] = useState<any[]>([])
    const [qLoading, setQLoading] = useState(false)
    const [qLoaded, setQLoaded] = useState(false)
    const [search, setSearch] = useState('')
    const [wineFilter, setWineFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [createWHOpen, setCreateWHOpen] = useState(false)
    const [editingWH, setEditingWH] = useState<WarehouseRow | null>(null)
    const [legalEntities, setLegalEntities] = useState<{ id: string; code: string; name: string }[]>([])

    useEffect(() => {
        getLegalEntities().then(setLegalEntities).catch(() => {})
    }, [])

    // View Mode: 'grid' (Bảng Chức Năng Trung Tâm) or 'workspace' (Giao diện tính năng chi tiết)
    const [viewMode, setViewMode] = useState<'grid' | 'workspace'>('grid')
    const [activeTab, setActiveTab] = useState<WMSTab>('inventory')
    const [sortConfig, setSortConfig] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'receivedDate', dir: 'desc' })
    const [showMobileStats, setShowMobileStats] = useState(false)

    // ── Real-time Notification Alert State ────────────────
    const [audioNotifyEnabled, setAudioNotifyEnabled] = useState(false)
    const [lastDOId, setLastDOId] = useState<string | null>(null)
    const [pendingDOCount, setPendingDOCount] = useState<number>(0)

    // Load initial notification setting from localStorage
    useEffect(() => {
        const stored = localStorage.getItem('wms_audio_notify') === 'true'
        setAudioNotifyEnabled(stored)
    }, [])

    const toggleAudioNotify = async () => {
        if (!audioNotifyEnabled) {
            const granted = await requestBrowserNotificationPermission()
            setAudioNotifyEnabled(true)
            localStorage.setItem('wms_audio_notify', 'true')
            playNotificationSound()
            if (granted) {
                toast.success(t.notifications.toastDesktopGranted, {
                    description: t.notifications.toastDesktopGrantedDesc
                })
            } else {
                toast.info(t.notifications.toastSoundOnly, {
                    description: t.notifications.toastSoundOnlyDesc
                })
            }
        } else {
            setAudioNotifyEnabled(false)
            localStorage.setItem('wms_audio_notify', 'false')
            toast.info(t.notifications.toastDisabled)
        }
    }

    // Real-time polling for pending picking orders (every 12 seconds)
    useEffect(() => {
        let isSubscribed = true

        const checkPendingDOs = async () => {
            const res = await getLatestPendingDO(selectedWH || undefined)
            if (!isSubscribed) return

            setPendingDOCount(res.count)

            if (res.latest) {
                // If a new DO is created while staff is on WMS
                if (lastDOId && lastDOId !== res.latest.id) {
                    if (audioNotifyEnabled) {
                        playNotificationSound()
                        sendDesktopNotification(t.notifications.desktopNotifyTitle(res.latest.doNo), {
                            body: `Khách hàng: ${res.latest.customerName}\nKho: ${res.latest.warehouseName} (${res.latest.lineCount} SKU)\nĐơn SO: ${res.latest.soNo}`,
                            onClickUrl: '/dashboard/warehouse?tab=do',
                        })
                    }

                    toast.warning(t.notifications.toastNewDOTitle(res.latest.doNo), {
                        description: t.notifications.toastNewDODesc(res.latest.customerName, res.latest.soNo, res.latest.lineCount),
                        action: {
                            label: t.notifications.actionGoPick,
                            onClick: () => {
                                setViewMode('workspace')
                                setActiveTab('do')
                            }
                        },
                        duration: 12000,
                    })
                }
                setLastDOId(res.latest.id)
            }
        }

        checkPendingDOs()
        const interval = setInterval(checkPendingDOs, 12000)

        return () => {
            isSubscribed = false
            clearInterval(interval)
        }
    }, [selectedWH, lastDOId, audioNotifyEnabled])

    // Auto pre-select Kho Thắng Ân Giang Văn Minh (WH-TA-GVM) by default
    useEffect(() => {
        if (!selectedWH && warehouses.length > 0) {
            const defaultWH = warehouses.find(w => w.code === 'WH-TA-GVM') || warehouses[0]
            if (defaultWH) selectWarehouse(defaultWH.id)
        }
    }, [warehouses])

    const warehouseList = warehouses.map(w => ({
        id: w.id,
        code: w.code,
        name: w.name,
        legalEntityId: w.legalEntityId,
        legalEntityCode: (w as any).legalEntityCode ?? null,
        allowSales: w.allowSales,
        allowTransfer: w.allowTransfer,
        isDefault: w.isDefault
    }))

    // 11 Unified Warehouse Feature Modules
    const wmsFeatureModules: {
        key: WMSTab
        title: string
        subtitle: string
        icon: any
        color: string
        bg: string
        badge?: number
        description: string
        actionLabel: string
    }[] = [
        {
            key: 'inventory',
            title: t.modules.inventory.title,
            subtitle: t.modules.inventory.subtitle,
            icon: Package,
            color: '#0F172A',
            bg: 'rgba(15,23,42,0.06)',
            description: t.modules.inventory.description,
            actionLabel: t.modules.inventory.actionLabel,
        },
        {
            key: 'gr',
            title: t.modules.gr.title,
            subtitle: t.modules.gr.subtitle,
            icon: PackagePlus,
            color: '#16A34A',
            bg: 'rgba(22,163,74,0.1)',
            description: t.modules.gr.description,
            actionLabel: t.modules.gr.actionLabel,
        },
        {
            key: 'do',
            title: t.modules.do.title,
            subtitle: t.modules.do.subtitle,
            icon: Truck,
            color: '#B47816',
            bg: 'rgba(180,83,9,0.15)',
            description: t.modules.do.description,
            actionLabel: t.modules.do.actionLabel,
        },
        {
            key: 'replenishment',
            title: t.modules.replenishment.title,
            subtitle: t.modules.replenishment.subtitle,
            icon: ArrowRightLeft,
            color: '#0E7490',
            bg: 'rgba(14,116,144,0.1)',
            description: t.modules.replenishment.description,
            actionLabel: t.modules.replenishment.actionLabel,
        },
        {
            key: 'transfer',
            title: t.modules.transfer.title,
            subtitle: t.modules.transfer.subtitle,
            icon: ArrowRightLeft,
            color: '#2563EB',
            bg: 'rgba(37,99,235,0.1)',
            description: t.modules.transfer.description,
            actionLabel: t.modules.transfer.actionLabel,
        },
        {
            key: 'stock-count',
            title: t.modules.stockCount.title,
            subtitle: t.modules.stockCount.subtitle,
            icon: ClipboardList,
            color: '#0891B2',
            bg: 'rgba(8,145,178,0.1)',
            description: t.modules.stockCount.description,
            actionLabel: t.modules.stockCount.actionLabel,
        },
        {
            key: 'map',
            title: t.modules.map.title,
            subtitle: t.modules.map.subtitle,
            icon: Layers,
            color: '#0284C7',
            bg: 'rgba(2,132,199,0.1)',
            description: t.modules.map.description,
            actionLabel: t.modules.map.actionLabel,
        },
        {
            key: 'locations',
            title: t.modules.locations.title,
            subtitle: t.modules.locations.subtitle,
            icon: MapPin,
            color: '#D97706',
            bg: 'rgba(217,119,6,0.1)',
            description: t.modules.locations.description,
            actionLabel: t.modules.locations.actionLabel,
        },
        {
            key: 'quarantine',
            title: t.modules.quarantine.title,
            subtitle: t.modules.quarantine.subtitle,
            icon: ShieldAlert,
            color: '#B91C1C',
            bg: 'rgba(185,28,28,0.1)',
            badge: stats.quarantinedCount,
            description: t.modules.quarantine.description,
            actionLabel: t.modules.quarantine.actionLabel,
        },
        {
            key: 'nxt',
            title: t.modules.nxt.title,
            subtitle: t.modules.nxt.subtitle,
            icon: BarChart3,
            color: '#15803D',
            bg: 'rgba(5,150,105,0.1)',
            description: t.modules.nxt.description,
            actionLabel: t.modules.nxt.actionLabel,
        },
        {
            key: 'sample',
            title: t.modules.sample.title,
            subtitle: t.modules.sample.subtitle,
            icon: Wine,
            color: '#B45309',
            bg: 'rgba(180,83,9,0.1)',
            description: t.modules.sample.description,
            actionLabel: t.modules.sample.actionLabel,
        },
    ]

    const selectWarehouse = async (id: string) => {
        if (selectedWH === id) { setSelectedWH(null); setLots([]); setSelectedLocations([]); return }
        setSelectedWH(id)
        setLotsLoading(true)
        try {
            const [data, locs] = await Promise.all([
                getStockInventory({ warehouseId: id }),
                getLocations(id),
            ])
            setLots(data)
            setSelectedLocations(locs)
        } finally {
            setLotsLoading(false)
        }
    }

    // Auto-load quarantine when tab opens
    const handleTabChange = async (tab: WMSTab) => {
        setActiveTab(tab)
        if (tab === 'quarantine' && !qLoaded) {
            setQLoading(true)
            setQuarantineLots(await getQuarantinedLots())
            setQLoaded(true)
            setQLoading(false)
        }
    }

    // Sort handler
    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
        }))
    }

    // Filter + sort lots
    const filteredLots = lots
        .filter(l =>
            (!search || l.productName.toLowerCase().includes(search.toLowerCase()) || l.skuCode.toLowerCase().includes(search.toLowerCase()) || l.lotNo.toLowerCase().includes(search.toLowerCase())) &&
            (!wineFilter || l.wineType === wineFilter) &&
            (!statusFilter || l.status === statusFilter)
        )
        .sort((a, b) => {
            const dir = sortConfig.dir === 'asc' ? 1 : -1
            const key = sortConfig.key
            if (key === 'vintage') return ((a.vintage ?? 0) - (b.vintage ?? 0)) * dir
            if (key === 'qtyBook') return ((a.qtyBook ?? a.qtyReceived) - (b.qtyBook ?? b.qtyReceived)) * dir
            if (key === 'qtyOnHand') return ((a.qtyOnHand ?? a.qtyAvailable) - (b.qtyOnHand ?? b.qtyAvailable)) * dir
            if (key === 'qtyAvailable') return (a.qtyAvailable - b.qtyAvailable) * dir
            if (key === 'value') return ((a.qtyAvailable * a.unitLandedCost) - (b.qtyAvailable * b.unitLandedCost)) * dir
            if (key === 'receivedDate') return (new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime()) * dir
            if (key === 'skuCode') return a.skuCode.localeCompare(b.skuCode) * dir
            if (key === 'productName') return a.productName.localeCompare(b.productName) * dir
            if (key === 'lotNo') return a.lotNo.localeCompare(b.lotNo) * dir
            if (key === 'locationCode') return a.locationCode.localeCompare(b.locationCode) * dir
            return 0
        })

    const formatStatCurrency = (val: number) => {
        if (val >= 1_000_000_000) {
            return `${(val / 1_000_000_000).toFixed(2)} tỷ ₫`
        }
        if (val >= 1_000_000) {
            return `${(val / 1_000_000).toFixed(1)} tr ₫`
        }
        return formatCurrency(val)
    }

    const statCards: { label: string; value: React.ReactNode; sub?: string; tone: Tone; icon: any }[] = [
        { label: t.stats.warehouses, value: stats.warehouses, sub: 'kho hoạt động', tone: 'neutral', icon: Warehouse },
        { label: t.stats.totalStock, value: stats.availableBottles.toLocaleString(), sub: `${t.bottlesUnit} khả dụng`, tone: 'success', icon: Package },
        { label: t.stats.inventoryValue, value: formatStatCurrency(stats.inventoryValue), sub: formatCurrency(stats.inventoryValue), tone: 'brand', icon: DollarSign },
        { label: t.stats.reserved, value: stats.reservedBottles.toLocaleString(), sub: `${t.bottlesUnit} giữ chỗ`, tone: 'info', icon: Box },
        { label: t.stats.lowStock, value: stats.lowStockCount, sub: stats.lowStockCount > 0 ? 'cần nhập thêm' : 'mức an toàn', tone: stats.lowStockCount > 0 ? 'warning' : 'neutral', icon: AlertTriangle },
        { label: t.stats.slowMoving, value: stats.slowMovingCount, sub: stats.slowMovingCount > 0 ? '> 90 ngày' : 'lưu thông tốt', tone: stats.slowMovingCount > 0 ? 'danger' : 'neutral', icon: Clock },
    ]

    const activeModule = wmsFeatureModules.find(m => m.key === activeTab)

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* Mobile Top Header (< 768px) */}
            <div className="block md:hidden bg-white border border-slate-200 rounded-lg p-3 shadow-2xs space-y-2.5">
                {/* Row 1: Title / Navigation & Compact Warehouse Selector */}
                <div className="flex items-center justify-between gap-2">
                    {viewMode === 'grid' ? (
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-lys-teal-soft border border-lys-teal-subtle flex items-center justify-center shrink-0">
                                <Warehouse size={18} className="text-lys-teal-strong" />
                            </div>
                            <div>
                                <h2 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5 leading-none">
                                    {t.pageTitle}
                                    <span className="text-[10px] bg-lys-teal-soft text-lys-teal-strong font-bold px-2 py-0.5 rounded-full border border-lys-teal-subtle max-w-[120px] truncate inline-block align-middle">
                                        {selectedWH ? warehouses.find(w => w.id === selectedWH)?.name ?? 'Kho' : t.allWarehousesCompact}
                                    </span>
                                </h2>
                                <p className="text-[10px] text-slate-500 mt-0.5">{t.pageSubtitle}</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <button
                                onClick={() => setViewMode('grid')}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle text-xs font-bold shrink-0 shadow-2xs active:scale-95 transition cursor-pointer"
                            >
                                <ArrowLeft size={14} /> {t.mobileMenuBtn}
                            </button>
                            <span className="text-xs font-bold text-lys-primary bg-lys-subtle border border-lys-border px-2 py-1 rounded-lg truncate">
                                {activeModule?.title}
                            </span>
                        </div>
                    )}

                    {/* Right side controls: Compact Warehouse Select & Stats Toggle */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative">
                            <select
                                value={selectedWH ?? ''}
                                onChange={e => {
                                    const val = e.target.value
                                    if (!val) {
                                        setSelectedWH(null)
                                        setLots([])
                                        setSelectedLocations([])
                                    } else {
                                        selectWarehouse(val)
                                    }
                                }}
                                className="appearance-none pl-2 pr-6 py-1.5 rounded-lg text-base sm:text-[11px] font-extrabold outline-none cursor-pointer bg-slate-50 border border-slate-300 text-slate-900 focus:border-lys-teal-strong max-w-[140px] truncate"
                            >
                                <option value="">{t.allWarehousesCount(stats.warehouses)}</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.name} ({w.totalStock.toLocaleString()} {t.bottlesUnit})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={12} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                        </div>

                        {/* Stat Drawer Toggle — ONLY ON MAIN GRID SCREEN */}
                        {viewMode === 'grid' && (
                            <button
                                onClick={() => setShowMobileStats(!showMobileStats)}
                                className={`p-1.5 rounded-lg border text-xs font-bold transition flex items-center justify-center cursor-pointer ${
                                    showMobileStats
                                        ? 'bg-amber-50 border-amber-300 text-amber-700'
                                        : 'bg-slate-50 border-slate-200 text-slate-600'
                                }`}
                                title="Bật/tắt chỉ số thống kê kho"
                            >
                                <BarChart3 size={15} />
                            </button>
                        )}
                    </div>
                </div>

                {/* Collapsible Mobile Stats Drawer — ONLY ON MAIN GRID SCREEN */}
                {viewMode === 'grid' && showMobileStats && (
                    <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        {statCards.map(s => (
                            <div key={s.label} className="p-2 rounded-lg bg-slate-50 border border-slate-200/80 flex flex-col items-center justify-center text-center">
                                <div className="flex items-center gap-1 text-[9px] uppercase font-bold text-slate-500">
                                    <s.icon size={11} className="text-slate-600" />
                                    <span className="truncate">{s.label}</span>
                                </div>
                                <span className="text-[11px] font-bold font-mono mt-0.5 text-slate-900">
                                    {s.value}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Desktop Top Header (>= 768px) */}
            <div className="hidden md:block p-3.5 rounded-lg shadow-2xs bg-white border border-slate-200">
                <div className="flex flex-row items-center justify-between gap-3">
                    {/* Left: Title & Active Breadcrumb */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className="text-base font-extrabold flex items-center gap-2 hover:opacity-85 transition cursor-pointer text-slate-900"
                            title="Về Bảng Chức Năng Kho"
                        >
                            <div className="w-8 h-8 rounded-lg bg-lys-teal-soft border border-lys-teal-subtle flex items-center justify-center shrink-0">
                                <Warehouse size={18} className="text-lys-teal-strong" />
                            </div>
                            <span>{t.pageTitle}</span>
                        </button>

                        <Badge tone="neutral" className="text-xs font-semibold">
                            {selectedWH ? warehouses.find(w => w.id === selectedWH)?.name ?? 'Kho' : t.allWarehousesCompact}
                        </Badge>

                        {viewMode === 'workspace' && (
                            <div className="flex items-center gap-2 ml-1">
                                <ChevronRight size={14} className="text-slate-400" />
                                <Badge tone="brand" className="text-xs font-bold">
                                    {activeModule?.title}
                                </Badge>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setViewMode('grid')}
                                    className="ml-1 text-xs gap-1"
                                >
                                    <ArrowLeft size={13} /> {t.backToMenu}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Right Action Group: Warehouse Selector Dropdown, Notification Alert Toggle & Create Warehouse */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={toggleAudioNotify}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold shadow-2xs transition-all cursor-pointer border ${
                                audioNotifyEnabled
                                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 hover:bg-emerald-500/20'
                                    : 'bg-slate-100 border-slate-300 text-slate-600 hover:bg-slate-200'
                            }`}
                            title={audioNotifyEnabled ? t.notifications.tooltipOn : t.notifications.tooltipOff}
                        >
                            {audioNotifyEnabled ? (
                                <>
                                    <BellRing size={14} className="text-emerald-600 animate-pulse shrink-0" />
                                    <span>{t.notifications.titleOn}</span>
                                    {pendingDOCount > 0 && (
                                        <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono font-extrabold ml-0.5">
                                            {pendingDOCount}
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <BellOff size={14} className="text-slate-400 shrink-0" />
                                    <span>{t.notifications.titleOff}</span>
                                </>
                            )}
                        </button>

                        <div className="relative">
                            <select
                                value={selectedWH ?? ''}
                                onChange={e => {
                                    const val = e.target.value
                                    if (!val) {
                                        setSelectedWH(null)
                                        setLots([])
                                        setSelectedLocations([])
                                    } else {
                                        selectWarehouse(val)
                                    }
                                }}
                                className="appearance-none pl-3 pr-8 py-1.5 rounded-lg text-xs font-semibold outline-none cursor-pointer bg-slate-50 border border-slate-300 text-slate-900 focus:border-lys-teal-strong max-w-[210px] xl:max-w-[280px] truncate"
                            >
                                <option value="">{t.allWarehousesCount(stats.warehouses)}</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>
                                        {w.name} {w.allowSales === false ? '[Chỉ Điều Chuyển]' : w.isDefault ? '[Mặc Định]' : ''} ({w.totalStock.toLocaleString()} {t.bottlesUnit})
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500" />
                        </div>

                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => setCreateWHOpen(true)}
                            className="gap-1.5"
                        >
                            <Plus size={14} /> {t.createWarehouseBtn}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Desktop Stats Row (>= 768px, on main grid view) */}
            {viewMode === 'grid' && (
                <div className="hidden md:grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    {statCards.map(s => (
                        <StatCard
                            key={s.label}
                            label={s.label}
                            value={s.value}
                            sub={s.sub}
                            icon={s.icon}
                            tone={s.tone}
                            className="p-3 [&_.text-xl]:text-base sm:[&_.text-xl]:text-lg [&_.text-xl]:leading-tight"
                        />
                    ))}
                </div>
            )}

            {/* View Mode 1: Central Features Menu */}
            {viewMode === 'grid' && (
                <div className="space-y-4">
                    {/* Mobile Unified Feature Grid (< 768px) */}
                    <div className="block md:hidden space-y-3 pb-20">
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs uppercase tracking-wider font-extrabold text-slate-500">
                                {t.menuTitle}
                            </p>
                            <span className="text-[10px] font-bold text-lys-teal-strong bg-lys-teal-soft border border-lys-teal-subtle px-2 py-0.5 rounded-full">
                                {t.modulesCount(wmsFeatureModules.length)}
                            </span>
                        </div>

                        {/* Single Unified 2-Column Mobile Grid for All Modules */}
                        <div className="grid grid-cols-2 gap-2.5">
                            {wmsFeatureModules.map(mod => {
                                const Icon = mod.icon
                                return (
                                    <button
                                        key={mod.key}
                                        onClick={() => { handleTabChange(mod.key); setViewMode('workspace') }}
                                        className="p-3 bg-white border border-slate-200 rounded-lg text-left active:scale-95 transition shadow-2xs flex flex-col justify-between"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: mod.bg, color: mod.color }}>
                                                <Icon size={16} />
                                            </div>
                                            {mod.badge !== undefined && mod.badge > 0 && (
                                                <span className="text-[9px] px-1.5 py-0.5 rounded-full font-extrabold bg-rose-600 text-white">
                                                    {mod.badge}
                                                </span>
                                            )}
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-slate-900 leading-snug">{mod.title}</div>
                                            <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{mod.subtitle}</div>
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Desktop Grid View (>= 768px) */}
                    <div className="hidden md:block space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs uppercase tracking-wider font-extrabold text-slate-500">
                                {t.menuTitle}
                            </p>
                            <span className="text-xs text-slate-500 font-medium">
                                {t.modulesCount(wmsFeatureModules.length)}
                            </span>
                        </div>

                        {/* Feature Cards Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                            {wmsFeatureModules.map(mod => {
                                const Icon = mod.icon
                                return (
                                    <div
                                        key={mod.key}
                                        onClick={() => {
                                            handleTabChange(mod.key)
                                            setViewMode('workspace')
                                        }}
                                        className="p-4 sm:p-5 rounded-lg bg-white border border-slate-200 flex flex-col justify-between cursor-pointer transition-all hover:border-lys-teal hover:shadow-md group shadow-2xs"
                                    >
                                        <div>
                                            <div className="flex items-start justify-between mb-3">
                                                <div
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                                                    style={{ background: mod.bg, color: mod.color }}
                                                >
                                                    <Icon size={20} />
                                                </div>
                                                {mod.badge !== undefined && mod.badge > 0 && (
                                                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-extrabold bg-rose-600 text-white shadow-2xs">
                                                        {t.modules.quarantine.badgeAlerts(mod.badge)}
                                                    </span>
                                                )}
                                            </div>

                                            <h4 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-lys-teal-strong transition-colors">
                                                {mod.title}
                                            </h4>
                                            <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed line-clamp-2">
                                                {mod.subtitle}
                                            </p>
                                        </div>

                                        <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold text-lys-teal-strong border-t border-slate-100 group-hover:translate-x-0.5 transition-transform">
                                            <span>{mod.actionLabel}</span>
                                            <ChevronRight size={14} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ VIEW MODE 2: MÀN HÌNH LÀM VIỆC CHI TIẾT (WORKSPACE VIEW) ═══ */}
            {viewMode === 'workspace' && (
                <div className="space-y-4 pb-24 md:pb-8">
                    {/* ═══ WORKSPACE TOP SUB-TAB BAR (DESKTOP & TABLET) ═══ */}
                    <div className="hidden md:flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1.5 bg-white border border-slate-200 rounded-lg shadow-2xs">
                        <button
                            onClick={() => setViewMode('grid')}
                            className="px-2.5 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 flex items-center gap-1 shrink-0 transition cursor-pointer"
                            title={t.backToMenu}
                        >
                            <LayoutGrid size={14} />
                            <span>Menu</span>
                        </button>
                        <div className="h-4 w-px bg-slate-200 mx-0.5 shrink-0" />
                        {wmsFeatureModules.map(mod => {
                            const Icon = mod.icon
                            const isActive = activeTab === mod.key
                            return (
                                <button
                                    key={mod.key}
                                    onClick={() => handleTabChange(mod.key)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition shrink-0 cursor-pointer',
                                        isActive
                                            ? 'bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle shadow-2xs font-bold'
                                            : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 font-semibold border border-transparent'
                                    )}
                                >
                                    <Icon size={14} style={{ color: isActive ? undefined : mod.color }} />
                                    <span>{mod.title}</span>
                                    {mod.badge !== undefined && mod.badge > 0 && (
                                        <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-rose-600 text-white">
                                            {mod.badge}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>

                    {/* NXT — Stock Movement Report Tab */}
                    {activeTab === 'nxt' && <StockMovementTab warehouses={warehouseList} selectedWarehouseId={selectedWH ?? undefined} />}

                    {/* 2D Warehouse Map Tab */}
                    {activeTab === 'map' && <WarehouseMapTab warehouses={warehouseList} selectedWarehouseId={selectedWH} isAdmin={isAdmin} />}

                    {/* GR Tab */}
                    {activeTab === 'gr' && <GoodsReceiptTab warehouses={warehouseList} />}

                    {/* DO Tab */}
                    {activeTab === 'do' && <DeliveryOrderTab warehouses={warehouseList} />}

                    {/* Transfer Tab — Gộp mới */}
                    {activeTab === 'transfer' && <TransfersTab />}

                    {/* Stock Count Tab — Gộp mới */}
                    {activeTab === 'stock-count' && <StockCountTab />}

                    {/* Replenishment — Gợi Ý Điều Chuyển Kho */}
                    {activeTab === 'replenishment' && <ReplenishmentTab />}

                    {/* Sample Wine Inventory Tab — Mới */}
                    {activeTab === 'sample' && <SampleInventoryTab />}

                    {/* Quarantine Tab — auto-loads */}
                    {activeTab === 'quarantine' && (
                        <QuarantinePanel lots={quarantineLots} loading={qLoading} onRefresh={async () => {
                            setQLoading(true)
                            setQuarantineLots(await getQuarantinedLots())
                            setQLoading(false)
                        }} />
                    )}

                    {/* Locations Tab — Full Width */}
                    {activeTab === 'locations' && (
                        <div className="w-full">
                            {selectedWH ? (
                                <LocationManager
                                    key={selectedWH}
                                    warehouseId={selectedWH}
                                    warehouseName={warehouses.find(w => w.id === selectedWH)?.name ?? ''}
                                    initialLocations={selectedLocations}
                                />
                            ) : (
                                <div className="flex flex-col items-center py-20 gap-3 rounded-lg shadow-xs"
                                    style={{ border: '1px dashed #CBD5E1', background: '#FFFFFF' }}>
                                    <MapPin size={36} style={{ color: '#94A3B8' }} />
                                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                                        {t.locationsPanel.promptSelectWh}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Inventory Tab — Full Width */}
                    {activeTab === 'inventory' && (
                        <div className="w-full space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#64748B' }}>
                                    {t.table.whInventoryTitle(selectedWH ? warehouses.find(w => w.id === selectedWH)?.name : undefined)}
                                </p>
                                {selectedWH && (() => {
                                    const totalBookQty = filteredLots.reduce((sum, l) => sum + (l.qtyBook ?? l.qtyReceived ?? 0), 0)
                                    const totalOnHandQty = filteredLots.reduce((sum, l) => sum + (l.qtyOnHand ?? l.qtyAvailable ?? 0), 0)
                                    const totalAvailableQty = filteredLots.reduce((sum, l) => sum + (l.qtyAvailable ?? 0), 0)
                                    const totalReservedQty = filteredLots.reduce((sum, l) => sum + (l.qtyReserved ?? 0), 0)
                                    const totalVarianceQty = totalOnHandQty - totalBookQty

                                    return (
                                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 max-w-full">
                                            <span className="text-xs px-2.5 py-1 rounded-lg font-mono font-bold shrink-0" style={{ color: '#B47816', background: 'rgba(180,83,9,0.15)' }}>
                                                {t.lotsCount(filteredLots.length)}
                                            </span>
                                            <span className="text-xs px-2.5 py-1 rounded-lg font-mono font-bold text-slate-700 bg-slate-100 border border-slate-200 shrink-0">
                                                {t.table.tagBook} <strong>{totalBookQty.toLocaleString()}</strong>{t.bottlesUnit.charAt(0)}
                                            </span>
                                            <span className="text-xs px-2.5 py-1 rounded-lg font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 shrink-0">
                                                {t.table.tagOnHand} <strong>{totalOnHandQty.toLocaleString()}</strong>{t.bottlesUnit.charAt(0)}
                                            </span>
                                            <span className="text-xs px-2.5 py-1 rounded-lg font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200 shrink-0">
                                                {t.table.tagAvailable} <strong>{totalAvailableQty.toLocaleString()}</strong>{t.bottlesUnit.charAt(0)}
                                            </span>
                                            {totalReservedQty > 0 && (
                                                <span className="text-xs px-2.5 py-1 rounded-lg font-mono font-bold text-blue-800 bg-blue-50 border border-blue-200 shrink-0">
                                                    {t.table.tagReserved} <strong>{totalReservedQty.toLocaleString()}</strong>{t.bottlesUnit.charAt(0)}
                                                </span>
                                            )}
                                            {totalVarianceQty !== 0 && (
                                                <span className={`text-xs px-2.5 py-1 rounded-lg font-mono font-black border shrink-0 ${
                                                    totalVarianceQty < 0 ? 'text-rose-700 bg-rose-50 border-rose-300' : 'text-amber-700 bg-amber-50 border-amber-300'
                                                }`}>
                                                    {t.table.tagVariance} {totalVarianceQty > 0 ? `+${totalVarianceQty}` : totalVarianceQty}{t.bottlesUnit.charAt(0)}
                                                </span>
                                            )}
                                            <button onClick={() => {
                                                if (filteredLots.length === 0) return
                                                const headers = locale === 'en'
                                                    ? ['Stock Lot', 'Product Name', 'SKU', 'Vintage', 'Location', 'Book Qty', 'On-hand Qty', 'Available Qty', 'Reserved Qty', 'Variance', 'Cost (VND)', 'Lot Value (VND)', 'Received Date', 'Status']
                                                    : ['Lô Hàng', 'Sản Phẩm', 'SKU', 'Vintage', 'Vị Trí', 'Tồn Sổ Sách', 'Tồn On-hand', 'Khả Dụng', 'Đã Giữ Chỗ', 'Chênh Lệch', 'Giá Vốn (VND)', 'Giá Trị Lô (VND)', 'Ngày Nhập', 'Trạng Thái']
                                                const rows = filteredLots.map(l => [
                                                    l.lotNo, l.productName, l.skuCode, l.vintage ?? 'NV', l.locationCode,
                                                    l.qtyBook ?? l.qtyReceived, l.qtyOnHand ?? l.qtyAvailable, l.qtyAvailable, l.qtyReserved ?? 0, l.variance ?? 0,
                                                    l.unitLandedCost, l.qtyAvailable * l.unitLandedCost,
                                                    formatDateLocale(l.receivedDate), getLotStatusLabel(l.status, locale),
                                                ])
                                                const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
                                                const BOM = '\uFEFF'
                                                const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
                                                const url = URL.createObjectURL(blob)
                                                const a = document.createElement('a')
                                                a.href = url
                                                a.download = locale === 'en'
                                                    ? `stock-inventory-book-vs-onhand-${new Date().toISOString().slice(0, 10)}.csv`
                                                    : `ton-kho-so-sach-vs-onhand-${new Date().toISOString().slice(0, 10)}.csv`
                                                a.click()
                                                URL.revokeObjectURL(url)
                                            }} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all font-bold shadow-xs cursor-pointer shrink-0"
                                                style={{ color: '#0F172A', background: '#F1F5F9', border: '1px solid #CBD5E1' }}>
                                                <Download size={13} /> {t.table.exportCsv}
                                            </button>
                                        </div>
                                    )
                                })()}
                            </div>

                            {selectedWH && (
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                                        <input placeholder={t.table.searchPlaceholder} value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-base sm:text-sm outline-none font-medium"
                                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }} />
                                    </div>
                                    <div className="flex gap-2">
                                        <select value={wineFilter} onChange={e => setWineFilter(e.target.value)}
                                            className="flex-1 sm:flex-none px-3 py-2.5 rounded-lg text-base sm:text-sm outline-none font-medium"
                                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: wineFilter ? '#0F172A' : '#64748B' }}>
                                            <option value="">{t.table.allWineTypes}</option>
                                            <option value="RED">{t.wineTypes.RED}</option>
                                            <option value="WHITE">{t.wineTypes.WHITE}</option>
                                            <option value="ROSE">{t.wineTypes.ROSE}</option>
                                            <option value="SPARKLING">{t.wineTypes.SPARKLING}</option>
                                            <option value="FORTIFIED">{t.wineTypes.FORTIFIED}</option>
                                            <option value="DESSERT">{t.wineTypes.DESSERT}</option>
                                        </select>
                                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                            className="flex-1 sm:flex-none px-3 py-2.5 rounded-lg text-base sm:text-sm outline-none font-medium"
                                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: statusFilter ? '#0F172A' : '#64748B' }}>
                                            <option value="">{t.table.allStatuses}</option>
                                            <option value="AVAILABLE">{t.lotStatuses.AVAILABLE}</option>
                                            <option value="RESERVED">{t.lotStatuses.RESERVED}</option>
                                            <option value="QUARANTINE">{t.lotStatuses.QUARANTINE}</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {lotsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin text-lys-teal-strong" />
                                </div>
                            ) : selectedWH ? (
                                <StockTable lots={filteredLots} sortConfig={sortConfig} onSort={handleSort} />
                            ) : (
                                <div className="flex flex-col items-center py-20 gap-3 rounded-lg shadow-xs bg-white border border-dashed border-slate-300">
                                    <Warehouse size={36} className="text-slate-400" />
                                    <p className="text-sm font-semibold text-slate-800">
                                        {t.table.selectWhPrompt}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* FLOATING MOBILE BOTTOM NAVIGATION BAR FOR WMS - DESIGN SYSTEM THEME */}
            <div className="block md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 p-2 z-40 shadow-2xl">
                <div className="max-w-md mx-auto grid grid-cols-5 gap-1 text-center">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`py-2 rounded-lg flex flex-col items-center gap-1 font-bold text-[9px] transition ${viewMode === 'grid' ? 'bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-900 border border-transparent'}`}
                    >
                        <LayoutGrid size={16} />
                        {t.bottomNav.menu}
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab('inventory')
                            setViewMode('workspace')
                        }}
                        className={`py-2 rounded-lg flex flex-col items-center gap-1 font-bold text-[9px] transition ${viewMode === 'workspace' && activeTab === 'inventory' ? 'bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-900 border border-transparent'}`}
                    >
                        <Package size={16} />
                        {t.bottomNav.inventory}
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab('do')
                            setViewMode('workspace')
                        }}
                        className={`py-2 rounded-lg flex flex-col items-center gap-1 font-bold text-[9px] transition ${viewMode === 'workspace' && activeTab === 'do' ? 'bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-900 border border-transparent'}`}
                    >
                        <Truck size={16} />
                        {t.bottomNav.do}
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab('gr')
                            setViewMode('workspace')
                        }}
                        className={`py-2 rounded-lg flex flex-col items-center gap-1 font-bold text-[9px] transition ${viewMode === 'workspace' && activeTab === 'gr' ? 'bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-900 border border-transparent'}`}
                    >
                        <PackagePlus size={16} />
                        {t.bottomNav.gr}
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab('stock-count')
                            setViewMode('workspace')
                        }}
                        className={`py-2 rounded-lg flex flex-col items-center gap-1 font-bold text-[9px] transition ${viewMode === 'workspace' && activeTab === 'stock-count' ? 'bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle shadow-2xs font-extrabold' : 'text-slate-500 hover:text-slate-900 border border-transparent'}`}
                    >
                        <ClipboardList size={16} />
                        {t.bottomNav.stockCount}
                    </button>
                </div>
            </div>

            <CreateWarehouseModal
                open={createWHOpen}
                onClose={() => setCreateWHOpen(false)}
                onCreated={async () => {
                    setCreateWHOpen(false)
                    const { getWarehouses } = await import('./actions')
                    setWarehouses(await getWarehouses())
                }}
            />
        </div>
    )
}
