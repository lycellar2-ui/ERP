'use client'

import { useState } from 'react'
import {
    Warehouse, Package, BarChart3, Plus, Search, MapPin,
    Thermometer, Box, X, Save, Loader2, AlertCircle, CheckCircle2,
    ChevronRight, Layers, PackagePlus, Truck, ShieldAlert, Trash2
} from 'lucide-react'
import {
    WarehouseRow, StockLotRow, LocationRow,
    createWarehouse, createLocation, getStockInventory, getLocations,
    getQuarantinedLots, moveToQuarantine, releaseFromQuarantine, writeOffStock
} from './actions'
import { formatVND, formatDate } from '@/lib/utils'
import { GoodsReceiptTab } from './GoodsReceiptTab'
import { DeliveryOrderTab } from './DeliveryOrderTab'
import { LocationManager } from './LocationManager'

const COUNTRY_FLAGS: Record<string, string> = {
    FR: '🇫🇷', IT: '🇮🇹', ES: '🇪🇸', PT: '🇵🇹', DE: '🇩🇪',
    US: '🇺🇸', AU: '🇦🇺', NZ: '🇳🇿', AR: '🇦🇷', CL: '🇨🇱', ZA: '🇿🇦',
}

const WINE_TYPE_COLOR: Record<string, string> = {
    RED: '#E05252', WHITE: '#87CBB9', ROSE: '#D4607A', SPARKLING: '#7AC4C4', FORTIFIED: '#87CBB9', DESSERT: '#D4963A',
}

const LOT_STATUS: Record<string, { label: string; color: string }> = {
    AVAILABLE: { label: 'Sẵn sàng', color: '#5BA88A' },
    RESERVED: { label: 'Đã đặt trước', color: '#87CBB9' },
    QUARANTINE: { label: 'Kiểm dịch', color: '#87CBB9' },
    CONSUMED: { label: 'Đã xuất', color: '#4A6A7A' },
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

    const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm outline-none"
    const inputStyle = { background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(10,5,2,0.8)' }} onClick={onClose}>
            <div className="rounded-2xl p-6 space-y-5 w-full max-w-md"
                style={{ background: '#0D1E2B', border: '1px solid #2A4355' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold" style={{ fontFamily: '"Cormorant Garamond", serif', color: '#E8F1F2' }}>
                        🏭 Tạo Kho Mới
                    </h3>
                    <button onClick={onClose} style={{ color: '#4A6A7A' }}><X size={18} /></button>
                </div>

                {error && <div className="text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(139,26,46,0.2)', color: '#E05252' }}>{error}</div>}

                {[
                    { key: 'code', label: 'Mã Kho (VD: KHO-HCM)', placeholder: 'KHO-HCM-01' },
                    { key: 'name', label: 'Tên Kho', placeholder: 'Kho Cửa hàng' },
                    { key: 'address', label: 'Địa Chỉ', placeholder: '15 Đường Xuyên Á, Củ Chi, TP.HCM' },
                ].map(f => (
                    <div key={f.key}>
                        <label className="text-xs font-semibold uppercase tracking-wide block mb-1.5" style={{ color: '#4A6A7A' }}>{f.label}</label>
                        <input className={inputCls} style={inputStyle} value={(form as any)[f.key]} placeholder={f.placeholder}
                            onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                            onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                            onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                    </div>
                ))}

                <div className="flex justify-end gap-3 pt-2">
                    <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm"
                        style={{ color: '#8AAEBB', border: '1px solid #2A4355' }}>Hủy</button>
                    <button onClick={handleSave} disabled={saving}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                        style={{ background: '#87CBB9', color: '#0A1926' }}>
                        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {saving ? '...' : 'Lưu'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ── Warehouse card ─────────────────────────────────
function WarehouseCard({
    warehouse, isSelected, onClick
}: {
    warehouse: WarehouseRow; isSelected: boolean; onClick: () => void
}) {
    const pct = warehouse.locationCount > 0
        ? Math.min(100, Math.round((warehouse.totalStock / (warehouse.locationCount * 60 * 12)) * 100))
        : 0

    return (
        <button onClick={onClick} className="w-full text-left p-4 rounded-xl transition-all duration-200"
            style={{
                background: isSelected ? 'rgba(135,203,185,0.12)' : '#142433',
                border: `1px solid ${isSelected ? '#87CBB9' : '#2A4355'}`,
            }}>
            <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                    <p className="font-bold text-sm" style={{ color: '#E8F1F2' }}>{warehouse.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#4A6A7A', fontFamily: '"DM Mono", monospace' }}>{warehouse.code}</p>
                </div>
                {isSelected && <ChevronRight size={14} style={{ color: '#87CBB9', flexShrink: 0, marginTop: 2 }} />}
            </div>
            {warehouse.address && (
                <p className="text-xs mb-3 flex items-start gap-1.5" style={{ color: '#4A6A7A' }}>
                    <MapPin size={11} className="mt-0.5 flex-shrink-0" /> {warehouse.address}
                </p>
            )}
            <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                    { label: 'Khu vực', value: warehouse.locationCount },
                    { label: 'Lô hàng', value: warehouse.lotCount },
                    { label: 'Tồn kho', value: warehouse.totalStock },
                ].map(s => (
                    <div key={s.label} className="text-center">
                        <p className="text-base font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{s.value.toLocaleString()}</p>
                        <p className="text-xs" style={{ color: '#4A6A7A' }}>{s.label}</p>
                    </div>
                ))}
            </div>
            {/* Capacity bar */}
            <div>
                <div className="flex justify-between mb-1">
                    <span className="text-xs" style={{ color: '#4A6A7A' }}>Chiếm dụng ước tính</span>
                    <span className="text-xs font-bold" style={{ color: pct > 80 ? '#8B1A2E' : pct > 60 ? '#87CBB9' : '#5BA88A' }}>{pct}%</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1B2E3D' }}>
                    <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: pct > 80 ? '#8B1A2E' : pct > 60 ? '#87CBB9' : '#5BA88A' }} />
                </div>
            </div>
        </button>
    )
}

// ── Stock table ───────────────────────────────────
function StockTable({ lots }: { lots: StockLotRow[] }) {
    if (lots.length === 0) {
        return (
            <div className="flex flex-col items-center py-16 gap-3 rounded-2xl" style={{ border: '1px dashed #2A4355' }}>
                <Box size={32} style={{ color: '#2A4355' }} />
                <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có tồn kho</p>
                <p className="text-xs" style={{ color: '#2A4355' }}>Nhập hàng qua Goods Receipt để tạo stock lots</p>
            </div>
        )
    }

    return (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #2A4355', background: '#0D1E2B' }}>
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                        {['Lô Hàng', 'Sản Phẩm', 'Vị Trí', 'Nhập Ngày', 'SL Nhận', 'Còn Lại', 'Đơn Giá Đầu Vào', 'Status'].map(h => (
                            <th key={h} className="px-4 py-3 text-xs uppercase tracking-wider font-semibold" style={{ color: '#4A6A7A' }}>{h}</th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {lots.map(lot => {
                        const flag = COUNTRY_FLAGS[lot.country] ?? '🌍'
                        const wineColor = WINE_TYPE_COLOR[lot.wineType] ?? '#8AAEBB'
                        const statusCfg = LOT_STATUS[lot.status] ?? { label: lot.status, color: '#8AAEBB' }
                        const pctRemaining = lot.qtyReceived > 0 ? (lot.qtyAvailable / lot.qtyReceived) * 100 : 0
                        return (
                            <tr key={lot.id} className="group transition-colors"
                                style={{ borderBottom: '1px solid rgba(61,43,31,0.6)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(61,43,31,0.35)')}
                                onMouseLeave={e => (e.currentTarget.style.background = '')}>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-bold" style={{ color: '#87CBB9', fontFamily: '"DM Mono", monospace' }}>{lot.lotNo}</span>
                                </td>
                                <td className="px-4 py-3">
                                    <p className="text-sm font-medium truncate max-w-[220px]" style={{ color: '#E8F1F2' }}>{lot.productName}</p>
                                    <p className="text-xs mt-0.5 flex items-center gap-1.5" style={{ color: '#4A6A7A' }}>
                                        {flag}
                                        <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: wineColor }} />
                                        {lot.skuCode}
                                    </p>
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-bold px-2 py-1 rounded-lg"
                                        style={{ background: '#1B2E3D', color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>
                                        {lot.locationCode}
                                    </span>
                                    <p className="text-xs mt-1" style={{ color: '#4A6A7A' }}>{lot.warehouseName}</p>
                                </td>
                                <td className="px-4 py-3 text-xs" style={{ color: '#4A6A7A' }}>
                                    {formatDate(lot.receivedDate)}
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-sm" style={{ color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>
                                        {lot.qtyReceived.toLocaleString()}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold" style={{
                                            color: pctRemaining < 20 ? '#8B1A2E' : pctRemaining < 50 ? '#87CBB9' : '#5BA88A',
                                            fontFamily: '"DM Mono", monospace'
                                        }}>
                                            {lot.qtyAvailable.toLocaleString()}
                                        </span>
                                        <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ background: '#1B2E3D' }}>
                                            <div className="h-full rounded-full" style={{
                                                width: `${pctRemaining}%`,
                                                background: pctRemaining < 20 ? '#8B1A2E' : pctRemaining < 50 ? '#87CBB9' : '#5BA88A',
                                            }} />
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {lot.unitLandedCost > 0 ? (
                                        <span className="text-xs" style={{ color: '#8AAEBB', fontFamily: '"DM Mono", monospace' }}>
                                            {formatVND(lot.unitLandedCost)}/chai
                                        </span>
                                    ) : (
                                        <span className="text-xs" style={{ color: '#2A4355' }}>—</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                        style={{ color: statusCfg.color, background: `${statusCfg.color}20` }}>
                                        {statusCfg.label}
                                    </span>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

// ── Quarantine & Write-Off Panel ──────────────────
function QuarantinePanel({ lots, loading, onRefresh }: { lots: any[]; loading: boolean; onRefresh: () => void }) {
    const [processing, setProcessing] = useState<string | null>(null)
    const [loaded, setLoaded] = useState(false)

    const handleLoad = () => { setLoaded(true); onRefresh() }

    const handleRelease = async (lotId: string, action: 'RESTORE' | 'WRITE_OFF') => {
        setProcessing(lotId)
        await releaseFromQuarantine(lotId, action)
        onRefresh()
        setProcessing(null)
    }

    if (!loaded) {
        return (
            <div className="flex flex-col items-center py-16 gap-3 rounded-xl" style={{ border: '1px dashed #2A4355' }}>
                <ShieldAlert size={32} style={{ color: '#2A4355' }} />
                <p className="text-sm" style={{ color: '#4A6A7A' }}>Quản lý hàng cách ly và ghi nhận hao hụt</p>
                <button onClick={handleLoad} className="text-xs px-4 py-2 rounded-lg font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}>Tải Danh Sách Cách Ly</button>
            </div>
        )
    }

    if (loading) return <div className="flex justify-center py-12"><Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} /></div>

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: '#E8F1F2' }}>
                    <ShieldAlert size={14} className="inline mr-1.5" />Hàng Đang Cách Ly
                </h3>
                <button onClick={onRefresh} className="text-xs px-3 py-1.5 rounded" style={{ border: '1px solid #2A4355', color: '#87CBB9' }}>
                    Làm Mới
                </button>
            </div>

            {lots.length === 0 ? (
                <div className="flex flex-col items-center py-12 gap-2 rounded-xl" style={{ border: '1px dashed #2A4355' }}>
                    <CheckCircle2 size={28} style={{ color: '#5BA88A' }} />
                    <p className="text-sm" style={{ color: '#4A6A7A' }}>Không có hàng nào đang cách ly</p>
                </div>
            ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #2A4355' }}>
                    <table className="w-full text-left text-xs" style={{ borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#142433', borderBottom: '1px solid #2A4355' }}>
                                {['Lô Hàng', 'Sản Phẩm', 'SL', 'Vị Trí', 'Ngày Nhập', ''].map(h => (
                                    <th key={h} className="px-4 py-3 font-semibold uppercase tracking-wider" style={{ color: '#4A6A7A' }}>{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {lots.map((lot: any) => (
                                <tr key={lot.id} style={{ borderBottom: '1px solid rgba(42,67,85,0.5)' }}>
                                    <td className="px-4 py-3 font-mono font-bold" style={{ color: '#D4A853' }}>{lot.lotNo}</td>
                                    <td className="px-4 py-3" style={{ color: '#E8F1F2' }}>{lot.productName || lot.productId}</td>
                                    <td className="px-4 py-3 font-mono" style={{ color: '#8AAEBB' }}>{Number(lot.qtyAvailable).toLocaleString()}</td>
                                    <td className="px-4 py-3 font-mono" style={{ color: '#4A6A7A' }}>{lot.locationCode || '—'}</td>
                                    <td className="px-4 py-3" style={{ color: '#4A6A7A' }}>{new Date(lot.receivedDate).toLocaleDateString('vi-VN')}</td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2 justify-end">
                                            <button onClick={() => handleRelease(lot.id, 'RESTORE')} disabled={processing === lot.id}
                                                className="px-2.5 py-1 rounded text-xs font-semibold"
                                                style={{ background: 'rgba(91,168,138,0.15)', color: '#5BA88A', border: '1px solid rgba(91,168,138,0.3)' }}>
                                                {processing === lot.id ? '...' : 'Khôi Phục'}
                                            </button>
                                            <button onClick={() => handleRelease(lot.id, 'WRITE_OFF')} disabled={processing === lot.id}
                                                className="px-2.5 py-1 rounded text-xs font-semibold"
                                                style={{ background: 'rgba(139,26,46,0.12)', color: '#8B1A2E', border: '1px solid rgba(139,26,46,0.25)' }}>
                                                <Trash2 size={10} className="inline mr-0.5" />Hủy
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

// ── Main ──────────────────────────────────────────
type WMSTab = 'inventory' | 'gr' | 'do' | 'locations' | 'quarantine'

interface Props {
    initialWarehouses: WarehouseRow[]
    stats: { warehouses: number; totalLots: number; availableBottles: number; reservedBottles: number }
}

export function WarehouseClient({ initialWarehouses, stats }: Props) {
    const [warehouses, setWarehouses] = useState(initialWarehouses)
    const [selectedWH, setSelectedWH] = useState<string | null>(null)
    const [lots, setLots] = useState<StockLotRow[]>([])
    const [lotsLoading, setLotsLoading] = useState(false)
    const [selectedLocations, setSelectedLocations] = useState<LocationRow[]>([])
    const [quarantineLots, setQuarantineLots] = useState<any[]>([])
    const [qLoading, setQLoading] = useState(false)
    const [search, setSearch] = useState('')
    const [wineFilter, setWineFilter] = useState('')
    const [createWHOpen, setCreateWHOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<WMSTab>('inventory')

    const warehouseList = warehouses.map(w => ({ id: w.id, code: w.code, name: w.name }))

    const wmsTabs: { key: WMSTab; label: string; icon: any }[] = [
        { key: 'inventory', label: 'Tồn Kho', icon: Package },
        { key: 'locations', label: 'Vị Trí Kho', icon: MapPin },
        { key: 'gr', label: 'Nhập Kho (GR)', icon: PackagePlus },
        { key: 'do', label: 'Xuất Kho (DO)', icon: Truck },
        { key: 'quarantine', label: 'Cách Ly & Hủy', icon: ShieldAlert },
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

    const filteredLots = lots.filter(l =>
        (!search || l.productName.toLowerCase().includes(search.toLowerCase()) || l.skuCode.toLowerCase().includes(search.toLowerCase()) || l.lotNo.toLowerCase().includes(search.toLowerCase())) &&
        (!wineFilter || l.wineType === wineFilter)
    )

    const statCards = [
        { label: 'Số Kho', value: stats.warehouses, accent: '#87CBB9', icon: Warehouse },
        { label: 'Lô Hàng Sẵn', value: stats.totalLots, accent: '#5BA88A', icon: Layers },
        { label: 'Tổng Tồn Kho', value: `${stats.availableBottles.toLocaleString()} chai`, accent: '#4A8FAB', icon: Package },
        { label: 'Đã Đặt Trước', value: `${stats.reservedBottles.toLocaleString()} chai`, accent: '#87CBB9', icon: Box },
    ]

    return (
        <div className="space-y-6 max-w-screen-2xl">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold" style={{ fontFamily: '"Cormorant Garamond", Georgia, serif', color: '#E8F1F2' }}>
                        Kho Hàng (WMS)
                    </h2>
                    <p className="text-sm mt-0.5" style={{ color: '#4A6A7A' }}>
                        Warehouse Management — Quản lý tồn kho theo kho, vị trí, lô hàng
                    </p>
                </div>
                <button onClick={() => setCreateWHOpen(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold"
                    style={{ background: '#87CBB9', color: '#0A1926' }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#A5DED0')}
                    onMouseLeave={e => (e.currentTarget.style.background = '#87CBB9')}>
                    <Plus size={16} /> Tạo Kho Mới
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {statCards.map(s => (
                    <div key={s.label} className="flex items-center gap-4 p-4 rounded-xl"
                        style={{ background: '#1B2E3D', border: '1px solid #2A4355' }}>
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ background: `${s.accent}20` }}>
                            <s.icon size={20} style={{ color: s.accent }} />
                        </div>
                        <div>
                            <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: '#4A6A7A' }}>{s.label}</p>
                            <p className="text-xl font-bold mt-0.5 leading-tight" style={{ color: '#E8F1F2', fontFamily: '"DM Mono", monospace' }}>{s.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* WMS Tabs */}
            <div className="flex gap-1 p-1 rounded-md" style={{ background: '#142433' }}>
                {wmsTabs.map(t => {
                    const Icon = t.icon
                    const active = activeTab === t.key
                    return (
                        <button key={t.key} onClick={() => setActiveTab(t.key)}
                            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded transition-all"
                            style={{
                                background: active ? '#1B2E3D' : 'transparent',
                                color: active ? '#87CBB9' : '#4A6A7A',
                                border: active ? '1px solid #2A4355' : '1px solid transparent',
                            }}>
                            <Icon size={14} /> {t.label}
                        </button>
                    )
                })}
            </div>

            {/* GR Tab */}
            {activeTab === 'gr' && <GoodsReceiptTab warehouses={warehouseList} />}

            {/* DO Tab */}
            {activeTab === 'do' && <DeliveryOrderTab warehouses={warehouseList} />}

            {/* Quarantine & Write-Off Tab */}
            {activeTab === 'quarantine' && (
                <QuarantinePanel lots={quarantineLots} loading={qLoading} onRefresh={async () => {
                    setQLoading(true)
                    setQuarantineLots(await getQuarantinedLots())
                    setQLoading(false)
                }} />
            )}

            {/* Locations Tab */}
            {activeTab === 'locations' && (
                <div className="grid grid-cols-12 gap-5">
                    {/* Left: warehouse list */}
                    <div className="col-span-12 lg:col-span-4 space-y-3">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A6A7A' }}>Chọn Kho</p>
                        {warehouses.map(w => (
                            <WarehouseCard key={w.id} warehouse={w} isSelected={selectedWH === w.id}
                                onClick={() => selectWarehouse(w.id)} />
                        ))}
                    </div>
                    {/* Right: location manager */}
                    <div className="col-span-12 lg:col-span-8">
                        {selectedWH ? (
                            <LocationManager
                                key={selectedWH}
                                warehouseId={selectedWH}
                                warehouseName={warehouses.find(w => w.id === selectedWH)?.name ?? ''}
                                initialLocations={selectedLocations}
                            />
                        ) : (
                            <div className="flex flex-col items-center py-20 gap-3 rounded-xl"
                                style={{ border: '1px dashed #2A4355' }}>
                                <MapPin size={36} style={{ color: '#2A4355' }} />
                                <p className="text-sm" style={{ color: '#4A6A7A' }}>
                                    Chọn một kho bên trái để thiết lập Zone / Rack / Bin Location
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Inventory Tab — Warehouse grid + Stock view */}
            {activeTab === 'inventory' && (
                <div className="grid grid-cols-12 gap-5">
                    {/* Left: warehouse list */}
                    <div className="col-span-12 lg:col-span-4 space-y-3">
                        <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A6A7A' }}>Danh Sách Kho</p>
                        {warehouses.length === 0 ? (
                            <div className="flex flex-col items-center py-12 gap-3 rounded-xl"
                                style={{ border: '1px dashed #2A4355', background: '#142433' }}>
                                <Warehouse size={28} style={{ color: '#2A4355' }} />
                                <p className="text-sm" style={{ color: '#4A6A7A' }}>Chưa có kho nào</p>
                                <button onClick={() => setCreateWHOpen(true)} className="text-xs px-3 py-1.5 rounded-lg"
                                    style={{ color: '#87CBB9', border: '1px solid rgba(135,203,185,0.3)' }}>
                                    + Thêm kho đầu tiên
                                </button>
                            </div>
                        ) : warehouses.map(w => (
                            <WarehouseCard key={w.id} warehouse={w} isSelected={selectedWH === w.id}
                                onClick={() => selectWarehouse(w.id)} />
                        ))}
                    </div>

                    {/* Right: stock inventory */}
                    <div className="col-span-12 lg:col-span-8 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="text-xs uppercase tracking-widest font-bold" style={{ color: '#4A6A7A' }}>
                                {selectedWH
                                    ? `Tồn Kho — ${warehouses.find(w => w.id === selectedWH)?.name ?? ''}`
                                    : 'Tồn Kho — Chọn kho từ danh sách bên trái'}
                            </p>
                            {selectedWH && (
                                <span className="text-xs px-2 py-1 rounded-lg"
                                    style={{ color: '#87CBB9', background: 'rgba(135,203,185,0.1)', fontFamily: '"DM Mono", monospace' }}>
                                    {filteredLots.length} lô
                                </span>
                            )}
                        </div>

                        {selectedWH && (
                            <div className="flex gap-3">
                                <div className="relative flex-1">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#4A6A7A' }} />
                                    <input placeholder="Tìm lô, sản phẩm, SKU..." value={search}
                                        onChange={e => setSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
                                        style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: '#E8F1F2' }}
                                        onFocus={e => (e.currentTarget.style.borderColor = '#87CBB9')}
                                        onBlur={e => (e.currentTarget.style.borderColor = '#2A4355')} />
                                </div>
                                <select value={wineFilter} onChange={e => setWineFilter(e.target.value)}
                                    className="px-3 py-2 rounded-lg text-sm outline-none"
                                    style={{ background: '#1B2E3D', border: '1px solid #2A4355', color: wineFilter ? '#E8F1F2' : '#4A6A7A' }}>
                                    <option value="">Tất cả loại</option>
                                    <option value="RED">🔴 Đỏ</option>
                                    <option value="WHITE">🟡 Trắng</option>
                                    <option value="ROSE">🌸 Rosé</option>
                                    <option value="SPARKLING">🥂 Sâm panh</option>
                                </select>
                            </div>
                        )}

                        {lotsLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 size={24} className="animate-spin" style={{ color: '#87CBB9' }} />
                            </div>
                        ) : selectedWH ? (
                            <StockTable lots={filteredLots} />
                        ) : (
                            <div className="flex flex-col items-center py-20 gap-3 rounded-xl"
                                style={{ border: '1px dashed #2A4355' }}>
                                <Warehouse size={36} style={{ color: '#2A4355' }} />
                                <p className="text-sm" style={{ color: '#4A6A7A' }}>
                                    Chọn một kho để xem tồn kho chi tiết
                                </p>
                            </div>
                        )}
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
