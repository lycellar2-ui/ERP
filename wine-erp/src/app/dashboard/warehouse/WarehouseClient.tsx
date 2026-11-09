'use client'

import { useState, useEffect, useMemo, useRef, Fragment } from 'react'
import {
    Warehouse, Package, BarChart3, Plus, Search, MapPin,
    Thermometer, Box, X, Save, Loader2, AlertCircle, CheckCircle2,
    ChevronRight, Layers, PackagePlus, Truck, ShieldAlert, Trash2,
    DollarSign, AlertTriangle, Clock, Wine, ArrowUpDown, ArrowUp, ArrowDown,
    TrendingDown, Download, ChevronDown, ChevronUp, RotateCcw, Filter,
    ArrowRightLeft, ClipboardList, LayoutGrid, ArrowLeft, RefreshCw, BellRing, BellOff, Volume2,
    Sparkles, ClipboardCheck
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
import { PosmInventoryTab } from './PosmInventoryTab'
import { InspectionTab } from './InspectionTab'
import { formatFriendlyLocationName } from '../stock-count/location-names'

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

                {error && <div className="inline-block text-xs px-3 py-2 rounded-lg whitespace-nowrap shrink-0" style={{ background: 'rgba(185,28,28,0.1)', color: '#B91C1C' }}>{error}</div>}

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
        <span className="inline-block text-[10px] px-1.5 py-0.5 rounded-full font-semibold whitespace-nowrap shrink-0"
            style={{ color, background: `${color}15` }}>
            {days}{suffix}
        </span>
    )
}

// ── Stock table ───────────────────────────────────
function StockTable({
    lots,
    sortConfig,
    onSort,
    canSeeCost = true,
    groupMode = 'lot',
    showWarehouseColumn = false,
    activeSkuFilter = '',
    activeVintageFilter = '',
    activeLocationFilter = '',
    onFilterSku,
    onFilterVintage,
    onFilterLocation,
    page = 1,
    pageSize = 50,
    onPageChange,
    onPageSizeChange,
}: {
    lots: StockLotRow[]
    sortConfig: { key: string; dir: 'asc' | 'desc' }
    onSort: (key: string) => void
    canSeeCost?: boolean
    groupMode?: 'lot' | 'sku_vintage'
    showWarehouseColumn?: boolean
    activeSkuFilter?: string
    activeVintageFilter?: string
    activeLocationFilter?: string
    onFilterSku?: (sku: string) => void
    onFilterVintage?: (vintage: string) => void
    onFilterLocation?: (locCode: string) => void
    page?: number
    pageSize?: number
    onPageChange?: (p: number) => void
    onPageSizeChange?: (s: number) => void
}) {
    const { locale, formatCurrency } = useAppLocale()
    const t = WAREHOUSE_I18N[locale].table
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

    const toggleGroup = (groupKey: string) => {
        setExpandedGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }))
    }

    // Build grouped rows when groupMode === 'sku_vintage'
    const groupedRows = useMemo(() => {
        if (groupMode !== 'sku_vintage') return []
        const map = new Map<string, {
            key: string
            skuCode: string
            productName: string
            country: string
            wineType: string
            vintage: number | null
            qtyBook: number
            qtyOnHand: number
            qtyAvailable: number
            qtyReserved: number
            variance: number
            totalValue: number
            locations: { locationCode: string; friendlyLoc: string; warehouseName: string; qtyAvailable: number; qtyOnHand: number }[]
            lots: StockLotRow[]
        }>()

        for (const lot of lots) {
            const vKey = lot.vintage ? String(lot.vintage) : 'NV'
            const gKey = `${lot.skuCode}__${vKey}`
            const book = lot.qtyBook ?? lot.qtyReceived
            const onHand = lot.qtyOnHand ?? lot.qtyAvailable
            const val = lot.qtyAvailable * lot.unitLandedCost
            const friendlyLoc = formatFriendlyLocationName({ locationCode: lot.locationCode })

            const existing = map.get(gKey)
            if (!existing) {
                map.set(gKey, {
                    key: gKey,
                    skuCode: lot.skuCode,
                    productName: lot.productName,
                    country: lot.country,
                    wineType: lot.wineType,
                    vintage: lot.vintage,
                    qtyBook: book,
                    qtyOnHand: onHand,
                    qtyAvailable: lot.qtyAvailable,
                    qtyReserved: lot.qtyReserved ?? 0,
                    variance: onHand - book,
                    totalValue: val,
                    locations: [{
                        locationCode: lot.locationCode,
                        friendlyLoc,
                        warehouseName: lot.warehouseName,
                        qtyAvailable: lot.qtyAvailable,
                        qtyOnHand: onHand,
                    }],
                    lots: [lot],
                })
            } else {
                existing.qtyBook += book
                existing.qtyOnHand += onHand
                existing.qtyAvailable += lot.qtyAvailable
                existing.qtyReserved += (lot.qtyReserved ?? 0)
                existing.variance = existing.qtyOnHand - existing.qtyBook
                existing.totalValue += val
                existing.lots.push(lot)
                const locEntry = existing.locations.find(
                    loc => loc.locationCode === lot.locationCode && loc.warehouseName === lot.warehouseName
                )
                if (locEntry) {
                    locEntry.qtyAvailable += lot.qtyAvailable
                    locEntry.qtyOnHand += onHand
                } else {
                    existing.locations.push({
                        locationCode: lot.locationCode,
                        friendlyLoc,
                        warehouseName: lot.warehouseName,
                        qtyAvailable: lot.qtyAvailable,
                        qtyOnHand: onHand,
                    })
                }
            }
        }

        const arr = Array.from(map.values())
        const dir = sortConfig.dir === 'asc' ? 1 : -1
        const key = sortConfig.key
        return arr.sort((a, b) => {
            if (key === 'vintage') return ((a.vintage ?? 0) - (b.vintage ?? 0)) * dir
            if (key === 'qtyBook') return (a.qtyBook - b.qtyBook) * dir
            if (key === 'qtyOnHand') return (a.qtyOnHand - b.qtyOnHand) * dir
            if (key === 'qtyAvailable') return (a.qtyAvailable - b.qtyAvailable) * dir
            if (key === 'value') return (a.totalValue - b.totalValue) * dir
            if (key === 'skuCode') return a.skuCode.localeCompare(b.skuCode) * dir
            if (key === 'productName') return a.productName.localeCompare(b.productName) * dir
            if (key === 'locationCode') return (a.locations[0]?.locationCode ?? '').localeCompare(b.locations[0]?.locationCode ?? '') * dir
            return a.skuCode.localeCompare(b.skuCode) * dir
        })
    }, [lots, groupMode, sortConfig])

    if (lots.length === 0) {
        return (
            <div className="flex flex-col items-center py-16 gap-3 rounded-lg border border-dashed border-slate-300 bg-white">
                <Box size={32} className="text-slate-400" />
                <p className="text-sm font-semibold text-slate-900">{t.emptyTitle}</p>
                <p className="text-xs text-slate-500">{t.emptySubtitle}</p>
            </div>
        )
    }

    const totalItems = groupMode === 'sku_vintage' ? groupedRows.length : lots.length
    const effectivePageSize = pageSize <= 0 ? totalItems : pageSize
    const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize))
    const safePage = Math.min(page, totalPages)
    const startIdx = (safePage - 1) * effectivePageSize
    const endIdx = Math.min(startIdx + effectivePageSize, totalItems)

    const pagedLots = groupMode === 'lot' ? lots.slice(startIdx, endIdx) : []
    const pagedGroups = groupMode === 'sku_vintage' ? groupedRows.slice(startIdx, endIdx) : []

    const headers = [
        { key: 'skuCode', label: t.thSku, align: 'left' as const, width: 'w-[105px]' },
        { key: 'productName', label: t.thProduct, align: 'left' as const, width: '' },
        { key: 'vintage', label: t.thVintage, align: 'center' as const, width: 'w-[92px]' },
        { key: 'locationCode', label: groupMode === 'sku_vintage' ? 'Vị Trí Phân Bổ' : t.thLocation, align: 'left' as const, width: showWarehouseColumn ? 'w-[240px]' : 'w-[205px]' },
        { key: 'qtyBook', label: t.thBookQty, align: 'center' as const, width: 'w-[92px]' },
        { key: 'qtyOnHand', label: t.thOnHandQty, align: 'center' as const, width: 'w-[96px]' },
        { key: 'qtyAvailable', label: t.thAvailable, align: 'center' as const, width: 'w-[108px]' },
        ...(canSeeCost ? [{ key: 'value', label: t.thLotValue, align: 'right' as const, width: 'w-[135px]' }] : []),
    ]

    const renderSortIcon = (colKey: string) => {
        if (sortConfig.key !== colKey) {
            return <ArrowUpDown size={11} className="text-slate-400 opacity-45 group-hover:opacity-100 transition-opacity shrink-0" />
        }
        return sortConfig.dir === 'asc'
            ? <ArrowUp size={12} className="text-lys-teal-strong shrink-0" />
            : <ArrowDown size={12} className="text-lys-teal-strong shrink-0" />
    }

    return (
        <div className="rounded-lg overflow-hidden shadow-xs border border-slate-200 bg-white">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full table-fixed text-left border-collapse text-xs">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            {headers.map(h => {
                                const isSorted = sortConfig.key === h.key
                                return (
                                    <th
                                        key={h.key}
                                        onClick={() => onSort(h.key)}
                                        className={cn(
                                            'group px-3 py-2.5 text-[11px] uppercase tracking-wider font-extrabold cursor-pointer select-none whitespace-nowrap transition-colors hover:bg-slate-100/80',
                                            h.align === 'center' ? 'text-center' : h.align === 'right' ? 'text-right' : 'text-left',
                                            h.width,
                                            isSorted ? 'text-lys-teal-strong bg-lys-teal-soft/40' : 'text-slate-600'
                                        )}
                                    >
                                        <span className={cn(
                                            'inline-flex items-center gap-1',
                                            h.align === 'center' && 'justify-center',
                                            h.align === 'right' && 'justify-end'
                                        )}>
                                            {h.label}
                                            {renderSortIcon(h.key)}
                                        </span>
                                    </th>
                                )
                            })}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                        {groupMode === 'lot' ? (
                            pagedLots.map(lot => {
                                const countryTag = lot.country ? `[${lot.country}]` : ''
                                const wineColor = WINE_TYPE_COLOR[lot.wineType] ?? '#64748B'
                                const lotValue = lot.qtyAvailable * lot.unitLandedCost
                                const bookQty = lot.qtyBook ?? lot.qtyReceived
                                const onHandQty = lot.qtyOnHand ?? lot.qtyAvailable
                                const variance = lot.variance ?? (onHandQty - bookQty)
                                const friendlyLoc = formatFriendlyLocationName({ locationCode: lot.locationCode })
                                const vStr = lot.vintage ? String(lot.vintage) : 'NV'
                                const isSkuActive = activeSkuFilter === lot.skuCode
                                const isVintageActive = activeVintageFilter === vStr
                                const isLocActive = activeLocationFilter === lot.locationCode

                                return (
                                    <tr key={lot.id} className="group transition-colors hover:bg-slate-50/80">
                                        {/* Cột SKU — Click để lọc nhanh theo SKU */}
                                        <td className="px-3 py-2.5 whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => onFilterSku?.(isSkuActive ? '' : lot.skuCode)}
                                                title="Bấm để lọc theo mã SKU này"
                                                className={cn(
                                                    'font-mono font-extrabold text-xs px-2 py-0.5 rounded transition-all cursor-pointer',
                                                    isSkuActive
                                                        ? 'bg-lys-teal-strong text-white shadow-2xs'
                                                        : 'text-slate-900 bg-slate-100/80 hover:bg-lys-teal-soft hover:text-lys-teal-strong border border-slate-200/80'
                                                )}
                                            >
                                                {lot.skuCode}
                                            </button>
                                        </td>

                                        {/* Cột Sản Phẩm */}
                                        <td className="px-3 py-2.5 min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                {countryTag && <span className="shrink-0 text-[10px] font-mono font-semibold text-slate-500">{countryTag}</span>}
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ background: wineColor }} />
                                                <p className="font-bold text-slate-900 truncate text-xs" title={lot.productName}>{lot.productName}</p>
                                            </div>
                                        </td>

                                        {/* Cột Vintage — Click để lọc nhanh theo Niên vụ */}
                                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => onFilterVintage?.(isVintageActive ? '' : vStr)}
                                                title="Bấm để lọc theo niên vụ (Vintage) này"
                                                className={cn(
                                                    'text-xs font-bold px-2 py-0.5 rounded-md font-mono inline-block transition-all cursor-pointer border',
                                                    isVintageActive
                                                        ? 'bg-amber-600 text-white border-amber-700 shadow-2xs'
                                                        : lot.vintage
                                                            ? 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100'
                                                            : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                                )}
                                            >
                                                {vStr}
                                            </button>
                                        </td>

                                        {/* Cột Vị Trí — Click để lọc nhanh theo Vị trí */}
                                        <td className="px-3 py-2.5 whitespace-nowrap overflow-hidden">
                                            <div className="flex flex-col items-start gap-0.5 min-w-0">
                                                <button
                                                    type="button"
                                                    onClick={() => onFilterLocation?.(isLocActive ? '' : lot.locationCode)}
                                                    title={`Vị trí: ${friendlyLoc} (${lot.locationCode}) — Bấm để lọc vị trí này`}
                                                    className={cn(
                                                        'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md truncate max-w-full transition-all cursor-pointer border',
                                                        isLocActive
                                                            ? 'bg-lys-teal-strong text-white border-lys-teal-strong shadow-2xs'
                                                            : 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-lys-teal-soft hover:text-lys-teal-strong hover:border-lys-teal-subtle'
                                                    )}
                                                >
                                                    <MapPin size={11} className="shrink-0 opacity-75" />
                                                    <span className="truncate">{friendlyLoc}</span>
                                                </button>
                                                {showWarehouseColumn && lot.warehouseName && (
                                                    <span className="text-[10px] text-slate-500 font-medium truncate max-w-full pl-0.5">
                                                        {lot.warehouseName}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {/* Cột 1: Sổ Sách */}
                                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                            <span className="text-xs font-bold font-mono text-slate-700">
                                                {bookQty.toLocaleString()}
                                            </span>
                                        </td>

                                        {/* Cột 2: Thực Tế */}
                                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                            <div className="flex flex-col items-center">
                                                <span className="text-xs font-bold font-mono text-slate-900">
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

                                        {/* Cột 3: Khả Dụng */}
                                        <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                            <div className="flex flex-col items-center">
                                                <span className={cn(
                                                    'text-xs font-extrabold font-mono px-2.5 py-0.5 rounded-md border',
                                                    lot.qtyAvailable > 0
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-slate-100 text-slate-500 border-slate-200'
                                                )}>
                                                    {lot.qtyAvailable.toLocaleString()}
                                                </span>
                                                {lot.qtyReserved > 0 && (
                                                    <span className="text-[9px] text-blue-600 font-bold mt-0.5">
                                                        {t.reservedLabel(lot.qtyReserved)}
                                                    </span>
                                                )}
                                            </div>
                                        </td>

                                        {canSeeCost && (
                                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                {lotValue > 0 ? (
                                                    <span className="text-xs font-mono font-semibold text-slate-800">
                                                        {formatCurrency(lotValue)}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400">—</span>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                )
                            })
                        ) : (
                            pagedGroups.map(group => {
                                const isExpanded = !!expandedGroups[group.key]
                                const countryTag = group.country ? `[${group.country}]` : ''
                                const wineColor = WINE_TYPE_COLOR[group.wineType] ?? '#64748B'
                                const vStr = group.vintage ? String(group.vintage) : 'NV'
                                const isSkuActive = activeSkuFilter === group.skuCode
                                const isVintageActive = activeVintageFilter === vStr

                                return (
                                    <Fragment key={group.key}>
                                        <tr
                                            onClick={() => toggleGroup(group.key)}
                                            className="group transition-colors hover:bg-slate-50/90 cursor-pointer"
                                        >
                                            <td className="px-3 py-2.5 whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <div className="flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleGroup(group.key)}
                                                        className="p-0.5 rounded hover:bg-slate-200 text-slate-500 cursor-pointer"
                                                        title="Mở rộng chi tiết từng vị trí"
                                                    >
                                                        {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => onFilterSku?.(isSkuActive ? '' : group.skuCode)}
                                                        className={cn(
                                                            'font-mono font-extrabold text-xs px-1.5 py-0.5 rounded transition-all cursor-pointer',
                                                            isSkuActive
                                                                ? 'bg-lys-teal-strong text-white'
                                                                : 'text-slate-900 bg-slate-100 hover:bg-lys-teal-soft hover:text-lys-teal-strong border border-slate-200/80'
                                                        )}
                                                    >
                                                        {group.skuCode}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-3 py-2.5 min-w-0">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    {countryTag && <span className="shrink-0 text-[10px] font-mono font-semibold text-slate-500">{countryTag}</span>}
                                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: wineColor }} />
                                                    <p className="font-bold text-slate-900 truncate text-xs" title={group.productName}>{group.productName}</p>
                                                    {group.lots.length > 1 && (
                                                        <span className="shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 border border-slate-200">
                                                            {group.lots.length} vị trí
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2.5 text-center whitespace-nowrap" onClick={e => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    onClick={() => onFilterVintage?.(isVintageActive ? '' : vStr)}
                                                    className={cn(
                                                        'text-xs font-bold px-2 py-0.5 rounded-md font-mono inline-block transition-all cursor-pointer border',
                                                        isVintageActive
                                                            ? 'bg-amber-600 text-white border-amber-700'
                                                            : group.vintage
                                                                ? 'bg-amber-50 text-amber-800 border-amber-200/80 hover:bg-amber-100'
                                                                : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                                                    )}
                                                >
                                                    {vStr}
                                                </button>
                                            </td>
                                            <td className="px-3 py-2.5" onClick={e => e.stopPropagation()}>
                                                <div className="flex flex-wrap gap-1">
                                                    {group.locations.slice(0, 3).map((loc, idx) => {
                                                        const isLocActive = activeLocationFilter === loc.locationCode
                                                        return (
                                                            <button
                                                                key={`${loc.locationCode}-${idx}`}
                                                                type="button"
                                                                onClick={() => onFilterLocation?.(isLocActive ? '' : loc.locationCode)}
                                                                title={`${loc.friendlyLoc}${showWarehouseColumn ? ` (${loc.warehouseName})` : ''}: ${loc.qtyAvailable} chai khả dụng`}
                                                                className={cn(
                                                                    'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border transition-all cursor-pointer max-w-full truncate',
                                                                    isLocActive
                                                                        ? 'bg-lys-teal-strong text-white border-lys-teal-strong'
                                                                        : 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-lys-teal-soft hover:text-lys-teal-strong'
                                                                )}
                                                            >
                                                                <MapPin size={10} className="shrink-0 opacity-70" />
                                                                <span className="truncate max-w-[115px]">{loc.friendlyLoc}</span>
                                                                <span className="font-mono font-extrabold text-[10px] opacity-85">({loc.qtyAvailable})</span>
                                                            </button>
                                                        )
                                                    })}
                                                    {group.locations.length > 3 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleGroup(group.key)}
                                                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 hover:bg-slate-300 cursor-pointer"
                                                        >
                                                            +{group.locations.length - 3} vị trí
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                                <span className="text-xs font-bold font-mono text-slate-700">
                                                    {group.qtyBook.toLocaleString()}
                                                </span>
                                            </td>
                                            <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-xs font-bold font-mono text-slate-900">
                                                        {group.qtyOnHand.toLocaleString()}
                                                    </span>
                                                    {group.variance !== 0 && (
                                                        <span className={`text-[9px] font-extrabold px-1.5 py-0.2 rounded mt-0.5 border ${
                                                            group.variance < 0 ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200'
                                                        }`}>
                                                            {t.varianceBadge(group.variance)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-2 py-2.5 text-center whitespace-nowrap">
                                                <div className="flex flex-col items-center">
                                                    <span className={cn(
                                                        'text-xs font-extrabold font-mono px-2.5 py-0.5 rounded-md border',
                                                        group.qtyAvailable > 0
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-slate-100 text-slate-500 border-slate-200'
                                                    )}>
                                                        {group.qtyAvailable.toLocaleString()}
                                                    </span>
                                                    {group.qtyReserved > 0 && (
                                                        <span className="text-[9px] text-blue-600 font-bold mt-0.5">
                                                            {t.reservedLabel(group.qtyReserved)}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            {canSeeCost && (
                                                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                                                    {group.totalValue > 0 ? (
                                                        <span className="text-xs font-mono font-semibold text-slate-800">
                                                            {formatCurrency(group.totalValue)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-slate-400">—</span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>

                                        {/* Sub-rows khi mở rộng nhóm SKU + Vintage */}
                                        {isExpanded && group.lots.map(subLot => {
                                            const subBook = subLot.qtyBook ?? subLot.qtyReceived
                                            const subOnHand = subLot.qtyOnHand ?? subLot.qtyAvailable
                                            const subVar = subLot.variance ?? (subOnHand - subBook)
                                            const subVal = subLot.qtyAvailable * subLot.unitLandedCost
                                            const subLoc = formatFriendlyLocationName({ locationCode: subLot.locationCode })
                                            return (
                                                <tr key={subLot.id} className="bg-slate-50/70 text-[11px] border-l-2 border-l-lys-teal-strong">
                                                    <td className="pl-7 pr-2 py-1.5 font-mono text-slate-500 truncate" title={subLot.lotNo}>
                                                        {subLot.lotNo}
                                                    </td>
                                                    <td className="px-3 py-1.5 text-slate-600 truncate">
                                                        Lô nhập: {new Date(subLot.receivedDate).toLocaleDateString('vi-VN')}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center font-mono text-slate-500">
                                                        {subLot.vintage ?? 'NV'}
                                                    </td>
                                                    <td className="px-3 py-1.5">
                                                        <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                                            <MapPin size={10} className="text-lys-teal-strong shrink-0" />
                                                            {subLoc}
                                                            {showWarehouseColumn && subLot.warehouseName && (
                                                                <span className="text-[10px] text-slate-500">({subLot.warehouseName})</span>
                                                            )}
                                                        </span>
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center font-mono text-slate-600">{subBook.toLocaleString()}</td>
                                                    <td className="px-2 py-1.5 text-center font-mono text-slate-800">
                                                        {subOnHand.toLocaleString()}
                                                        {subVar !== 0 && (
                                                            <span className={`ml-1 text-[9px] font-bold ${subVar < 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                                                                ({subVar > 0 ? `+${subVar}` : subVar})
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="px-2 py-1.5 text-center font-mono font-bold text-emerald-700">{subLot.qtyAvailable.toLocaleString()}</td>
                                                    {canSeeCost && (
                                                        <td className="px-3 py-1.5 text-right font-mono text-slate-600">
                                                            {subVal > 0 ? formatCurrency(subVal) : '—'}
                                                        </td>
                                                    )}
                                                </tr>
                                            )
                                        })}
                                    </Fragment>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Mobile Card List View (< 768px) */}
            <div className="block md:hidden p-2.5 space-y-2.5 bg-slate-50/60">
                {(groupMode === 'lot' ? pagedLots : pagedGroups.flatMap(g => g.lots)).map(lot => {
                    const wineColor = WINE_TYPE_COLOR[lot.wineType] ?? '#64748B'
                    const bookQty = lot.qtyBook ?? lot.qtyReceived
                    const onHandQty = lot.qtyOnHand ?? lot.qtyAvailable
                    const variance = lot.variance ?? (onHandQty - bookQty)
                    const friendlyLoc = formatFriendlyLocationName({ locationCode: lot.locationCode })
                    const vStr = lot.vintage ? String(lot.vintage) : 'NV'

                    return (
                        <div key={lot.id} className="p-3 rounded-lg space-y-2 shadow-2xs bg-white border border-slate-200 text-slate-900">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: wineColor }} />
                                    <button
                                        type="button"
                                        onClick={() => onFilterSku?.(activeSkuFilter === lot.skuCode ? '' : lot.skuCode)}
                                        className="text-xs font-extrabold font-mono text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200"
                                    >
                                        {lot.skuCode}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onFilterVintage?.(activeVintageFilter === vStr ? '' : vStr)}
                                        className="text-[11px] font-bold font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                                    >
                                        {vStr}
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => onFilterLocation?.(activeLocationFilter === lot.locationCode ? '' : lot.locationCode)}
                                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[180px]"
                                >
                                    <MapPin size={10} className="shrink-0" />
                                    <span className="truncate">{friendlyLoc}</span>
                                </button>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                                <h4 className="text-xs font-bold text-slate-900 leading-snug truncate">{lot.productName}</h4>
                                {showWarehouseColumn && lot.warehouseName && (
                                    <span className="text-[10px] font-semibold text-slate-500 shrink-0">{lot.warehouseName}</span>
                                )}
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-100 text-xs">
                                <div className="text-center bg-slate-50 py-1 px-1.5 rounded border border-slate-200/80">
                                    <span className="text-slate-500 text-[9px] uppercase font-bold block">Sổ sách</span>
                                    <span className="font-bold font-mono text-xs text-slate-700">
                                        {bookQty.toLocaleString()}
                                    </span>
                                </div>
                                <div className="text-center bg-slate-50 py-1 px-1.5 rounded border border-slate-200/80">
                                    <span className="text-slate-600 text-[9px] uppercase font-bold block">Thực tế</span>
                                    <span className="font-bold font-mono text-xs text-slate-900">
                                        {onHandQty.toLocaleString()}
                                    </span>
                                    {variance !== 0 && (
                                        <span className={`text-[9px] font-bold ml-1 ${variance < 0 ? 'text-rose-600' : 'text-amber-700'}`}>
                                            ({variance > 0 ? `+${variance}` : variance})
                                        </span>
                                    )}
                                </div>
                                <div className="text-center bg-emerald-50 py-1 px-1.5 rounded border border-emerald-200">
                                    <span className="text-emerald-700 text-[9px] uppercase font-bold block">Khả dụng</span>
                                    <span className="font-extrabold font-mono text-xs text-emerald-800">
                                        {lot.qtyAvailable.toLocaleString()}
                                    </span>
                                    {lot.qtyReserved > 0 && (
                                        <span className="text-[9px] text-blue-600 ml-1 font-semibold">
                                            {t.reservedLabel(lot.qtyReserved)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Standard Pagination Footer */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                    <span>
                        Hiển thị <strong className="font-mono text-slate-900">{startIdx + 1}–{endIdx}</strong> / <strong className="font-mono text-slate-900">{totalItems}</strong> {groupMode === 'sku_vintage' ? 'dòng SKU-Vintage' : 'vị trí lô hàng'}
                    </span>
                    <select
                        value={pageSize}
                        onChange={e => onPageSizeChange?.(Number(e.target.value))}
                        className="px-2 py-1 rounded border border-slate-300 bg-white text-slate-800 font-semibold text-xs outline-none cursor-pointer"
                    >
                        <option value={25}>25 / trang</option>
                        <option value={50}>50 / trang</option>
                        <option value={100}>100 / trang</option>
                        <option value={0}>Tất cả</option>
                    </select>
                </div>

                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={safePage <= 1}
                            onClick={() => onPageChange?.(safePage - 1)}
                            className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                        >
                            Trước
                        </button>
                        <span className="px-2.5 py-1 font-mono font-bold text-slate-800">
                            Trang {safePage} / {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={safePage >= totalPages}
                            onClick={() => onPageChange?.(safePage + 1)}
                            className="px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-semibold disabled:opacity-40 hover:bg-slate-100 cursor-pointer"
                        >
                            Sau
                        </button>
                    </div>
                )}
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
            <div className="flex items-center justify-between p-4 rounded-lg shadow-xs bg-white border border-slate-200">
                <h3 className="text-sm font-bold flex items-center gap-2 text-slate-900">
                    <ShieldAlert size={16} className="text-rose-600" /> {t.title}
                    {lots.length > 0 && (
                        <span className="inline-block ml-2 text-xs px-2.5 py-0.5 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap shrink-0">
                            {t.lotsCount(lots.length)}
                        </span>
                    )}
                </h3>
                <button onClick={onRefresh} className="inline-block text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:bg-slate-100 cursor-pointer border border-slate-300 text-slate-600 bg-slate-50 whitespace-nowrap shrink-0">
                    {t.refresh}
                </button>
            </div>

            {lots.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2 rounded-lg shadow-xs border border-dashed border-slate-300 bg-white">
                    <CheckCircle2 size={28} className="text-emerald-600" />
                    <p className="text-xs font-semibold text-slate-900">{t.empty}</p>
                </div>
            ) : (
                <div className="rounded-lg overflow-hidden shadow-sm bg-white border border-slate-200">
                    {/* Desktop Table View (>= 768px) */}
                    <div className="hidden md:block overflow-x-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    {[t.thProduct, t.thLocation, t.thQty, t.thReceivedDate, 'Thao tác'].map((h, idx) => (
                                        <th key={idx} className={`px-4 py-3 font-bold uppercase tracking-wider text-[11px] text-slate-500 ${idx === 4 ? 'text-right' : ''}`}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {lots.map((lot: any) => (
                                    <tr key={lot.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-semibold text-slate-900">
                                            {lot.product?.skuCode && <span className="font-mono font-bold text-slate-600 mr-2">{lot.product.skuCode}</span>}
                                            {lot.product?.productName || lot.productId}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-700">
                                            {lot.location?.locationCode ? formatFriendlyLocationName({ locationCode: lot.location.locationCode }) : '—'}
                                        </td>
                                        <td className="px-4 py-3 font-mono font-bold text-rose-700">{Number(lot.qtyAvailable).toLocaleString()} chai</td>
                                        <td className="px-4 py-3 text-slate-500">{formatDateLocale(lot.receivedDate)}</td>
                                        <td className="px-4 py-3">
                                            <div className="flex gap-2 justify-end">
                                                <button onClick={() => handleRelease(lot.id, 'RESTORE')} disabled={processing === lot.id}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs transition-all hover:brightness-105 bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-pointer">
                                                    {processing === lot.id ? '...' : t.restore}
                                                </button>
                                                <button onClick={() => handleRelease(lot.id, 'WRITE_OFF')} disabled={processing === lot.id}
                                                    className="px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs transition-all hover:brightness-105 bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer">
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
                    <div className="block md:hidden p-3 space-y-2.5">
                        {lots.map((lot: any) => (
                            <div key={lot.id} className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-xs space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="inline-block text-xs font-mono font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                                        {t.quarantineCountBadge(Number(lot.qtyAvailable))}
                                    </span>
                                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                        {lot.location?.locationCode ? formatFriendlyLocationName({ locationCode: lot.location.locationCode }) : t.unassigned}
                                    </span>
                                </div>
                                <div>
                                    <p className="font-bold text-slate-900 text-xs leading-snug">
                                        {lot.product?.skuCode && <span className="font-mono text-slate-600 mr-1.5">[{lot.product.skuCode}]</span>}
                                        {lot.product?.productName || lot.productId}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">
                                        {t.thReceivedDate}: {formatDateLocale(lot.receivedDate)}
                                    </p>
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                                    <button
                                        onClick={() => handleRelease(lot.id, 'RESTORE')}
                                        disabled={processing === lot.id}
                                        className="w-full flex items-center justify-center py-2 text-xs font-bold rounded-lg transition-all min-h-[40px] bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    >
                                        {processing === lot.id ? '...' : t.restore}
                                    </button>
                                    <button
                                        onClick={() => handleRelease(lot.id, 'WRITE_OFF')}
                                        disabled={processing === lot.id}
                                        className="w-full flex items-center justify-center py-2 text-xs font-bold rounded-lg transition-all min-h-[40px] bg-rose-50 text-rose-700 border border-rose-200"
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
type WMSTab = 'inventory' | 'gr' | 'do' | 'locations' | 'quarantine' | 'nxt' | 'map' | 'transfer' | 'stock-count' | 'sample' | 'replenishment' | 'posm' | 'inspection'

interface Props {
    initialWarehouses?: WarehouseRow[]
    initialStats?: {
        warehouses: number; totalLots: number
        availableBottles: number; reservedBottles: number
        inventoryValue: number; quarantinedCount: number
        lowStockCount: number; slowMovingCount: number
    }
    isAdmin: boolean
    canSeeCost?: boolean
}

export function WarehouseClient({ initialWarehouses, initialStats, isAdmin, canSeeCost = true }: Props) {
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
    const [skuFilter, setSkuFilter] = useState('')
    const [vintageFilter, setVintageFilter] = useState('')
    const [locationFilter, setLocationFilter] = useState('')
    const [wineFilter, setWineFilter] = useState('')
    const [countryFilter, setCountryFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [stockStatusTab, setStockStatusTab] = useState<'ALL' | 'AVAILABLE' | 'RESERVED' | 'VARIANCE' | 'EMPTY'>('ALL')
    const [inventoryGroupMode, setInventoryGroupMode] = useState<'lot' | 'sku_vintage'>('lot')
    const [showInventoryStats, setShowInventoryStats] = useState(true)
    const [invPage, setInvPage] = useState(1)
    const [invPageSize, setInvPageSize] = useState(50)
    const hasInitWHRef = useRef(false)
    const [createWHOpen, setCreateWHOpen] = useState(false)
    const [editingWH, setEditingWH] = useState<WarehouseRow | null>(null)
    const [legalEntities, setLegalEntities] = useState<{ id: string; code: string; name: string }[]>([])

    useEffect(() => {
        getLegalEntities().then(setLegalEntities).catch(() => {})
    }, [])

    // View Mode: 'grid' (Bảng Chức Năng Trung Tâm) or 'workspace' (Giao diện tính năng chi tiết)
    const [viewMode, setViewMode] = useState<'grid' | 'workspace'>('grid')
    const [activeTab, setActiveTab] = useState<WMSTab>('inventory')
    const [inventorySubTab, setInventorySubTab] = useState<'available' | 'quarantine'>('available')
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

    // Auto pre-select Kho Thắng Ân Giang Văn Minh (WH-TA-GVM) on initial load only
    useEffect(() => {
        if (!hasInitWHRef.current && warehouses.length > 0) {
            hasInitWHRef.current = true
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

    // 10 Consolidated Warehouse Feature Modules
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
            key: 'transfer',
            title: 'Điều Chuyển Kho',
            subtitle: 'Phiếu chuyển liên kho & gợi ý bổ sung tồn tự động',
            icon: ArrowRightLeft,
            color: '#2563EB',
            bg: 'rgba(37,99,235,0.1)',
            description: 'Lập phiếu chuyển kho nội bộ, duyệt kế toán và gợi ý điều chuyển tự động',
            actionLabel: 'Điều Chuyển Kho',
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
            title: 'Sơ Đồ & Vị Trí Kho',
            subtitle: 'Bản đồ mặt bằng 2D & danh mục mã vạch vị trí',
            icon: Layers,
            color: '#0284C7',
            bg: 'rgba(2,132,199,0.1)',
            description: 'Trực quan hóa kệ/dãy mặt bằng 2D, quản lý danh sách vị trí lưu trữ và in mã vạch',
            actionLabel: 'Sơ Đồ & Vị Trí',
        },
        {
            key: 'inventory',
            title: 'Tồn Kho & Hàng Lỗi / Hỏng',
            subtitle: 'Tra cứu tồn thực tế, khả dụng & hàng lỗi/vỡ chờ xử lý',
            icon: Package,
            color: '#0F172A',
            bg: 'rgba(15,23,42,0.06)',
            badge: stats.quarantinedCount,
            description: t.modules.inventory.description,
            actionLabel: t.modules.inventory.actionLabel,
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
        {
            key: 'posm',
            title: t.modules.posm.title,
            subtitle: t.modules.posm.subtitle,
            icon: Sparkles,
            color: '#D97706',
            bg: 'rgba(217,119,6,0.1)',
            description: t.modules.posm.description,
            actionLabel: t.modules.posm.actionLabel,
        },
        {
            key: 'inspection',
            title: (t.modules as any).inspection?.title || 'Kiểm Tra Kho & Sổ Nhiệt Ẩm',
            subtitle: (t.modules as any).inspection?.subtitle || 'Đo nhiệt ẩm 12h, Phiếu định kỳ T2/T5 & Camera TimeMark',
            icon: ClipboardCheck,
            color: '#0E7490',
            bg: 'rgba(14, 116, 144, 0.1)',
            description: (t.modules as any).inspection?.description || 'Ghi nhận nhiệt độ 3 vị trí, độ ẩm, chụp ảnh camera có watermark, checklist an toàn & cảnh báo sự cố',
            actionLabel: (t.modules as any).inspection?.actionLabel || 'Kiểm Tra Kho',
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
    ]

    const WMS_CATEGORIES: { id: string; title: string; keys: WMSTab[] }[] = [
        {
            id: 'operations',
            title: 'Vận Hành Xuất Nhập (Operations)',
            keys: ['gr', 'do', 'transfer', 'stock-count'],
        },
        {
            id: 'space',
            title: 'Không Gian & Vị Trí (Space & Layout)',
            keys: ['map'],
        },
        {
            id: 'inventory',
            title: 'Quản Lý Tồn Kho (Inventory)',
            keys: ['inventory', 'sample', 'posm'],
        },
        {
            id: 'compliance',
            title: 'Kiểm Định & Báo Cáo (Compliance & Reports)',
            keys: ['inspection', 'nxt'],
        },
    ]

    const selectWarehouse = async (id: string | null) => {
        setSelectedWH(id)
        setLocationFilter('')
        setInvPage(1)
        setLotsLoading(true)
        try {
            const [data, locs] = await Promise.all([
                getStockInventory(id ? { warehouseId: id } : {}),
                id ? getLocations(id) : Promise.resolve([]),
            ])
            setLots(data)
            setSelectedLocations(locs)
        } finally {
            setLotsLoading(false)
        }
    }

    const reloadInventory = () => selectWarehouse(selectedWH)

    const resetInventoryFilters = () => {
        setSearch('')
        setSkuFilter('')
        setVintageFilter('')
        setLocationFilter('')
        setWineFilter('')
        setCountryFilter('')
        setStatusFilter('')
        setStockStatusTab('ALL')
        setInvPage(1)
    }

    const activeInvFilterCount = [
        search,
        skuFilter,
        vintageFilter,
        locationFilter,
        wineFilter,
        countryFilter,
        statusFilter,
        stockStatusTab !== 'ALL' ? stockStatusTab : '',
    ].filter(Boolean).length

    // Dynamic options derived from loaded lots (for SKU, Vintage, Location, Country)
    const skuOptions = useMemo(() => {
        const map = new Map<string, { skuCode: string; productName: string; count: number; avail: number }>()
        for (const l of lots) {
            const cur = map.get(l.skuCode)
            if (!cur) {
                map.set(l.skuCode, { skuCode: l.skuCode, productName: l.productName, count: 1, avail: l.qtyAvailable })
            } else {
                cur.count += 1
                cur.avail += l.qtyAvailable
            }
        }
        return Array.from(map.values()).sort((a, b) => a.skuCode.localeCompare(b.skuCode))
    }, [lots])

    const vintageOptions = useMemo(() => {
        const map = new Map<string, { value: string; label: string; count: number; avail: number }>()
        for (const l of lots) {
            const val = l.vintage ? String(l.vintage) : 'NV'
            const cur = map.get(val)
            if (!cur) {
                map.set(val, { value: val, label: l.vintage ? `Vintage ${l.vintage}` : 'NV (Không niên vụ)', count: 1, avail: l.qtyAvailable })
            } else {
                cur.count += 1
                cur.avail += l.qtyAvailable
            }
        }
        return Array.from(map.values()).sort((a, b) => {
            if (a.value === 'NV') return 1
            if (b.value === 'NV') return -1
            return Number(b.value) - Number(a.value)
        })
    }, [lots])

    const locationOptions = useMemo(() => {
        const map = new Map<string, { code: string; friendly: string; count: number; avail: number }>()
        for (const l of lots) {
            const cur = map.get(l.locationCode)
            if (!cur) {
                map.set(l.locationCode, {
                    code: l.locationCode,
                    friendly: formatFriendlyLocationName({ locationCode: l.locationCode }),
                    count: 1,
                    avail: l.qtyAvailable,
                })
            } else {
                cur.count += 1
                cur.avail += l.qtyAvailable
            }
        }
        return Array.from(map.values()).sort((a, b) => a.friendly.localeCompare(b.friendly, 'vi'))
    }, [lots])

    const countryOptions = useMemo(() => {
        const map = new Map<string, number>()
        for (const l of lots) {
            if (l.country) {
                map.set(l.country, (map.get(l.country) ?? 0) + 1)
            }
        }
        return Array.from(map.entries())
            .map(([code, count]) => ({ code, count }))
            .sort((a, b) => b.count - a.count)
    }, [lots])

    const invStatusCounts = useMemo(() => {
        let available = 0
        let reserved = 0
        let variance = 0
        let empty = 0
        for (const l of lots) {
            const book = l.qtyBook ?? l.qtyReceived
            const onHand = l.qtyOnHand ?? l.qtyAvailable
            const diff = l.variance ?? (onHand - book)
            if (l.qtyAvailable > 0) available++
            else empty++
            if ((l.qtyReserved ?? 0) > 0) reserved++
            if (diff !== 0) variance++
        }
        return {
            ALL: lots.length,
            AVAILABLE: available,
            RESERVED: reserved,
            VARIANCE: variance,
            EMPTY: empty,
        }
    }, [lots])

    // Auto-load quarantine when tab opens and handle legacy redirects
    const handleTabChange = async (tab: WMSTab) => {
        if (tab === 'quarantine') {
            setActiveTab('inventory')
            setInventorySubTab('quarantine')
            if (!qLoaded) {
                setQLoading(true)
                setQuarantineLots(await getQuarantinedLots())
                setQLoaded(true)
                setQLoading(false)
            }
            return
        }
        if (tab === 'locations') {
            setActiveTab('map')
            return
        }
        if (tab === 'replenishment') {
            setActiveTab('transfer')
            return
        }
        setActiveTab(tab)
    }

    // Sort handler
    const handleSort = (key: string) => {
        setSortConfig(prev => ({
            key,
            dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc',
        }))
    }

    // Filter + sort lots
    const filteredLots = useMemo(() => {
        const q = search.trim().toLowerCase()
        return lots
            .filter(l => {
                const friendlyLoc = formatFriendlyLocationName({ locationCode: l.locationCode })
                const vStr = l.vintage ? String(l.vintage) : 'NV'
                const book = l.qtyBook ?? l.qtyReceived
                const onHand = l.qtyOnHand ?? l.qtyAvailable
                const diff = l.variance ?? (onHand - book)

                const matchesSearch = !q ||
                    l.skuCode.toLowerCase().includes(q) ||
                    l.productName.toLowerCase().includes(q) ||
                    l.locationCode.toLowerCase().includes(q) ||
                    friendlyLoc.toLowerCase().includes(q) ||
                    vStr.toLowerCase().includes(q) ||
                    l.lotNo.toLowerCase().includes(q)

                const matchesSku = !skuFilter || l.skuCode === skuFilter
                const matchesVintage = !vintageFilter || vStr === vintageFilter
                const matchesLocation = !locationFilter || l.locationCode === locationFilter
                const matchesWine = !wineFilter || l.wineType === wineFilter
                const matchesCountry = !countryFilter || l.country === countryFilter
                const matchesStatus = !statusFilter || l.status === statusFilter

                const matchesTab =
                    stockStatusTab === 'ALL' ? true :
                    stockStatusTab === 'AVAILABLE' ? l.qtyAvailable > 0 :
                    stockStatusTab === 'RESERVED' ? (l.qtyReserved ?? 0) > 0 :
                    stockStatusTab === 'VARIANCE' ? diff !== 0 :
                    stockStatusTab === 'EMPTY' ? l.qtyAvailable <= 0 : true

                return matchesSearch && matchesSku && matchesVintage && matchesLocation && matchesWine && matchesCountry && matchesStatus && matchesTab
            })
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
    }, [lots, search, skuFilter, vintageFilter, locationFilter, wineFilter, countryFilter, statusFilter, stockStatusTab, sortConfig])

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
        ...(canSeeCost ? [
            { label: t.stats.inventoryValue, value: formatStatCurrency(stats.inventoryValue), sub: formatCurrency(stats.inventoryValue), tone: 'brand' as Tone, icon: DollarSign }
        ] : [
            { label: 'Tổng số lô tồn', value: stats.totalLots.toLocaleString(), sub: 'lô hàng trong kho', tone: 'brand' as Tone, icon: Box }
        ]),
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
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle text-xs font-bold shrink-0 shadow-2xs active:scale-95 transition cursor-pointer select-none"
                            >
                                <ArrowLeft size={14} /> {t.mobileMenuBtn}
                            </button>
                            <div className="relative min-w-0 flex-1 max-w-[170px]">
                                <select
                                    value={activeTab}
                                    onChange={e => handleTabChange(e.target.value as WMSTab)}
                                    className="w-full appearance-none pl-2.5 pr-6 py-1.5 text-base sm:text-xs font-bold text-lys-teal-strong bg-lys-teal-soft border border-lys-teal-subtle rounded-lg cursor-pointer outline-none truncate active:scale-95 transition"
                                >
                                    {wmsFeatureModules.map(m => (
                                        <option key={m.key} value={m.key} className="text-slate-900 bg-white font-medium">
                                            {m.title}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-lys-teal-strong" />
                            </div>
                        </div>
                    )}

                    {/* Right side controls: Compact Warehouse Select & Stats Toggle */}
                    <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative">
                            <select
                                value={selectedWH ?? ''}
                                onChange={e => {
                                    const val = e.target.value
                                    selectWarehouse(val || null)
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
                                <div className="relative">
                                    <select
                                        value={activeTab}
                                        onChange={e => handleTabChange(e.target.value as WMSTab)}
                                        className="appearance-none pl-2.5 pr-7 py-1 text-xs font-bold text-lys-teal-strong bg-lys-teal-soft border border-lys-teal-subtle rounded-lg cursor-pointer outline-none hover:bg-lys-teal-soft/80 transition active:scale-95"
                                    >
                                        {wmsFeatureModules.map(m => (
                                            <option key={m.key} value={m.key} className="text-slate-900 bg-white font-medium">
                                                {m.title}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-lys-teal-strong" />
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setViewMode('grid')}
                                    className="ml-1 text-xs gap-1 active:scale-95 transition-all select-none"
                                >
                                    <ArrowLeft size={13} /> {t.backToMenu}
                                </Button>
                            </div>
                        )}
                    </div>

                    {/* Right Action Group: Warehouse Selector Dropdown, Notification Alert Toggle & Create Warehouse */}
                    <div className="flex items-center gap-2 shrink-0">
                        {(viewMode === 'grid' || activeTab === 'do') && (
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
                                            <span className="inline-block bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded-full font-mono font-extrabold ml-0.5 whitespace-nowrap shrink-0">
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
                        )}

                        <div className="relative">
                            <select
                                value={selectedWH ?? ''}
                                onChange={e => {
                                    const val = e.target.value
                                    selectWarehouse(val || null)
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

                        {viewMode === 'grid' && (
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setCreateWHOpen(true)}
                                className="gap-1.5"
                            >
                                <Plus size={14} /> {t.createWarehouseBtn}
                            </Button>
                        )}
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
                <div className="space-y-6">
                    {/* Mobile Categorized Feature Grid (< 768px) */}
                    <div className="block md:hidden space-y-5 pb-6">
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs uppercase tracking-wider font-extrabold text-slate-500">
                                {t.menuTitle}
                            </p>
                            <span className="inline-block text-[10px] font-bold text-lys-teal-strong bg-lys-teal-soft border border-lys-teal-subtle px-2 py-0.5 rounded-full whitespace-nowrap shrink-0">
                                {t.modulesCount(wmsFeatureModules.length)}
                            </span>
                        </div>

                        {WMS_CATEGORIES.map(cat => {
                            const catModules = cat.keys.map(k => wmsFeatureModules.find(m => m.key === k)).filter(Boolean) as typeof wmsFeatureModules
                            if (catModules.length === 0) return null
                            return (
                                <div key={cat.id} className="space-y-2">
                                    <div className="flex items-center gap-1.5 px-1">
                                        <span className="w-1 h-3.5 bg-lys-teal rounded-full" />
                                        <span className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                                            {cat.title}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2.5">
                                        {catModules.map(mod => {
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
                                                            <span className="inline-block text-[9px] px-1.5 py-0.5 rounded-full font-extrabold bg-rose-600 text-white whitespace-nowrap shrink-0">
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
                            )
                        })}
                    </div>

                    {/* Desktop Categorized Grid View (>= 768px) */}
                    <div className="hidden md:block space-y-6">
                        <div className="flex items-center justify-between px-1">
                            <p className="text-xs uppercase tracking-wider font-extrabold text-slate-500">
                                {t.menuTitle}
                            </p>
                            <span className="text-xs text-slate-500 font-medium">
                                {t.modulesCount(wmsFeatureModules.length)}
                            </span>
                        </div>

                        {WMS_CATEGORIES.map(cat => {
                            const catModules = cat.keys.map(k => wmsFeatureModules.find(m => m.key === k)).filter(Boolean) as typeof wmsFeatureModules
                            if (catModules.length === 0) return null
                            return (
                                <div key={cat.id} className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <span className="w-1.5 h-4 bg-lys-teal rounded-full" />
                                        <h3 className="text-xs uppercase tracking-wider font-extrabold text-slate-700">
                                            {cat.title}
                                        </h3>
                                        <span className="text-[11px] text-slate-400 font-medium">({catModules.length})</span>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5 sm:gap-4">
                                        {catModules.map(mod => {
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
                                                                <span className="inline-block text-[11px] px-2.5 py-0.5 rounded-full font-extrabold bg-rose-600 text-white shadow-2xs whitespace-nowrap shrink-0">
                                                                    {t.modules.quarantine.badgeAlerts(mod.badge)}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <h4 className="text-sm font-bold text-slate-900 group-hover:text-lys-teal-strong transition-colors">
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
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ═══ VIEW MODE 2: MÀN HÌNH LÀM VIỆC CHI TIẾT (WORKSPACE VIEW) ═══ */}
            {viewMode === 'workspace' && (
                <div className="space-y-4 pb-8">
                    <div key={activeTab} className="animate-fade-in">
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

                    {/* POSM & Collateral Inventory Tab — Độc lập */}
                    {activeTab === 'posm' && <PosmInventoryTab />}

                    {/* Inspection & Daily Checklist Tab — Sổ Nhiệt Ẩm 12h & Định Kỳ */}
                    {activeTab === 'inspection' && (
                        <InspectionTab
                            warehouses={warehouseList}
                            selectedWarehouseId={selectedWH ?? undefined}
                            isAdmin={isAdmin}
                        />
                    )}

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

                    {/* Inventory Tab — Standardized 4-Tier ERP Layout */}
                    {activeTab === 'inventory' && (() => {
                        const totalBookQty = filteredLots.reduce((sum, l) => sum + (l.qtyBook ?? l.qtyReceived ?? 0), 0)
                        const totalOnHandQty = filteredLots.reduce((sum, l) => sum + (l.qtyOnHand ?? l.qtyAvailable ?? 0), 0)
                        const totalAvailableQty = filteredLots.reduce((sum, l) => sum + (l.qtyAvailable ?? 0), 0)
                        const totalReservedQty = filteredLots.reduce((sum, l) => sum + (l.qtyReserved ?? 0), 0)
                        const totalVarianceQty = totalOnHandQty - totalBookQty
                        const totalFilteredValue = filteredLots.reduce((sum, l) => sum + (l.qtyAvailable * l.unitLandedCost), 0)
                        const uniqueFilteredSkus = new Set(filteredLots.map(l => l.skuCode)).size
                        const uniqueFilteredVintages = new Set(filteredLots.map(l => `${l.skuCode}_${l.vintage ?? 'NV'}`)).size
                        const uniqueFilteredLocations = new Set(filteredLots.map(l => `${l.warehouseId}_${l.locationCode}`)).size
                        const currentWhName = selectedWH ? warehouses.find(w => w.id === selectedWH)?.name : t.allWarehouses

                        const handleExportCsv = () => {
                            if (filteredLots.length === 0) return
                            const headers = canSeeCost
                                ? (locale === 'en'
                                    ? ['Warehouse', 'Location', 'SKU', 'Product Name', 'Vintage', 'Country', 'Stock Lot', 'Book Qty', 'On-hand Qty', 'Available Qty', 'Reserved Qty', 'Variance', 'Cost (VND)', 'Lot Value (VND)', 'Received Date', 'Status']
                                    : ['Kho Hàng', 'Vị Trí', 'Mã SKU', 'Sản Phẩm', 'Vintage', 'Xuất Xứ', 'Số Lô', 'Tồn Sổ Sách', 'Tồn Thực Tế', 'Khả Dụng', 'Đã Giữ Chỗ', 'Chênh Lệch', 'Giá Vốn (VND)', 'Giá Trị Lô (VND)', 'Ngày Nhập', 'Trạng Thái'])
                                : (locale === 'en'
                                    ? ['Warehouse', 'Location', 'SKU', 'Product Name', 'Vintage', 'Country', 'Stock Lot', 'Book Qty', 'On-hand Qty', 'Available Qty', 'Reserved Qty', 'Variance', 'Received Date', 'Status']
                                    : ['Kho Hàng', 'Vị Trí', 'Mã SKU', 'Sản Phẩm', 'Vintage', 'Xuất Xứ', 'Số Lô', 'Tồn Sổ Sách', 'Tồn Thực Tế', 'Khả Dụng', 'Đã Giữ Chỗ', 'Chênh Lệch', 'Ngày Nhập', 'Trạng Thái'])
                            const rows = filteredLots.map(l => [
                                l.warehouseName,
                                formatFriendlyLocationName({ locationCode: l.locationCode }),
                                l.skuCode,
                                l.productName,
                                l.vintage ?? 'NV',
                                l.country || '',
                                l.lotNo,
                                l.qtyBook ?? l.qtyReceived,
                                l.qtyOnHand ?? l.qtyAvailable,
                                l.qtyAvailable,
                                l.qtyReserved ?? 0,
                                l.variance ?? 0,
                                ...(canSeeCost ? [l.unitLandedCost, l.qtyAvailable * l.unitLandedCost] : []),
                                formatDateLocale(l.receivedDate),
                                getLotStatusLabel(l.status, locale),
                            ])
                            const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
                            const BOM = '\uFEFF'
                            const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `ton-kho-sku-vintage-vitri-${new Date().toISOString().slice(0, 10)}.csv`
                            a.click()
                            URL.revokeObjectURL(url)
                        }

                        return (
                            <div className="w-full space-y-4">
                                {/* ── TIER 1: Standardized Module Header Bar ── */}
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 rounded-lg bg-white border border-slate-200 shadow-2xs">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 rounded-lg bg-lys-teal-soft border border-lys-teal-subtle flex items-center justify-center shrink-0">
                                                <Package size={18} className="text-lys-teal-strong" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                                                        Tồn Kho Theo SKU, Vintage & Vị Trí
                                                    </h3>
                                                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle">
                                                        {uniqueFilteredSkus} SKU · {filteredLots.length} vị trí
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    Phạm vi: <strong className="text-slate-700">{currentWhName}</strong> — Tra cứu nhanh theo mã SKU, niên vụ (Vintage) và kệ lưu trữ
                                                </p>
                                            </div>
                                        </div>

                                        {/* Sub-tab switcher: Tồn kho khả dụng vs Hàng lỗi */}
                                        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                                            <button
                                                type="button"
                                                onClick={() => setInventorySubTab('available')}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                                                    inventorySubTab === 'available'
                                                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                                                        : "text-slate-600 hover:text-slate-900"
                                                )}
                                            >
                                                <Package size={13} className={inventorySubTab === 'available' ? 'text-lys-teal-strong' : 'text-slate-400'} />
                                                <span>Tồn Kho Khả Dụng</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    setInventorySubTab('quarantine')
                                                    if (!qLoaded) {
                                                        setQLoading(true)
                                                        setQuarantineLots(await getQuarantinedLots())
                                                        setQLoaded(true)
                                                        setQLoading(false)
                                                    }
                                                }}
                                                className={cn(
                                                    "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer",
                                                    inventorySubTab === 'quarantine'
                                                        ? "bg-white text-slate-900 shadow-2xs border border-slate-200/80"
                                                        : "text-slate-600 hover:text-slate-900"
                                                )}
                                            >
                                                <ShieldAlert size={13} className={inventorySubTab === 'quarantine' ? 'text-rose-600' : 'text-slate-400'} />
                                                <span>Hàng Lỗi / Chờ Xử Lý</span>
                                                {stats.quarantinedCount > 0 && (
                                                    <span className="inline-block text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-rose-600 text-white font-mono">
                                                        {stats.quarantinedCount}
                                                    </span>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Right Action Toolbar */}
                                    {inventorySubTab === 'available' && (
                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Group mode toggle: Theo Vị Trí vs Gộp SKU + Vintage */}
                                            <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                                                <button
                                                    type="button"
                                                    onClick={() => { setInventoryGroupMode('lot'); setInvPage(1) }}
                                                    className={cn(
                                                        'px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1',
                                                        inventoryGroupMode === 'lot'
                                                            ? 'bg-white text-lys-teal-strong shadow-2xs border border-slate-200/80'
                                                            : 'text-slate-600 hover:text-slate-900'
                                                    )}
                                                    title="Hiển thị chi tiết từng vị trí kệ & lô hàng"
                                                >
                                                    <MapPin size={13} />
                                                    <span>Theo Vị Trí</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => { setInventoryGroupMode('sku_vintage'); setInvPage(1) }}
                                                    className={cn(
                                                        'px-2.5 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer flex items-center gap-1',
                                                        inventoryGroupMode === 'sku_vintage'
                                                            ? 'bg-white text-lys-teal-strong shadow-2xs border border-slate-200/80'
                                                            : 'text-slate-600 hover:text-slate-900'
                                                    )}
                                                    title="Gộp tổng tồn theo từng cặp Mã SKU + Niên vụ (Vintage)"
                                                >
                                                    <Layers size={13} />
                                                    <span>Gộp SKU + Vintage</span>
                                                </button>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setShowInventoryStats(!showInventoryStats)}
                                                className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer transition-all"
                                            >
                                                {showInventoryStats ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                <span className="hidden sm:inline">Chỉ số</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={reloadInventory}
                                                disabled={lotsLoading}
                                                className="flex items-center justify-center p-2 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer transition-all"
                                                title="Làm mới dữ liệu tồn kho"
                                            >
                                                <RefreshCw size={14} className={lotsLoading ? 'animate-spin text-lys-teal-strong' : ''} />
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleExportCsv}
                                                disabled={filteredLots.length === 0}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border border-slate-200 bg-white text-lys-teal-strong hover:bg-lys-teal-soft/40 disabled:opacity-50 cursor-pointer transition-all"
                                            >
                                                <Download size={14} />
                                                <span>{t.table.exportCsv}</span>
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {inventorySubTab === 'quarantine' ? (
                                    <QuarantinePanel
                                        lots={quarantineLots}
                                        loading={qLoading}
                                        onRefresh={async () => {
                                            setQLoading(true)
                                            setQuarantineLots(await getQuarantinedLots())
                                            setQLoading(false)
                                        }}
                                    />
                                ) : (
                                    <>
                                        {/* ── TIER 2: Collapsible KPI Stat Cards ── */}
                                        {showInventoryStats && (
                                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                                                <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #0891B2' }}>
                                                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Tổng Mã SKU & Vintage</span>
                                                    <div className="mt-1 flex items-baseline gap-2">
                                                        <span className="text-lg sm:text-xl font-extrabold font-mono text-slate-900">{uniqueFilteredSkus} SKU</span>
                                                        <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                            {uniqueFilteredVintages} dòng niên vụ
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-slate-500 mt-1">
                                                        Phân bổ tại <strong className="text-slate-700">{uniqueFilteredLocations}</strong> vị trí kệ
                                                    </span>
                                                </div>

                                                <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #334155' }}>
                                                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Tồn Thực Tế / Sổ Sách</span>
                                                    <div className="mt-1 flex items-baseline gap-2">
                                                        <span className="text-lg sm:text-xl font-extrabold font-mono text-slate-900">
                                                            {totalOnHandQty.toLocaleString()} <span className="text-xs font-semibold text-slate-500">{t.bottlesUnit}</span>
                                                        </span>
                                                        {totalVarianceQty !== 0 && (
                                                            <span className={cn(
                                                                'text-[11px] font-mono font-extrabold px-1.5 py-0.5 rounded border',
                                                                totalVarianceQty < 0 ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                                            )}>
                                                                Lệch {totalVarianceQty > 0 ? `+${totalVarianceQty}` : totalVarianceQty}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] text-slate-500 mt-1">
                                                        Tồn sổ sách: <strong className="font-mono text-slate-700">{totalBookQty.toLocaleString()}</strong> {t.bottlesUnit}
                                                    </span>
                                                </div>

                                                <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #15803D' }}>
                                                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">Tồn Khả Dụng Bán</span>
                                                    <div className="mt-1 flex items-baseline gap-2">
                                                        <span className="text-lg sm:text-xl font-extrabold font-mono text-emerald-700">
                                                            {totalAvailableQty.toLocaleString()} <span className="text-xs font-semibold text-emerald-600">{t.bottlesUnit}</span>
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-slate-500 mt-1">
                                                        Đang giữ chỗ đơn SO: <strong className="font-mono text-blue-700">{totalReservedQty.toLocaleString()}</strong> {t.bottlesUnit}
                                                    </span>
                                                </div>

                                                <div className="p-3.5 rounded-lg bg-white border border-slate-200 shadow-2xs flex flex-col justify-between" style={{ borderLeft: '3px solid #B45309' }}>
                                                    <span className="text-[11px] uppercase tracking-wider font-bold text-slate-500">
                                                        {canSeeCost ? 'Giá Trị Tồn Kho (Đang Lọc)' : 'Số Lô & Vị Trí Kệ'}
                                                    </span>
                                                    <div className="mt-1">
                                                        <span className="text-lg sm:text-xl font-extrabold font-mono text-slate-900">
                                                            {canSeeCost ? formatStatCurrency(totalFilteredValue) : `${filteredLots.length.toLocaleString()} lô`}
                                                        </span>
                                                    </div>
                                                    <span className="text-[11px] text-slate-500 mt-1 truncate">
                                                        {canSeeCost ? formatCurrency(totalFilteredValue) : `Trên tổng số ${lots.length.toLocaleString()} lô toàn kho`}
                                                    </span>
                                                </div>
                                            </div>
                                        )}

                                        {/* ── TIER 3: Unified MISA-Standard Filter Toolbar (Focused on SKU, Vintage, Location) ── */}
                                        <div className="p-4 rounded-lg bg-white border border-slate-200 shadow-2xs space-y-3">
                                            {/* Row 1: Quick Status Filter Tabs */}
                                            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-3 overflow-x-auto no-scrollbar">
                                                <div className="flex items-center gap-1.5">
                                                    {[
                                                        { key: 'ALL' as const, label: 'Tất Cả Vị Trí', count: invStatusCounts.ALL },
                                                        { key: 'AVAILABLE' as const, label: 'Còn Khả Dụng', count: invStatusCounts.AVAILABLE },
                                                        { key: 'RESERVED' as const, label: 'Đang Giữ Chỗ', count: invStatusCounts.RESERVED },
                                                        { key: 'VARIANCE' as const, label: 'Lệch Kiểm Kê', count: invStatusCounts.VARIANCE },
                                                        { key: 'EMPTY' as const, label: 'Hết Khả Dụng', count: invStatusCounts.EMPTY },
                                                    ].map(tab => {
                                                        const active = stockStatusTab === tab.key
                                                        return (
                                                            <button
                                                                key={tab.key}
                                                                type="button"
                                                                onClick={() => { setStockStatusTab(tab.key); setInvPage(1) }}
                                                                className={cn(
                                                                    'px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap border',
                                                                    active
                                                                        ? 'bg-lys-teal-strong text-white border-lys-teal-strong shadow-2xs'
                                                                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                                                                )}
                                                            >
                                                                <span>{tab.label}</span>
                                                                <span className={cn(
                                                                    'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold',
                                                                    active ? 'bg-white/20 text-white' : 'bg-slate-200/80 text-slate-700'
                                                                )}>
                                                                    {tab.count}
                                                                </span>
                                                            </button>
                                                        )
                                                    })}
                                                </div>

                                                {activeInvFilterCount > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={resetInventoryFilters}
                                                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 cursor-pointer shrink-0 transition-all"
                                                    >
                                                        <RotateCcw size={12} />
                                                        <span>Xóa bộ lọc ({activeInvFilterCount})</span>
                                                    </button>
                                                )}
                                            </div>

                                            {/* Row 2: Multi-dimension Filter Controls (SKU, Vintage, Location, Warehouse, WineType, Country) */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
                                                {/* 1. Search Input (SKU, Product, Location, Vintage) */}
                                                <div className="relative sm:col-span-2 lg:col-span-2">
                                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                                                    <input
                                                        type="text"
                                                        placeholder="Tìm nhanh mã SKU, tên rượu, niên vụ, vị trí kệ..."
                                                        value={search}
                                                        onChange={e => { setSearch(e.target.value); setInvPage(1) }}
                                                        className="w-full h-9 pl-9 pr-8 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-lys-teal-strong"
                                                    />
                                                    {search && (
                                                        <button
                                                            type="button"
                                                            onClick={() => { setSearch(''); setInvPage(1) }}
                                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    )}
                                                </div>

                                                {/* 2. Bộ lọc Mã SKU */}
                                                <select
                                                    value={skuFilter}
                                                    onChange={e => { setSkuFilter(e.target.value); setInvPage(1) }}
                                                    className={cn(
                                                        'h-9 px-2.5 rounded-lg border text-xs font-semibold outline-none cursor-pointer truncate',
                                                        skuFilter
                                                            ? 'border-lys-teal-strong bg-lys-teal-soft/30 text-lys-teal-strong font-bold'
                                                            : 'border-slate-300 bg-white text-slate-700'
                                                    )}
                                                >
                                                    <option value="">Tất cả Mã SKU ({skuOptions.length})</option>
                                                    {skuOptions.map(s => (
                                                        <option key={s.skuCode} value={s.skuCode}>
                                                            [{s.skuCode}] {s.productName} ({s.avail} chai)
                                                        </option>
                                                    ))}
                                                </select>

                                                {/* 3. Bộ lọc Niên Vụ (Vintage) */}
                                                <select
                                                    value={vintageFilter}
                                                    onChange={e => { setVintageFilter(e.target.value); setInvPage(1) }}
                                                    className={cn(
                                                        'h-9 px-2.5 rounded-lg border text-xs font-semibold outline-none cursor-pointer truncate',
                                                        vintageFilter
                                                            ? 'border-amber-500 bg-amber-50 text-amber-900 font-bold'
                                                            : 'border-slate-300 bg-white text-slate-700'
                                                    )}
                                                >
                                                    <option value="">Tất cả Vintage ({vintageOptions.length})</option>
                                                    {vintageOptions.map(v => (
                                                        <option key={v.value} value={v.value}>
                                                            {v.label} — {v.avail.toLocaleString()} chai ({v.count} vị trí)
                                                        </option>
                                                    ))}
                                                </select>

                                                {/* 4. Bộ lọc Vị Trí Lưu Kho (Location) */}
                                                <select
                                                    value={locationFilter}
                                                    onChange={e => { setLocationFilter(e.target.value); setInvPage(1) }}
                                                    className={cn(
                                                        'h-9 px-2.5 rounded-lg border text-xs font-semibold outline-none cursor-pointer truncate',
                                                        locationFilter
                                                            ? 'border-lys-teal-strong bg-lys-teal-soft/30 text-lys-teal-strong font-bold'
                                                            : 'border-slate-300 bg-white text-slate-700'
                                                    )}
                                                >
                                                    <option value="">Tất cả Vị Trí Kệ ({locationOptions.length})</option>
                                                    {locationOptions.map(loc => (
                                                        <option key={loc.code} value={loc.code}>
                                                            {loc.friendly} — {loc.avail.toLocaleString()} chai ({loc.count} lô)
                                                        </option>
                                                    ))}
                                                </select>

                                                {/* 5. Bộ lọc Kho / Loại vang / Xuất xứ */}
                                                <div className="grid grid-cols-2 gap-2">
                                                    <select
                                                        value={wineFilter}
                                                        onChange={e => { setWineFilter(e.target.value); setInvPage(1) }}
                                                        className={cn(
                                                            'h-9 px-2 rounded-lg border text-xs font-semibold outline-none cursor-pointer truncate',
                                                            wineFilter
                                                                ? 'border-lys-teal-strong bg-lys-teal-soft/30 text-lys-teal-strong font-bold'
                                                                : 'border-slate-300 bg-white text-slate-700'
                                                        )}
                                                    >
                                                        <option value="">Loại rượu</option>
                                                        <option value="RED">{t.wineTypes.RED}</option>
                                                        <option value="WHITE">{t.wineTypes.WHITE}</option>
                                                        <option value="ROSE">{t.wineTypes.ROSE}</option>
                                                        <option value="SPARKLING">{t.wineTypes.SPARKLING}</option>
                                                        <option value="FORTIFIED">{t.wineTypes.FORTIFIED}</option>
                                                        <option value="DESSERT">{t.wineTypes.DESSERT}</option>
                                                    </select>

                                                    <select
                                                        value={countryFilter}
                                                        onChange={e => { setCountryFilter(e.target.value); setInvPage(1) }}
                                                        className={cn(
                                                            'h-9 px-2 rounded-lg border text-xs font-semibold outline-none cursor-pointer truncate',
                                                            countryFilter
                                                                ? 'border-lys-teal-strong bg-lys-teal-soft/30 text-lys-teal-strong font-bold'
                                                                : 'border-slate-300 bg-white text-slate-700'
                                                        )}
                                                    >
                                                        <option value="">Xuất xứ</option>
                                                        {countryOptions.map(c => (
                                                            <option key={c.code} value={c.code}>
                                                                {c.code} ({c.count})
                                                            </option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Active Filter Chips Bar (when user filters by SKU, Vintage, Location, etc.) */}
                                            {(skuFilter || vintageFilter || locationFilter || wineFilter || countryFilter || !selectedWH) && (
                                                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                                    <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mr-1">
                                                        <Filter size={11} /> Đang xem:
                                                    </span>

                                                    {/* Warehouse scope chip */}
                                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                                        <Warehouse size={11} />
                                                        {currentWhName}
                                                    </span>

                                                    {skuFilter && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle">
                                                            SKU: {skuFilter}
                                                            <button type="button" onClick={() => setSkuFilter('')} className="hover:opacity-75 cursor-pointer"><X size={11} /></button>
                                                        </span>
                                                    )}

                                                    {vintageFilter && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                                                            Vintage: {vintageFilter}
                                                            <button type="button" onClick={() => setVintageFilter('')} className="hover:opacity-75 cursor-pointer"><X size={11} /></button>
                                                        </span>
                                                    )}

                                                    {locationFilter && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-lys-teal-soft text-lys-teal-strong border border-lys-teal-subtle">
                                                            <MapPin size={10} />
                                                            Vị trí: {formatFriendlyLocationName({ locationCode: locationFilter })}
                                                            <button type="button" onClick={() => setLocationFilter('')} className="hover:opacity-75 cursor-pointer"><X size={11} /></button>
                                                        </span>
                                                    )}

                                                    {wineFilter && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                                            Loại: {getWineTypeLabel(wineFilter, locale)}
                                                            <button type="button" onClick={() => setWineFilter('')} className="hover:opacity-75 cursor-pointer"><X size={11} /></button>
                                                        </span>
                                                    )}

                                                    {countryFilter && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-bold font-mono px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                                            Quốc gia: {countryFilter}
                                                            <button type="button" onClick={() => setCountryFilter('')} className="hover:opacity-75 cursor-pointer"><X size={11} /></button>
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* ── TIER 4: Data Table + Pagination ── */}
                                        {lotsLoading ? (
                                            <div className="flex items-center justify-center py-16 bg-white rounded-lg border border-slate-200">
                                                <Loader2 size={24} className="animate-spin text-lys-teal-strong" />
                                            </div>
                                        ) : (
                                            <StockTable
                                                lots={filteredLots}
                                                sortConfig={sortConfig}
                                                onSort={handleSort}
                                                canSeeCost={canSeeCost}
                                                groupMode={inventoryGroupMode}
                                                showWarehouseColumn={!selectedWH}
                                                activeSkuFilter={skuFilter}
                                                activeVintageFilter={vintageFilter}
                                                activeLocationFilter={locationFilter}
                                                onFilterSku={sku => { setSkuFilter(sku); setInvPage(1) }}
                                                onFilterVintage={v => { setVintageFilter(v); setInvPage(1) }}
                                                onFilterLocation={loc => { setLocationFilter(loc); setInvPage(1) }}
                                                page={invPage}
                                                pageSize={invPageSize}
                                                onPageChange={setInvPage}
                                                onPageSizeChange={size => { setInvPageSize(size); setInvPage(1) }}
                                            />
                                        )}
                                    </>
                                )}
                            </div>
                        )
                    })()}
                    </div>
                </div>
            )}

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
