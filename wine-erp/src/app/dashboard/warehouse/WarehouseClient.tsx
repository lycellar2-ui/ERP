'use client'

import { useState, useEffect } from 'react'
import {
    Warehouse, Package, BarChart3, Plus, Search, MapPin,
    Thermometer, Box, X, Save, Loader2, AlertCircle, CheckCircle2,
    ChevronRight, Layers, PackagePlus, Truck, ShieldAlert, Trash2,
    DollarSign, AlertTriangle, Clock, Wine, ArrowUpDown, TrendingDown, Download, ChevronDown,
    ArrowRightLeft, ClipboardList, LayoutGrid, ArrowLeft, RefreshCw
} from 'lucide-react'
import {
    WarehouseRow, StockLotRow, LocationRow,
    createWarehouse, editWarehouse, createLocation, getStockInventory, getLocations,
    getQuarantinedLots, moveToQuarantine, releaseFromQuarantine, writeOffStock,
    getWarehouses, getWMSStats
} from './actions'
import { getLegalEntities } from '../sales/actions'
import { formatVND, formatDate } from '@/lib/utils'
import { GoodsReceiptTab } from './GoodsReceiptTab'
import { DeliveryOrderTab } from './DeliveryOrderTab'
import { LocationManager } from './LocationManager'
import { StockMovementTab } from './StockMovementTab'
import { WarehouseMapTab } from './WarehouseMapTab'
import { TransfersTab } from './TransfersTab'
import { StockCountTab } from './StockCountTab'
import { SampleInventoryTab } from './SampleInventoryTab'

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
    AT: '🇦🇹', GR: '🇬🇷', HU: '🇭🇺', GE: '🇬🇪', RO: '🇷🇴',
    IL: '🇮🇱', LB: '🇱🇧', UY: '🇺🇾', BR: '🇧🇷', MX: '🇲🇽',
    CN: '🇨🇳', JP: '🇯🇵', GB: '🇬🇧', CH: '🇨🇭', HR: '🇭🇷',
    SI: '🇸🇮', MD: '🇲🇩', BG: '🇧🇬', TR: '🇹🇷', MA: '🇲🇦',
}

const WINE_TYPE_COLOR: Record<string, string> = {
    RED: '#C74B50', WHITE: '#E2C275', ROSE: '#D4607A',
    SPARKLING: '#7AC4C4', FORTIFIED: '#B87333', DESSERT: '#D4963A',
}

const LOT_STATUS: Record<string, { label: string; color: string }> = {
    AVAILABLE: { label: 'Sẵn sàng', color: '#16A34A' },
    RESERVED: { label: 'Đã đặt trước', color: '#2563EB' },
    QUARANTINE: { label: 'Cách ly', color: '#B47816' },
    CONSUMED: { label: 'Đã xuất', color: '#64748B' },
    DAMAGED: { label: 'Hư hỏng', color: '#DC2626' },
}

// ── Create Warehouse Modal ─────────────────────────
function CreateWarehouseModal({ open, onClose, onCreated }: {
    open: boolean; onClose: () => void; onCreated: () => void
}) {
    const [form, setForm] = useState({ code: '', name: '', address: '' })
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState('')

    if (!open) return null

    const handleSave = async () => {
        if (!form.code || !form.name) return setError('Điền đầy đủ mã và tên kho')
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
            <div className="rounded-2xl p-6 space-y-5 w-full max-w-md shadow-2xl"
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold" style={{ color: '#0F172A' }}>
                        🏭 Tạo Kho Mới
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" style={{ color: '#64748B' }}><X size={18} /></button>
                </div>

                {error && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>{error}</div>}

                {[
                    { key: 'code', label: 'Mã Kho (VD: KHO-HCM)', placeholder: 'KHO-HCM-01' },
                    { key: 'name', label: 'Tên Kho', placeholder: 'Kho Cửa hàng' },
                    { key: 'address', label: 'Địa Chỉ', placeholder: '15 Đường Xuyên Á, Củ Chi, TP.HCM' },
                ].map(f => (
                    <div key={f.key}>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#475569' }}>{f.label}</label>
                        <input className="w-full px-3 py-2.5 rounded-lg text-sm outline-none"
                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }}
                            value={(form as any)[f.key]} placeholder={f.placeholder}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))} />
                    </div>
                ))}

                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-semibold"
                        style={{ color: '#475569', border: '1px solid #CBD5E1', background: '#F1F5F9' }}>Hủy</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold shadow-md"
                        style={{ background: '#D4A853', color: '#0A1926' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? '...' : 'Lưu Kho'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Days-in-stock badge ───────────────────────────
function DaysInStockBadge({ receivedDate }: { receivedDate: Date }) {
    const days = Math.floor((Date.now() - new Date(receivedDate).getTime()) / 86400000)
    const color = days > 180 ? '#DC2626' : days > 90 ? '#B47816' : '#64748B'
    return (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold"
            style={{ color, background: `${color}15` }}>
            {days}d
        </span>
    )
}

// ── Stock table ───────────────────────────────────
function StockTable({ lots, sortConfig, onSort }: {
    lots: StockLotRow[]
    sortConfig: { key: string; dir: 'asc' | 'desc' }
    onSort: (key: string) => void
}) {
    if (lots.length === 0) {
        return (
            <div className="flex flex-col items-center py-16 gap-3 rounded-2xl" style={{ border: '1px dashed #CBD5E1', background: '#FFFFFF' }}>
                <Box size={32} style={{ color: '#94A3B8' }} />
                <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>Chưa có tồn kho</p>
                <p className="text-xs" style={{ color: '#64748B' }}>Nhập hàng qua Goods Receipt để tạo stock lots</p>
            </div>
        )
    }

    const headers = [
        { key: 'skuCode', label: 'Mã SKU', align: 'left' as const },
        { key: 'productName', label: 'Sản Phẩm', align: 'left' as const },
        { key: 'vintage', label: 'VTG', align: 'center' as const },
        { key: 'lotNo', label: 'Lô Hàng (Lot)', align: 'left' as const },
        { key: 'locationCode', label: 'Vị Trí', align: 'left' as const },
        { key: 'receivedDate', label: 'Nhập Kho', align: 'left' as const },
        { key: 'qtyAvailable', label: 'Tồn', align: 'center' as const },
        { key: 'value', label: 'Giá Trị Lô', align: 'right' as const },
        { key: 'status', label: 'TT', align: 'center' as const },
    ]

    return (
        <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200" style={{ background: '#FFFFFF' }}>
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
                            const statusCfg = LOT_STATUS[lot.status] ?? { label: lot.status, color: '#64748B' }
                            const pctRemaining = lot.qtyReceived > 0 ? (lot.qtyAvailable / lot.qtyReceived) * 100 : 0
                            const lotValue = lot.qtyAvailable * lot.unitLandedCost
                            return (
                                <tr key={lot.id} className="group transition-colors hover:bg-amber-50/40">
                                    <td className="px-3 py-1.5 font-mono font-extrabold text-slate-800 whitespace-nowrap">
                                        {lot.skuCode}
                                    </td>
                                    <td className="px-3 py-1.5">
                                        <div className="flex items-center gap-1.5">
                                            <span className="shrink-0">{flag}</span>
                                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: wineColor }} />
                                            <p className="font-bold text-slate-900 truncate max-w-[260px] text-xs">{lot.productName}</p>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                        {lot.vintage ? (
                                            <span className="text-xs font-bold px-2 py-0.5 rounded-md font-mono inline-block" style={{ background: 'rgba(212,168,83,0.15)', color: '#B47816' }}>
                                                {lot.vintage}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-[#94A3B8] font-mono">NV</span>
                                        )}
                                    </td>
                                    <td className="px-3 py-1.5 font-mono font-bold text-amber-700 whitespace-nowrap">
                                        {lot.lotNo}
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-md font-mono" style={{ background: '#F1F5F9', color: '#334155' }}>
                                            {lot.locationCode}
                                        </span>
                                    </td>
                                    <td className="px-3 py-1.5 whitespace-nowrap">
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-slate-600 font-mono">{formatDate(lot.receivedDate)}</span>
                                            <DaysInStockBadge receivedDate={lot.receivedDate} />
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-center whitespace-nowrap">
                                        <div className="flex items-center gap-1.5 justify-center">
                                            <span className="text-xs font-bold font-mono" style={{ color: pctRemaining < 20 ? '#DC2626' : pctRemaining < 50 ? '#B47816' : '#16A34A' }}>
                                                {lot.qtyAvailable.toLocaleString()}
                                            </span>
                                            <div className="w-8 h-1.5 rounded-full overflow-hidden shrink-0" style={{ background: '#E2E8F0' }}>
                                                <div className="h-full rounded-full" style={{
                                                    width: `${pctRemaining}%`,
                                                    background: pctRemaining < 20 ? '#DC2626' : pctRemaining < 50 ? '#B47816' : '#16A34A',
                                                }} />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-3 py-1.5 text-right whitespace-nowrap">
                                        {lotValue > 0 ? (
                                            <span className="text-xs font-mono font-semibold text-slate-900">
                                                {formatVND(lotValue)}
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
                    const statusCfg = LOT_STATUS[lot.status] ?? { label: lot.status, color: '#64748B' }
                    return (
                        <div key={lot.id} className="p-4 rounded-2xl space-y-2.5 shadow-xl bg-slate-900 border border-slate-800 text-slate-100">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-black font-mono px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                    {lot.lotNo}
                                </span>
                                <span className="text-xs font-black font-mono px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 border border-slate-700">
                                    📍 {lot.locationCode}
                                </span>
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-white leading-tight">{lot.productName}</h4>
                                <p className="text-[11px] mt-1 flex items-center gap-1.5 text-slate-400 font-medium">
                                    {flag} <span className="w-2 h-2 rounded-full" style={{ background: wineColor }} />
                                    SKU: <strong className="text-slate-200 font-mono">{lot.skuCode}</strong> {lot.vintage ? `· Vintage: ${lot.vintage}` : ''}
                                </p>
                            </div>
                            <div className="flex items-center justify-between pt-2.5 border-t border-slate-800 text-xs">
                                <div>
                                    <span className="text-slate-400 text-[10px] uppercase font-bold block">Khả Dụng:</span>
                                    <span className="font-black font-mono text-sm text-emerald-400">
                                        {lot.qtyAvailable.toLocaleString()} chai
                                    </span>
                                </div>
                                <div>
                                    <span className="font-bold px-2.5 py-1 rounded-full text-[10px] uppercase border"
                                        style={{ color: statusCfg.color, background: `${statusCfg.color}20`, borderColor: `${statusCfg.color}40` }}>
                                        {statusCfg.label}
                                    </span>
                                </div>
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
    const [processing, setProcessing] = useState<string | null>(null)

    const handleRelease = async (lotId: string, action: 'RESTORE' | 'WRITE_OFF') => {
        setProcessing(lotId)
        await releaseFromQuarantine(lotId, action)
        onRefresh()
        setProcessing(null)
    }

    if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#D4A853' }} /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl shadow-xs" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: '#0F172A' }}>
                    <ShieldAlert size={16} style={{ color: '#DC2626' }} /> Hàng Đang Cách Ly & Xử Lý Sự Cố
                    {lots.length > 0 && (
                        <span className="ml-2 text-xs px-2.5 py-0.5 rounded-full font-bold"
                            style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626' }}>
                            {lots.length} lô
                        </span>
                    )}
                </h3>
                <button onClick={onRefresh} className="text-xs px-3 py-1.5 rounded-lg font-bold transition-all hover:bg-slate-100"
                    style={{ border: '1px solid #CBD5E1', color: '#475569', background: '#F1F5F9' }}>
                    Làm Mới
                </button>
            </div>

            {lots.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2 rounded-xl shadow-xs" style={{ border: '1px dashed #CBD5E1', background: '#FFFFFF' }}>
                    <CheckCircle2 size={28} style={{ color: '#16A34A' }} />
                    <p className="text-xs font-semibold" style={{ color: '#0F172A' }}>Không có lô hàng nào đang cách ly</p>
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden shadow-sm" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                    <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                                {['Lô Hàng', 'Sản Phẩm', 'SL', 'Vị Trí', 'Ngày Nhập', ''].map(h => (
                                    <th key={h} className="px-4 py-3 font-semibold uppercase tracking-wider text-[10px]" style={{ color: '#64748B' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {lots.map((lot: any) => (
                                <tr key={lot.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                    <td className="px-4 py-3 font-mono font-bold" style={{ color: '#B47816' }}>{lot.lotNo}</td>
                                    <td className="px-4 py-3 font-semibold" style={{ color: '#0F172A' }}>{lot.product?.productName || lot.productId}</td>
                                    <td className="px-4 py-3 font-mono font-bold" style={{ color: '#0F172A' }}>{Number(lot.qtyAvailable).toLocaleString()}</td>
                                    <td className="px-4 py-3 font-mono text-[#64748B]">{lot.location?.locationCode || '—'}</td>
                                    <td className="px-4 py-3 text-[#64748B]">{new Date(lot.receivedDate).toLocaleDateString('vi-VN')}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => handleRelease(lot.id, 'RESTORE')} disabled={processing === lot.id}
                                                className="px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs transition-all hover:brightness-105"
                                                style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.25)' }}>
                                                {processing === lot.id ? '...' : 'Khôi Phục'}
                                            </button>
                                            <button onClick={() => handleRelease(lot.id, 'WRITE_OFF')} disabled={processing === lot.id}
                                                className="px-2.5 py-1 rounded-lg text-xs font-bold shadow-xs transition-all hover:brightness-105"
                                                style={{ background: 'rgba(220,38,38,0.12)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.25)' }}>
                                                <Trash2 size={11} className="inline mr-0.5" />Hủy Kho
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

// ── Main WMS Client Component ───────────────────────
type WMSTab = 'inventory' | 'gr' | 'do' | 'locations' | 'quarantine' | 'nxt' | 'map' | 'transfer' | 'stock-count' | 'sample'

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
        allowSales: w.allowSales,
        allowTransfer: w.allowTransfer,
        isDefault: w.isDefault
    }))

    // 9 Unified Warehouse Feature Modules
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
            title: '📦 Tồn Kho Chủng Loại',
            subtitle: 'Stock Inventory',
            icon: Package,
            color: '#0F172A',
            bg: 'rgba(15,23,42,0.06)',
            description: 'Tra cứu chi tiết từng lô hàng, SKU, loại rượu & tồn khả dụng theo từng kho',
            actionLabel: 'Mở Tồn Kho'
        },
        {
            key: 'gr',
            title: '📥 Nhập Kho (GR)',
            subtitle: 'Goods Receipt',
            icon: PackagePlus,
            color: '#16A34A',
            bg: 'rgba(22,163,74,0.1)',
            description: 'Tạo phiếu nhập kho GR từ Đơn mua PO, gán lô & vị trí cất hàng, in phiếu GR',
            actionLabel: 'Tạo / Nhập GR'
        },
        {
            key: 'do',
            title: '📤 Xuất Kho (DO)',
            subtitle: 'Delivery Orders',
            icon: Truck,
            color: '#B47816',
            bg: 'rgba(212,168,83,0.15)',
            description: 'Tự động chọn lô FIFO, tạo phiếu xuất kho DO, xác nhận giao hàng & in phiếu DO',
            actionLabel: 'Nhặt Hàng Xuất Kho'
        },
        {
            key: 'transfer',
            title: '🔄 Chuyển Kho Nội Bộ',
            subtitle: 'Stock Transfers',
            icon: ArrowRightLeft,
            color: '#2563EB',
            bg: 'rgba(37,99,235,0.1)',
            description: 'Lập lệnh chuyển kho/vị trí, theo dõi hàng đang vận chuyển & xác nhận nhận kho',
            actionLabel: 'Lập Lệnh Chuyển Kho'
        },
        {
            key: 'stock-count',
            title: '📋 Kiểm Kê Kho',
            subtitle: 'Stock Audit & Barcode',
            icon: ClipboardList,
            color: '#7C3AED',
            bg: 'rgba(124,58,237,0.1)',
            description: 'Tạo đợt kiểm kê, quét Barcode di động, đối soát chênh lệch & tự động chỉnh tồn',
            actionLabel: 'Kiểm Kê Kho'
        },
        {
            key: 'map',
            title: '🗺️ Sơ Đồ Kho 2D',
            subtitle: 'Interactive Layout Map',
            icon: Layers,
            color: '#0284C7',
            bg: 'rgba(2,132,199,0.1)',
            description: 'Sơ đồ bản đồ 2D trực quan các Zone, Kệ Rack & tỷ lệ lấp đầy kho hàng',
            actionLabel: 'Xem Sơ Đồ Kho'
        },
        {
            key: 'locations',
            title: '📍 Quản Lý Vị Trí Kho',
            subtitle: 'Zones, Racks & Bins',
            icon: MapPin,
            color: '#D97706',
            bg: 'rgba(217,119,6,0.1)',
            description: 'Quản lý danh mục Zone, kệ Rack, vị trí Bin, nhiệt độ bảo quản & sức chứa',
            actionLabel: 'Quản Lý Vị Trí'
        },
        {
            key: 'quarantine',
            title: '⚠️ Cách Ly & Xử Lý',
            subtitle: 'Quarantine & Write-off',
            icon: ShieldAlert,
            color: '#DC2626',
            bg: 'rgba(220,38,38,0.1)',
            badge: stats.quarantinedCount,
            description: 'Quản lý lô hàng hư hỏng, hết hạn, cách ly chờ kiểm định & hủy kho',
            actionLabel: 'Xử Lý Cách Ly'
        },
        {
            key: 'nxt',
            title: '📊 Báo Cáo Nhập Xuất Tồn',
            subtitle: 'Stock Movement Ledger',
            icon: BarChart3,
            color: '#059669',
            bg: 'rgba(5,150,105,0.1)',
            description: 'Sổ chi tiết luân chuyển kho hàng, tốc độ quay vòng & báo cáo NXT',
            actionLabel: 'Xem Báo Cáo NXT'
        },
        {
            key: 'sample',
            title: '🍷 Quản Lý Hàng Mẫu',
            subtitle: 'Sample Wine Inventory',
            icon: Wine,
            color: '#D4A853',
            bg: 'rgba(212,168,83,0.1)',
            description: 'Kho hàng mẫu riêng biệt không bán hàng, quản lý nguồn ngạch & xuất sử dụng',
            actionLabel: 'Quản Lý Hàng Mẫu'
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
            if (key === 'qtyAvailable') return (a.qtyAvailable - b.qtyAvailable) * dir
            if (key === 'value') return ((a.qtyAvailable * a.unitLandedCost) - (b.qtyAvailable * b.unitLandedCost)) * dir
            if (key === 'receivedDate') return (new Date(a.receivedDate).getTime() - new Date(b.receivedDate).getTime()) * dir
            if (key === 'skuCode') return a.skuCode.localeCompare(b.skuCode) * dir
            if (key === 'productName') return a.productName.localeCompare(b.productName) * dir
            if (key === 'lotNo') return a.lotNo.localeCompare(b.lotNo) * dir
            if (key === 'locationCode') return a.locationCode.localeCompare(b.locationCode) * dir
            return 0
        })

    const statCards = [
        { label: 'Số Kho', value: stats.warehouses, accent: '#0F172A', icon: Warehouse },
        { label: 'Tổng Tồn Kho', value: `${stats.availableBottles.toLocaleString()} chai`, accent: '#16A34A', icon: Package },
        { label: 'Giá Trị Kho', value: formatVND(stats.inventoryValue), accent: '#B47816', icon: DollarSign },
        { label: 'Đã Đặt Trước', value: `${stats.reservedBottles.toLocaleString()} chai`, accent: '#2563EB', icon: Box },
        { label: 'Tồn Thấp', value: stats.lowStockCount, accent: stats.lowStockCount > 0 ? '#B47816' : '#16A34A', icon: AlertTriangle },
        { label: 'Hàng >180 Ngày', value: stats.slowMovingCount, accent: stats.slowMovingCount > 0 ? '#DC2626' : '#16A34A', icon: TrendingDown },
    ]

    const activeModule = wmsFeatureModules.find(m => m.key === activeTab)

    return (
        <div className="space-y-4 max-w-screen-2xl">
            {/* 1. TOPMOST HEADER CONTAINER */}
            <div className="p-3.5 rounded-2xl shadow-sm"
                style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                
                {/* Single Consolidated Top Header Row */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
                    {/* Left: Title & Active Breadcrumb */}
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setViewMode('grid')}
                            className="text-base font-bold flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                            title="Nhấn vào Kho Hàng để về trang Bảng Chức Năng Kho"
                            style={{ color: '#0F172A' }}
                        >
                            <Warehouse size={20} style={{ color: '#D4A853' }} /> Kho Hàng
                        </button>

                        {viewMode === 'workspace' && (
                            <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                                <ChevronRight size={14} /> <span className="text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md">{activeModule?.title}</span>
                            </div>
                        )}
                    </div>

                    {/* Middle: Stat Badges */}
                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full">
                        {statCards.map(s => (
                            <div key={s.label} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] whitespace-nowrap shrink-0 shadow-xs"
                                style={{ background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                                <s.icon size={13} style={{ color: s.accent }} />
                                <span className="uppercase font-semibold" style={{ color: '#64748B' }}>{s.label}:</span>
                                <span className="font-bold font-mono" style={{ color: s.accent }}>{s.value}</span>
                            </div>
                        ))}
                    </div>

                    {/* Right Action Group: Warehouse Selector + Create WH Button */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
                        <div className="relative shrink-0 flex-1 sm:flex-none">
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
                                className="w-full sm:w-auto appearance-none pl-3 pr-8 py-2 rounded-lg text-xs font-bold outline-none cursor-pointer shadow-xs"
                                style={{
                                    background: '#FFFFFF',
                                    border: '1px solid #CBD5E1',
                                    color: '#0F172A',
                                }}
                            >
                                <option value="">🏢 Tất cả kho ({stats.warehouses})</option>
                                {warehouses.map(w => (
                                    <option key={w.id} value={w.id}>
                                        🏢 {w.name} {w.allowSales === false ? '⛔ [Chỉ Điều Chuyển]' : w.isDefault ? '⭐ [Kho Mặc Định]' : ''} ({w.totalStock.toLocaleString()} chai)
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-[#64748B]" />
                        </div>

                        <button onClick={() => setCreateWHOpen(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold shadow-xs transition-all hover:brightness-105 shrink-0 cursor-pointer"
                            style={{ background: '#D4A853', color: '#0A1926' }}>
                            <Plus size={14} /> Tạo Kho Mới
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ VIEW MODE 1: BẢNG CHỨC NĂNG TRUNG TÂM (GRID VIEW) ═══ */}
            {viewMode === 'grid' && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <p className="text-xs uppercase tracking-wider font-bold" style={{ color: '#64748B' }}>
                            Chức Năng Quản Lý Kho
                        </p>
                    </div>

                    {/* 9 Feature Cards Grid */}
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
                                    className="p-4 sm:p-5 rounded-2xl flex flex-col justify-between cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 group shadow-sm"
                                    style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}
                                >
                                    <div>
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="p-3 rounded-xl transition-transform group-hover:scale-105 shrink-0"
                                                style={{ background: mod.bg, color: mod.color }}>
                                                <Icon size={24} />
                                            </div>
                                            {mod.badge !== undefined && mod.badge > 0 && (
                                                <span className="text-[11px] px-2.5 py-0.5 rounded-full font-extrabold shadow-xs"
                                                    style={{ background: '#DC2626', color: '#FFFFFF' }}>
                                                    {mod.badge} cảnh báo
                                                </span>
                                            )}
                                        </div>

                                        <h4 className="text-sm sm:text-base font-bold mb-1 group-hover:text-[#B47816] transition-colors"
                                            style={{ color: '#0F172A' }}>
                                            {mod.title}
                                        </h4>
                                        <p className="text-[11px] font-mono mb-2" style={{ color: '#64748B' }}>
                                            {mod.subtitle}
                                        </p>
                                        <p className="text-xs leading-relaxed" style={{ color: '#475569' }}>
                                            {mod.description}
                                        </p>
                                    </div>

                                    <div className="mt-4 pt-3 flex items-center justify-between text-xs font-bold"
                                        style={{ borderTop: '1px solid #F1F5F9', color: mod.color }}>
                                        <span>{mod.actionLabel}</span>
                                        <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* ═══ VIEW MODE 2: MÀN HÌNH LÀM VIỆC CHI TIẾT (WORKSPACE VIEW) ═══ */}
            {viewMode === 'workspace' && (
                <div className="space-y-4">

                    {/* NXT — Stock Movement Report Tab */}
                    {activeTab === 'nxt' && <StockMovementTab warehouses={warehouseList} />}

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
                                <div className="flex flex-col items-center py-20 gap-3 rounded-xl shadow-xs"
                                    style={{ border: '1px dashed #CBD5E1', background: '#FFFFFF' }}>
                                    <MapPin size={36} style={{ color: '#94A3B8' }} />
                                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                                        Vui lòng chọn một kho từ danh sách ở trên để quản lý vị trí
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
                                    {selectedWH
                                        ? `Tồn Kho — ${warehouses.find(w => w.id === selectedWH)?.name ?? ''}`
                                        : 'Tồn Kho — Tất cả kho'}
                                </p>
                                {selectedWH && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs px-2.5 py-1 rounded-lg font-mono font-bold" style={{ color: '#B47816', background: 'rgba(212,168,83,0.15)' }}>
                                            {filteredLots.length} lô
                                        </span>
                                        <button onClick={() => {
                                            if (filteredLots.length === 0) return
                                            const headers = ['Lô Hàng', 'Sản Phẩm', 'SKU', 'Vintage', 'Vị Trí', 'Tồn Kho', 'Giá Vốn (VND)', 'Giá Trị Lô (VND)', 'Ngày Nhập', 'Trạng Thái']
                                            const rows = filteredLots.map(l => [
                                                l.lotNo, l.productName, l.skuCode, l.vintage ?? 'NV', l.locationCode,
                                                l.qtyAvailable, l.unitLandedCost, l.qtyAvailable * l.unitLandedCost,
                                                new Date(l.receivedDate).toLocaleDateString('vi-VN'), l.status,
                                            ])
                                            const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
                                            const BOM = '\uFEFF'
                                            const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
                                            const url = URL.createObjectURL(blob)
                                            const a = document.createElement('a')
                                            a.href = url
                                            a.download = `ton-kho-${new Date().toISOString().slice(0, 10)}.csv`
                                            a.click()
                                            URL.revokeObjectURL(url)
                                        }} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all font-bold shadow-xs"
                                            style={{ color: '#0F172A', background: '#F1F5F9', border: '1px solid #CBD5E1' }}>
                                            <Download size={13} /> Export CSV
                                        </button>
                                    </div>
                                )}
                            </div>

                            {selectedWH && (
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative flex-1 min-w-[200px]">
                                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#64748B' }} />
                                        <input placeholder="Tìm lô, sản phẩm, SKU..." value={search}
                                            onChange={e => setSearch(e.target.value)}
                                            className="w-full pl-9 pr-3 py-2.5 rounded-lg text-sm outline-none font-medium"
                                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: '#0F172A' }} />
                                    </div>
                                    <div className="flex gap-2">
                                        <select value={wineFilter} onChange={e => setWineFilter(e.target.value)}
                                            className="flex-1 sm:flex-none px-3 py-2.5 rounded-lg text-sm outline-none font-medium"
                                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: wineFilter ? '#0F172A' : '#64748B' }}>
                                            <option value="">Tất cả loại rượu</option>
                                            <option value="RED">🔴 Đỏ</option>
                                            <option value="WHITE">🟡 Trắng</option>
                                            <option value="ROSE">🌸 Rosé</option>
                                            <option value="SPARKLING">🥂 Sủi tăm</option>
                                            <option value="FORTIFIED">🍯 Fortified</option>
                                            <option value="DESSERT">🍮 Dessert</option>
                                        </select>
                                        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                                            className="flex-1 sm:flex-none px-3 py-2.5 rounded-lg text-sm outline-none font-medium"
                                            style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', color: statusFilter ? '#0F172A' : '#64748B' }}>
                                            <option value="">Tất cả trạng thái</option>
                                            <option value="AVAILABLE">✅ Sẵn sàng</option>
                                            <option value="RESERVED">📌 Đã đặt</option>
                                            <option value="QUARANTINE">⚠️ Cách ly</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                            {lotsLoading ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 size={24} className="animate-spin" style={{ color: '#D4A853' }} />
                                </div>
                            ) : selectedWH ? (
                                <StockTable lots={filteredLots} sortConfig={sortConfig} onSort={handleSort} />
                            ) : (
                                <div className="flex flex-col items-center py-20 gap-3 rounded-xl shadow-xs"
                                    style={{ border: '1px dashed #CBD5E1', background: '#FFFFFF' }}>
                                    <Warehouse size={36} style={{ color: '#94A3B8' }} />
                                    <p className="text-sm font-semibold" style={{ color: '#0F172A' }}>
                                        Vui lòng chọn một kho để xem tồn kho chi tiết
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* FLOATING MOBILE BOTTOM NAVIGATION BAR FOR WMS */}
            <div className="block md:hidden fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border-t border-slate-800 p-2 z-40 shadow-2xl">
                <div className="max-w-md mx-auto grid grid-cols-5 gap-1 text-center">
                    <button
                        onClick={() => setViewMode('grid')}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-bold text-[9px] transition ${viewMode === 'grid' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400'}`}
                    >
                        <LayoutGrid size={16} />
                        Menu Kho
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab('inventory')
                            setViewMode('workspace')
                        }}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-bold text-[9px] transition ${viewMode === 'workspace' && activeTab === 'inventory' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400'}`}
                    >
                        <Package size={16} />
                        Tồn Kho
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab('do')
                            setViewMode('workspace')
                        }}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-bold text-[9px] transition ${viewMode === 'workspace' && activeTab === 'do' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400'}`}
                    >
                        <Truck size={16} />
                        Xuất Kho
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab('gr')
                            setViewMode('workspace')
                        }}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-bold text-[9px] transition ${viewMode === 'workspace' && activeTab === 'gr' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400'}`}
                    >
                        <PackagePlus size={16} />
                        Nhập Kho
                    </button>

                    <button
                        onClick={() => {
                            setActiveTab('stock-count')
                            setViewMode('workspace')
                        }}
                        className={`py-2 rounded-xl flex flex-col items-center gap-1 font-bold text-[9px] transition ${viewMode === 'workspace' && activeTab === 'stock-count' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400'}`}
                    >
                        <ClipboardList size={16} />
                        Kiểm Kê
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
